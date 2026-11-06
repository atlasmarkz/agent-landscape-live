# -*- coding: utf-8 -*-
"""Export the architecture SVG to vector PDFs (native size + A1 poster)."""
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SVG = HERE / "agent-architecture.svg"
svg_text = SVG.read_text(encoding="utf-8")

# strip XML declaration for inline embedding
if svg_text.startswith("<?xml"):
    svg_text = svg_text.split("?>", 1)[1].lstrip()

def html_for(page_w, page_h, svg_w, svg_h):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
@page {{ size: {page_w} {page_h}; margin: 0; }}
html, body {{ margin:0; padding:0; width:{page_w}; height:{page_h}; background:#F4F5F7; }}
#wrap {{ width:{page_w}; height:{page_h}; display:flex; align-items:center; justify-content:center; }}
svg {{ width:{svg_w}; height:{svg_h}; display:block; }}
</style></head><body><div id="wrap">{svg_text}</div></body></html>"""

jobs = [
    ("agent-architecture.pdf", "30in", "50.4167in", "30in", "50.4167in"),
    ("agent-architecture-a1.pdf", "594mm", "841mm", "500.43mm", "841mm"),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, pw, ph, sw, sh in jobs:
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.set_content(html_for(pw, ph, sw, sh), wait_until="load")
        page.emulate_media(media="print")
        page.evaluate("document.fonts.ready")
        out = HERE / name
        page.pdf(
            path=str(out),
            width=pw,
            height=ph,
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True,
        )
        page.close()
        print(out, out.stat().st_size // 1024, "KB")
    browser.close()
