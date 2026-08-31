import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const appPath = path.resolve("release/mac-arm64/Model Codex.app");
if (!existsSync(appPath)) throw new Error(`Packaged app not found at ${appPath}`);
execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { stdio: "inherit" });
console.log(`Ad-hoc signed: ${appPath}`);
