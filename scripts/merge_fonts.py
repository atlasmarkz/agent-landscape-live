"""Merge the Noto Sans SC unicode-range parts into one font, then subset it.

The parts share a single glyf/cmap design, so merging them yields a font with
the full character set; subsetting then drops everything this site never uses.
"""
import glob
import os
import sys
import traceback

from fontTools import merge
from fontTools.ttLib import TTFont

SRC = sys.argv[1]          # directory of woff2 parts
CHARSET = sys.argv[2]      # file with the characters to keep
OUT = sys.argv[3]          # output base path
WEIGHT = sys.argv[4] if len(sys.argv) > 4 else "400"

parts = sorted(glob.glob(os.path.join(SRC, f"*{WEIGHT}-normal.woff2")))
if not parts:
    raise SystemExit(f"no parts matching *{WEIGHT}-normal.woff2 in {SRC}")
print("parts:", len(parts))

options = merge.Options()
options.verbose = True
m = merge.Merger(options=options)

try:
    mega = m.merge(parts)
except Exception:
    traceback.print_exc()
    raise SystemExit("merge failed")

out_ttf = OUT + ".ttf"
mega.save(out_ttf)
print("merged saved:", os.path.getsize(out_ttf) // 1024, "KB")
