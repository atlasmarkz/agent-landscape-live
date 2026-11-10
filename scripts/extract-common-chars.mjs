// Extract the common-2500 hanzi table (grouped by stroke count) into a
// CommonJS module so the font build can consume it as a safety net.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(ROOT, ".fontbuild");
await fs.mkdir(TMP, { recursive: true });

// The package ships `2500.js` as an ESM module; convert it to CJS so Node can
// require() it without a package.json type field in the temp dir.
// `npm pack` is not spawnable as a bare command on Windows, so resolve the
// shim to the real npm-cli.js first.
const pkg = path.join(TMP, "cc-pkg");
await fs.rm(pkg, { recursive: true, force: true });
await fs.mkdir(pkg, { recursive: true });

const npmCli = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js"
);
const npmEntry = (await fs.stat(npmCli).catch(() => null))
  ? npmCli
  : path.join(process.env.APPDATA || "", "..", "..", "node_modules", "npm", "bin", "npm-cli.js");

const packArgs = ["pack", "common-chinese-characters@0.0.3", "--pack-destination", pkg];
if (process.platform === "win32") {
  await exec(process.execPath, [npmEntry, ...packArgs], { cwd: TMP, shell: false });
} else {
  await exec("npm", packArgs, { cwd: TMP });
}
const tgz = (await fs.readdir(pkg)).find((f) => f.endsWith(".tgz"));
if (!tgz) throw new Error("npm pack produced no tarball");
await exec("tar", ["-xzf", path.join(pkg, tgz), "-C", pkg]);

const src = await fs.readFile(path.join(pkg, "package", "2500.js"), "utf8");
const cjs = src.replace(/^export\s+default\s+/m, "module.exports = ").replace(/^const 字表/m, "const 字表");
const out = path.join(TMP, "common-2500.cjs");
await fs.writeFile(out, cjs, "utf8");
console.log("wrote", out, cjs.length, "bytes");
