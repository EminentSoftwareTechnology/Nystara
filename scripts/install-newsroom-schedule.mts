import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeXml } from "../prisma/newsroom/content";

if (process.platform !== "darwin") throw new Error("This installer uses macOS launchd");
const root = fileURLToPath(new URL("../", import.meta.url));
const label = "com.nystara.newsroom";
const target = path.join(homedir(), "Library/LaunchAgents", `${label}.plist`);
const logs = path.join(root, ".cache/newsroom/daily.log");
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${escapeXml(process.execPath)}</string><string>--import</string><string>tsx</string><string>${escapeXml(path.join(root, "scripts/daily-newsroom.mts"))}</string></array>
<key>WorkingDirectory</key><string>${escapeXml(root)}</string>
<key>StartCalendarInterval</key><dict><key>Minute</key><integer>0</integer></dict>
<key>StandardOutPath</key><string>${escapeXml(logs)}</string>
<key>StandardErrorPath</key><string>${escapeXml(logs)}</string>
</dict></plist>
`;
let existing: string | undefined;
try { existing = await readFile(target, "utf8"); } catch (cause) {
  if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT")) throw cause;
}
if (existing && existing !== plist) throw new Error(`Existing launch agent differs; review ${target} before replacing it`);
await mkdir(path.dirname(target), { recursive: true });
await mkdir(path.dirname(logs), { recursive: true });
await writeFile(target, plist, { mode: 0o600 });
execFileSync("/usr/bin/plutil", ["-lint", target], { stdio: "inherit" });
const domain = `gui/${userInfo().uid}`;
try { execFileSync("/bin/launchctl", ["print", `${domain}/${label}`], { stdio: "ignore" }); } catch {
  execFileSync("/bin/launchctl", ["bootstrap", domain, target], { stdio: "inherit" });
}
console.log(`Installed ${target}: hourly check, seed once at 07:00 Europe/London; logs ${logs}`);
