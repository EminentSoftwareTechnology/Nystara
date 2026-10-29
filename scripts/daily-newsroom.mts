import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { londonRunDate } from "../prisma/newsroom/config";

const date = londonRunDate(new Date());
if (date) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  console.log(`${new Date().toISOString()}: starting London daily newsroom for ${date}`);
  const child = spawn(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "prisma/newsroom-seed.ts", `--date=${date}`, "--scheduled"], { cwd: root, stdio: "inherit" });
  child.on("error", () => { console.error("Unable to launch daily seed; resume manually."); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}
