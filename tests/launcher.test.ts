import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, symlinkSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

test("launcher treats dotenv as data, honors overrides and passes the requested port", () => {
  const root = mkdtempSync(join(tmpdir(), "nystara-launcher-"));
  try {
    mkdirSync(join(root, "scripts")); mkdirSync(join(root, "bin"));
    cpSync("start.sh", join(root, "start.sh"));
    cpSync("scripts/start.mjs", join(root, "scripts/start.mjs"));
    symlinkSync(resolve("node_modules"), join(root, "node_modules"));
    const sentinel = join(root, "must-not-execute");
    writeFileSync(join(root, ".env"), `UNTRUSTED='$(touch ${sentinel})'\nPORT=3000\n`);
    writeFileSync(join(root, ".env.local"), [
      "PORT=4567", "DATABASE_URL=postgresql://local:local@127.0.0.1:5432/local",
      "NEXTAUTH_URL=http://127.0.0.1:4567", "NEXTAUTH_SECRET=launcher-only-auth-secret-32-characters-long",
      "ADMIN_JWT_SECRET=launcher-only-admin-secret-32-characters-long",
    ].join("\n"));
    writeFileSync(join(root, "bin/docker"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(root, "bin/npm"), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${join(root, "commands")}'\n`, { mode: 0o755 });
    const env: NodeJS.ProcessEnv = { ...process.env, CONTAINER_ENGINE: "docker", PATH: `${join(root, "bin")}:${dirname(process.execPath)}:${process.env.PATH}` };
    delete env.PORT;
    const result = spawnSync("bash", ["start.sh", "dev"], { cwd: root, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(sentinel), false);
    assert.match(readFileSync(join(root, "commands"), "utf8"), /run dev -- --hostname 127.0.0.1 --port 4567/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
