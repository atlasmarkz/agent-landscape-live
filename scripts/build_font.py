"""Build the self-hosted CJK webfonts in two tiers.

The Noto Sans SC release ships as ~100 unicode-range parts per weight. They are
merged back into one font per weight and then subset with fontTools, which
produces a single small file that keeps real (non-synthetic) bold.

Two tiers are produced per weight:

  site      only the characters this site renders (tiny, always downloaded)
  fallback  the common-character safety net minus the site characters, given a
            precise unicode-range so the browser only downloads it when a
            character outside the site set actually shows up

Usage:
  python scripts/build_font.py <parts-dir> <site-charset> <common-charset> <out-dir>
"""
import glob
import os
import subprocess
import sys

from fontTools import merge

PARTS_DIR = sys.argv[1]
SITE_CHARSET = sys.argv[2]
COMMON_CHARSET = sys.argv[3]
OUT_DIR = sys.argv[4]
WEIGHTS = ["400", "700"]

os.makedirs(OUT_DIR, exist_ok=True)


def read_chars(path):
    with open(path, encoding="utf-8") as fh:
        return {c for c in fh.read() if ord(c) > 0x1f}


site = read_chars(SITE_CHARSET)
common = read_chars(COMMON_CHARSET)
extra = common - site
print(f"site chars: {len(site)}  safety net: {len(extra)} extra", flush=True)


def ranges_for(chars):
    """Collapse a character set into compact unicode-range notation."""
    cps = sorted(ord(c) for c in chars)
    out = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        out.append((start, prev))
        start = prev = cp
    out.append((start, prev))
    return ", ".join(f"U+{lo:X}" if lo == hi else f"U+{lo:X}-{hi:X}" for lo, hi in out)


def subset_font(src, text, out):
    tmp = out + ".tmp.woff2"
    chars_file = out + ".tmp.txt"
    with open(chars_file, "w", encoding="utf-8") as fh:
        fh.write(text)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            src,
            f"--text-file={chars_file}",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
            "--drop-tables+=DSIG",
            "--flavor=woff2",
            f"--output-file={tmp}",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    os.replace(tmp, out)
    os.remove(chars_file)
    return os.path.getsize(out) // 1024


for weight in WEIGHTS:
    files = sorted(glob.glob(os.path.join(PARTS_DIR, f"*-{weight}-normal.woff2")))
    if not files:
        continue
    print(f"merging weight {weight} ({len(files)} parts) ...", flush=True)

    options = merge.Options()
    options.verbose = False
    mega = merge.Merger(options=options).merge(files)

    merged = os.path.join(OUT_DIR, f"merged-{weight}.ttf")
    mega.save(merged)
    print(f"  merged: {os.path.getsize(merged) // 1024} KB", flush=True)

    site_out = os.path.join(OUT_DIR, f"noto-sans-sc-{weight}.woff2")
    size = subset_font(merged, "".join(sorted(site)), site_out)
    print(f"  {os.path.basename(site_out)}: {size} KB", flush=True)

    if extra:
        fb_out = os.path.join(OUT_DIR, f"noto-sans-sc-fallback-{weight}.woff2")
        size = subset_font(merged, "".join(sorted(extra)), fb_out)
        print(f"  {os.path.basename(fb_out)}: {size} KB", flush=True)

    os.remove(merged)

# ------------------------------------------------------------------- CSS
site_range = ranges_for(site)
extra_range = ranges_for(extra)

css = ["""/* Self-hosted Noto Sans SC subsets.
   - `site` carries every character the static copy renders.
   - `fallback` covers the common-character safety net; its unicode-range means
     the browser only fetches it when a character outside the site set appears
     (for example in a freshly fetched GitHub description). */"""]

for weight in WEIGHTS:
    if not os.path.exists(os.path.join(OUT_DIR, f"noto-sans-sc-{weight}.woff2")):
        continue
    css.append(
        f"""@font-face {{
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-display: swap;
  font-weight: {weight};
  src: url('./noto-sans-sc-{weight}.woff2') format('woff2');
  unicode-range: {site_range};
}}"""
    )
    if extra and os.path.exists(os.path.join(OUT_DIR, f"noto-sans-sc-fallback-{weight}.woff2")):
        css.append(
            f"""@font-face {{
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-display: swap;
  font-weight: {weight};
  src: url('./noto-sans-sc-fallback-{weight}.woff2') format('woff2');
  unicode-range: {extra_range};
}}"""
        )

with open(os.path.join(OUT_DIR, "noto-sans-sc.css"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(css) + "\n")

print("wrote noto-sans-sc.css")
