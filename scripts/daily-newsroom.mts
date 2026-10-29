import { open, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { londonRunDate } from "../prisma/newsroom/config";

const date = londonRunDate(new Date());
if (date) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const state = path.join(root, ".cache/newsroom/scheduled");
  await mkdir(state, { recursive: true });
  let marker;
  try {
    marker = await open(path.join(state, `${date}.attempted`), "wx", 0o600);
  } catch (cause) {
    if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) throw cause;
  }
  if (marker) {
    await marker.close();
    console.log(`${new Date().toISOString()}: starting London daily newsroom for ${date}`);
    const child = spawn(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "prisma/newsroom-seed.ts", `--date=${date}`], { cwd: root, stdio: "inherit" });
    child.on("error", () => { console.error("Unable to launch daily seed; resume manually."); process.exitCode = 1; });
    child.on("exit", (code) => { process.exitCode = code ?? 1; });
  }
}
