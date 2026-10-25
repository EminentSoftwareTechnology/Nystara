import assert from "node:assert/strict";
import { test } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";
import { deleteR2Prefix } from "../lib/r2";

test("account media erasure paginates and deletes only the user's prefix", async () => {
  let lists = 0;
  const deletions: string[] = [];
  const client = new S3Client({
    region: "auto",
    endpoint: "http://127.0.0.1:9999",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler: {
      async handle(request: { method: string; query?: Record<string, unknown>; body?: unknown }) {
        let body: string;
        if (request.method === "GET") {
          assert.equal(request.query?.prefix, "stories/user/");
          lists++;
          if (lists === 2)
            assert.equal(request.query?.["continuation-token"], "next-page");
          body = `<ListBucketResult><IsTruncated>${lists === 1}</IsTruncated>${lists === 1 ? "<NextContinuationToken>next-page</NextContinuationToken>" : ""}<Contents><Key>stories/user/${lists}.png</Key></Contents></ListBucketResult>`;
        } else {
          deletions.push(String(request.body));
          body = "<DeleteResult/>";
        }
        return {
          response: { statusCode: 200, headers: {}, body: Buffer.from(body) },
        };
      },
    },
  });
  try {
    await deleteR2Prefix(client, "bucket", "stories/user/");
    assert.equal(lists, 2);
    assert.equal(deletions.length, 2);
    assert.match(deletions[0], /stories\/user\/1.png/);
    assert.match(deletions[1], /stories\/user\/2.png/);
  } finally {
    client.destroy();
  }
});

test("partial storage deletion failure prevents successful account erasure", async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: "http://127.0.0.1:9999",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler: {
      async handle(request: { method: string; query?: Record<string, unknown>; body?: unknown }) {
        const body =
          request.method === "GET"
            ? "<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>stories/user/1.png</Key></Contents></ListBucketResult>"
            : "<DeleteResult><Error><Key>stories/user/1.png</Key><Code>AccessDenied</Code></Error></DeleteResult>";
        return {
          response: { statusCode: 200, headers: {}, body: Buffer.from(body) },
        };
      },
    },
  });
  try {
    await assert.rejects(
      deleteR2Prefix(client, "bucket", "stories/user/"),
      /erasure failed/,
    );
  } finally {
    client.destroy();
  }
});
