import { rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
for (const name of ["dist", "dist-electron"]) {
  const target = path.resolve(projectRoot, name);
  if (path.dirname(target) !== projectRoot) throw new Error(`Refusing to clean unexpected path: ${target}`);
  await rm(target, { recursive: true, force: true });
}
