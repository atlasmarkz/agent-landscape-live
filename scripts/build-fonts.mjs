// Build the self-hosted font stack:
//   1. Inter Variable        -> latin + digits (UI, headings)
//   2. JetBrains Mono Var.   -> latin mono (labels, stats)
//   3. Noto Sans SC subset   -> the hanzi this site actually renders
//
// The CJK subset is built locally: the Noto Sans SC release ships as ~100
// unicode-range parts, which are merged and then subset with fontTools down to
// the site charset plus a 2500-hanzi common-character safety net.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = path.join(ROOT, "assets", "fonts");
const TMP = path.join(ROOT, ".fontbuild");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

await fs.mkdir(TMP, { recursive: true });

// ------------------------------------------------------------- charset
const site = await fs.readFile(path.join(ROOT, "scripts", "subset-charset.txt"), "utf8");

// Common hanzi safety net (grouped by stroke count) so descriptions fetched
// from GitHub later still render in the webfont.
const table = require(path.join(TMP, "common-2500.cjs"));
const common = Object.values(table.字表 || table).join("");

// Only clear the output once the inputs are known to be present, so a failed
// build doesn't leave the site without fonts.
await fs.rm(FONTS, { recursive: true, force: true });
await fs.mkdir(FONTS, { recursive: true });

const clean = (s) =>
  [...new Set(s.split(""))].filter((c) => {
    const cp = c.codePointAt(0);
    if (cp < 0x20) return false;
    if (cp >= 0xd800 && cp <= 0xdfff) return false;
    return true;
  });

const siteFile = path.join(TMP, "charset-site.txt");
const commonFile = path.join(TMP, "charset-common.txt");
await fs.writeFile(siteFile, clean(site).join(""), "utf8");
await fs.writeFile(commonFile, clean(site + common).join(""), "utf8");
console.log("site charset:", clean(site).length, "| with safety net:", clean(site + common).length);

// ------------------------------------------------------- source font parts
// The static package carries every weight (100-900) as its own unicode-range
// parts; merging them per weight and subsetting keeps real bold weights.
const partsDir = path.join(TMP, "nsc-parts");
if (!(await fs.stat(partsDir).catch(() => null))) {
  await fs.mkdir(partsDir, { recursive: true });
  console.log("fetching @fontsource/noto-sans-sc ...");
  const npmCli = path.join(process.env.APPDATA || "", "..", "..", "node_modules", "npm", "bin", "npm-cli.js");
  const npmEntry = (await fs.stat(npmCli).catch(() => null)) ? npmCli : "npm";
  await exec(npmEntry, ["pack", "@fontsource/noto-sans-sc@5.3.1", "--pack-destination", partsDir], {
    cwd: TMP,
    shell: process.platform === "win32" && npmEntry === "npm",
  });
  const tgz = (await fs.readdir(partsDir)).find((f) => f.endsWith(".tgz"));
  await exec("tar", ["-xzf", path.join(partsDir, tgz), "-C", partsDir]);
}

const srcFiles = path.join(partsDir, "package", "files");
await exec("python", [
  path.join(ROOT, "scripts", "build_font.py"),
  srcFiles,
  siteFile,
  commonFile,
  FONTS,
]);
console.log("Noto Sans SC ->", FONTS);

// ------------------------------------------------------------ latin fonts
async function download(url, out) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(out, buf);
  console.log(out.split(path.sep).pop(), (buf.length / 1024).toFixed(1), "KB");
}

await download(
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  path.join(FONTS, "inter-latin.woff2")
);
await download(
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  path.join(FONTS, "jetbrains-mono-latin.woff2")
);

// ------------------------------------------------------------- verification
await exec("python", [
  "-c",
  `from fontTools.ttLib import TTFont
import glob, os
for f in sorted(glob.glob(r"${FONTS.replace(/\\/g, "\\\\")}\\\\*.woff2")):
    font = TTFont(f)
    cmap = font.getBestCmap()
    print(os.path.basename(f), "| glyphs:", len(cmap), "| variable:", "fvar" in font, "|", os.path.getsize(f)//1024, "KB")
`,
]);

// License files travel with the fonts.
await fs.writeFile(
  path.join(FONTS, "LICENSE.txt"),
  [
    "Inter — SIL Open Font License 1.1 (Rasmus Andersson)",
    "JetBrains Mono — SIL Open Font License 1.1 (JetBrains)",
    "Noto Sans SC — SIL Open Font License 1.1 (Google)",
    "",
    "All three families are licensed under the SIL Open Font License 1.1.",
    "The CJK file is a subset restricted to the characters this site renders.",
  ].join("\n"),
  "utf8"
);

let total = 0;
for (const f of await fs.readdir(FONTS)) {
  total += (await fs.stat(path.join(FONTS, f))).size;
}
console.log("total fonts:", (total / 1024).toFixed(1), "KB");
