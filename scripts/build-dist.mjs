// Build the static artifact that gets deployed to Cloudflare Pages.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });

await fs.copyFile(path.join(ROOT, "index.html"), path.join(DIST, "index.html"));
await fs.cp(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });
await fs.cp(path.join(ROOT, "data"), path.join(DIST, "data"), { recursive: true });

console.log(`dist ready: ${DIST}`);
