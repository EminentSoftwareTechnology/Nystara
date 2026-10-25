import { Prisma } from "@prisma/client";
import { blindIndex, decryptField, encryptField, isEncrypted } from "./field-encryption";

type Plain = Record<string, unknown>;

/** Personal-data columns stored encrypted. `indexed` fields also keep a blind index for equality lookups. */
export const ENCRYPTED_FIELDS: Record<string, { fields: string[]; indexed?: Record<string, string> }> = {
  User: { fields: ["email"], indexed: { email: "emailHash" } },
  Subscriber: { fields: ["email"], indexed: { email: "emailHash" } },
  VerificationToken: { fields: ["identifier"], indexed: { identifier: "identifierHash" } },
  Account: { fields: ["refresh_token", "access_token", "id_token"] },
  Comment: { fields: ["guestName"] },
  Highlight: { fields: ["quote", "note"] },
  AiConversation: { fields: ["title"] },
  AiMessage: { fields: ["content"] },
};

const relations = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    new Map(model.fields.filter((field) => field.kind === "object").map((field) => [field.name, field.type])),
  ]),
);

const isPlain = (value: unknown): value is Plain =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const each = (value: unknown, fn: (item: Plain) => void) => {
  for (const item of Array.isArray(value) ? value : [value]) if (isPlain(item)) fn(item);
};

export function encryptData(model: string, data: Plain) {
  const config = ENCRYPTED_FIELDS[model];
  for (const [key, value] of Object.entries(data)) {
    if (config?.fields.includes(key)) {
      const plain = isPlain(value) && typeof value.set === "string" ? value.set : value;
      if (typeof plain !== "string" || isEncrypted(plain)) continue;
      data[key] = encryptField(plain);
      const hashField = config.indexed?.[key];
      if (hashField) data[hashField] = blindIndex(plain);
      continue;
    }
    const target = relations.get(model)?.get(key);
    if (target && isPlain(value)) encryptNested(target, value);
  }
}

function encryptNested(model: string, ops: Plain) {
  each(ops.create, (item) => encryptData(model, item));
  each(ops.createMany, (item) => each(item.data, (row) => encryptData(model, row)));
  each(ops.connectOrCreate, (item) => each(item.create, (row) => encryptData(model, row)));
  each(ops.upsert, (item) => {
    each(item.create, (row) => encryptData(model, row));
    each(item.update, (row) => encryptData(model, row));
    if (isPlain(item.where)) rewriteWhere(model, item.where);
  });
  each(ops.update, (item) => (isPlain(item.data) ? encryptData(model, item.data) : encryptData(model, item)));
  each(ops.updateMany, (item) => each(item.data, (row) => encryptData(model, row)));
}

/** Equality on an indexed field becomes a blind-index lookup; any other filter on ciphertext is a bug. */
export function rewriteWhere(model: string, where: Plain) {
  const config = ENCRYPTED_FIELDS[model];
  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      each(value, (item) => rewriteWhere(model, item));
      continue;
    }
    if (config?.fields.includes(key)) {
      if (value === null || (isPlain(value) && Object.keys(value).every((op) => op === "not") && value.not === null)) continue;
      const hashField = config.indexed?.[key];
      const plain = typeof value === "string" ? value : isPlain(value) && typeof value.equals === "string" ? value.equals : null;
      if (!hashField || plain === null) throw new Error(`${model}.${key} is encrypted and only supports equality lookups`);
      delete where[key];
      where[hashField] = blindIndex(plain);
      continue;
    }
    const target = relations.get(model)?.get(key);
    if (target && isPlain(value)) {
      const filters = ["some", "every", "none", "is", "isNot"].filter((op) => isPlain(value[op]));
      if (filters.length) filters.forEach((op) => rewriteWhere(target, value[op] as Plain));
      else rewriteWhere(target, value);
    }
  }
}

export function decryptResult(model: string, value: unknown) {
  each(value, (row) => {
    const config = ENCRYPTED_FIELDS[model];
    for (const [key, field] of Object.entries(row)) {
      if (config?.fields.includes(key) && typeof field === "string") row[key] = decryptField(field);
      const target = relations.get(model)?.get(key);
      if (target && field) decryptResult(target, field);
    }
  });
}

/** Encrypts personal-data columns on write, decrypts them on read and rewrites email lookups to blind indexes. */
export const fieldEncryption = Prisma.defineExtension({
  name: "field-encryption",
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        const input = args as Plain;
        if (isPlain(input.where)) rewriteWhere(model, input.where);
        each(input.data, (row) => encryptData(model, row));
        if (isPlain(input.create)) encryptData(model, input.create);
        if (isPlain(input.update)) encryptData(model, input.update);
        const result = await query(args);
        decryptResult(model, result);
        return result;
      },
    },
  },
});
