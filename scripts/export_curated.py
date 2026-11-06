# -*- coding: utf-8 -*-
"""Export the architecture diagram's stage/repo data to data/curated.json."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DIAGRAM = ROOT / "architecture"
sys.path.insert(0, str(DIAGRAM))

import build_svg  # noqa: E402  (imports the stage data; also rebuilds the SVG)

ID = {
    "00": ("eval", "评测"),
    "01": ("infra", "算力"),
    "02": ("training", "训练"),
    "03": ("model", "模型"),
    "04": ("serving", "推理"),
    "05": ("harness", "Harness"),
    "06": ("platform", "平台"),
    "07": ("security", "安全"),
    "08": ("observability", "观测"),
}

stages = []
for s in build_svg.stages:
    sid, short = ID[s["num"]]
    stages.append({
        "id": sid,
        "num": s["num"],
        "title": s["title"],
        "short": short,
        "color": s["color"],
        "goal": " ".join(s["goal"]),
        "repos": s["repos"],
    })

payload = {
    "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "totalRepos": sum(len(s["repos"]) for s in stages),
    "stages": stages,
}

out = ROOT / "data" / "curated.json"
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(out, payload["totalRepos"], "repos")
