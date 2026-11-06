from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets" / "og.png"

stages = [
    ("00", "评测与任务定义", "#6E56CF"),
    ("01", "算力与基础设施", "#3B82F6"),
    ("02", "训练与后训练", "#F97316"),
    ("03", "模型与架构", "#10B981"),
    ("04", "推理与服务", "#06B6D4"),
    ("05", "Harness 与运行时", "#EC4899"),
    ("06", "Agent 平台与框架", "#8B5CF6"),
    ("07", "安全与对齐", "#EF4444"),
    ("08", "可观测与运维", "#84CC16"),
]

rows = "\n".join(
    f'<div class="row"><span class="dot" style="background:{c}"></span><span class="num">{n}</span><span class="name">{name}</span><span class="bar"><i style="width:{45 + i * 6}%;background:{c}"></i></span></div>'
    for i, (n, name, c) in enumerate(stages)
)

html = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
  * {{ box-sizing: border-box; }}
  html, body {{ margin:0; width:1200px; height:630px; overflow:hidden; }}
  body {{
    font-family: "Inter", "PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif;
    color:#fff;
    background:
      radial-gradient(70% 90% at 82% 0%, rgba(91,91,214,.38), transparent 62%),
      radial-gradient(55% 70% at 0% 100%, rgba(0,168,143,.2), transparent 64%),
      #0b0d14;
    position:relative;
  }}
  body::before {{
    content:""; position:absolute; inset:0;
    background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size: 30px 30px;
    mask-image: radial-gradient(80% 80% at 50% 40%, #000, transparent 76%);
  }}
  .wrap {{ position:relative; z-index:1; padding:54px 62px; height:100%; display:flex; flex-direction:column; }}
  .top {{ display:flex; align-items:center; justify-content:space-between; }}
  .brand {{ display:flex; align-items:center; gap:12px; }}
  .mark {{ width:40px; height:40px; }}
  .brand strong {{ display:block; font-size:16px; letter-spacing:-.02em; }}
  .brand span {{ display:block; margin-top:4px; font-family:monospace; font-size:8px; letter-spacing:.2em; color:rgba(255,255,255,.42); }}
  .pill {{ display:flex; align-items:center; gap:7px; padding:7px 11px; border:1px solid rgba(255,255,255,.14); border-radius:999px; font-family:monospace; font-size:9px; letter-spacing:.1em; color:rgba(255,255,255,.55); }}
  .pill i {{ width:6px; height:6px; border-radius:50%; background:#6ee7d8; box-shadow:0 0 14px #6ee7d8; }}
  .main {{ display:flex; gap:54px; align-items:center; flex:1; }}
  .left {{ flex:1; min-width:0; }}
  h1 {{ margin:0; font-size:78px; line-height:.95; letter-spacing:-.065em; font-weight:800; }}
  h1 .grad {{ background:linear-gradient(112deg,#8b8cf7,#6ee7d8 58%,#ffb86b); -webkit-background-clip:text; background-clip:text; color:transparent; }}
  .sub {{ margin:24px 0 0; max-width:540px; font-size:15px; line-height:1.65; color:rgba(255,255,255,.56); }}
  .stats {{ display:flex; gap:0; margin-top:34px; padding-top:20px; border-top:1px solid rgba(255,255,255,.11); max-width:520px; }}
  .stats div {{ padding:0 24px; border-left:1px solid rgba(255,255,255,.11); }}
  .stats div:first-child {{ padding-left:0; border-left:0; }}
  .stats strong {{ display:block; font-size:26px; line-height:1; letter-spacing:-.04em; }}
  .stats span {{ display:block; margin-top:6px; font-size:9px; letter-spacing:.08em; color:rgba(255,255,255,.38); }}
  .panel {{ width:430px; flex-shrink:0; padding:18px; border:1px solid rgba(255,255,255,.1); border-radius:18px; background:rgba(255,255,255,.035); backdrop-filter:blur(10px); box-shadow:0 30px 80px rgba(0,0,0,.25); }}
  .panel-head {{ display:flex; justify-content:space-between; font-family:monospace; font-size:8px; letter-spacing:.12em; color:rgba(255,255,255,.35); padding:0 4px 12px; border-bottom:1px solid rgba(255,255,255,.08); }}
  .rows {{ display:flex; flex-direction:column; gap:5px; padding-top:12px; }}
  .row {{ display:grid; grid-template-columns:7px 20px 1fr 74px; gap:8px; align-items:center; padding:7px 8px; border-radius:7px; background:rgba(255,255,255,.028); }}
  .dot {{ width:5px; height:5px; border-radius:50%; }}
  .num {{ font-family:monospace; font-size:7px; color:rgba(255,255,255,.3); }}
  .name {{ font-size:9.5px; color:rgba(255,255,255,.72); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
  .bar {{ height:3px; border-radius:99px; background:rgba(255,255,255,.08); overflow:hidden; }}
  .bar i {{ display:block; height:100%; border-radius:99px; }}
  .bottom {{ display:flex; justify-content:space-between; align-items:center; padding-top:16px; border-top:1px solid rgba(255,255,255,.1); font-family:monospace; font-size:9px; letter-spacing:.08em; color:rgba(255,255,255,.34); }}
  .bottom b {{ font-weight:400; color:rgba(255,255,255,.62); }}
</style></head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <svg class="mark" viewBox="0 0 64 64" fill="none"><rect x="2" y="2" width="60" height="60" rx="17" fill="#fff" fill-opacity=".06" stroke="rgba(255,255,255,.16)"/><path d="M20 23 32 16l12 7v18l-12 7-12-7V23Z" stroke="#8B8CF7" stroke-width="2.2"/><path d="M20 23 32 32l12-9M32 32v16" stroke="#fff" stroke-opacity=".35" stroke-width="1.8"/><circle cx="20" cy="23" r="4" fill="#6EE7D8"/><circle cx="44" cy="23" r="4" fill="#FFB86B"/><circle cx="32" cy="48" r="4" fill="#FF7A8A"/><circle cx="32" cy="32" r="3.2" fill="#fff"/></svg>
        <div><strong>Agent Landscape</strong><span>LIVE INDEX · 2026</span></div>
      </div>
      <div class="pill"><i></i> LIVE GITHUB INDEX</div>
    </div>
    <div class="main">
      <div class="left">
        <h1>Agent 全链路<br><span class="grad">活索引</span></h1>
        <p class="sub">从 GPU、训练、模型、推理，到 Harness、Agent 平台、安全与可观测性。9 层架构，100 个精选项目，以及每 6 小时刷新的热门与新锐榜单。</p>
        <div class="stats">
          <div><strong>9</strong><span>技术层</span></div>
          <div><strong>100</strong><span>精选仓库</span></div>
          <div><strong>45</strong><span>实时查询</span></div>
          <div><strong>6h</strong><span>自动刷新</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><span>LIVE SIGNAL MAP</span><span>9 LAYERS</span></div>
        <div class="rows">{rows}</div>
      </div>
    </div>
    <div class="bottom"><span><b>github.com/atlasmarkz/agent-landscape-live</b></span><span>GITHUB PAGES · ACTIONS CRON</span></div>
  </div>
</body></html>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.set_content(html, wait_until="load")
    page.evaluate("document.fonts.ready")
    page.screenshot(path=str(OUT), full_page=False)
    browser.close()

print(OUT, OUT.stat().st_size // 1024, "KB")
