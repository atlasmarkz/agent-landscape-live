# -*- coding: utf-8 -*-
"""Generate a Figma-importable, editable SVG architecture board."""
import os
import json

W, H = 2880, 4840
INK = "#18181B"; INK2 = "#5F5F6B"; INK3 = "#8A8A95"; LINE = "#E5E5EA"
SOFT = "#FAFAFB"; WHITE = "#FFFFFF"
C0 = "#6E56CF"; C1 = "#0D99FF"; C2 = "#14AE5C"; C3 = "#F24E1E"
C4 = "#FFA629"; C5 = "#D946EF"; C6 = "#EF4444"; C7 = "#0F766E"
C8 = "#65A30D"

out = []
def add(s): out.append(s)
def esc(t): return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def tint(h, a):
    r, g, b = rgb(h)
    return "#%02X%02X%02X" % (round(255+(r-255)*a), round(255+(g-255)*a), round(255+(b-255)*a))

def T(x, y, s, size=13, fill=INK, weight=400, anchor="start", ls=None, opacity=None):
    a = ['x="%s"' % x, 'y="%s"' % y, 'font-size="%s"' % size, 'fill="%s"' % fill, 'font-weight="%s"' % weight]
    if anchor != "start": a.append('text-anchor="%s"' % anchor)
    if ls is not None: a.append('letter-spacing="%s"' % ls)
    if opacity is not None: a.append('fill-opacity="%s"' % opacity)
    add('<text %s>%s</text>' % (" ".join(a), esc(s)))

def R(x, y, w, h, fill, stroke=None, rx=0, sw=1, opacity=None):
    a = ['x="%s"' % x, 'y="%s"' % y, 'width="%s"' % w, 'height="%s"' % h, 'fill="%s"' % fill]
    if stroke: a.append('stroke="%s" stroke-width="%s"' % (stroke, sw))
    if rx: a.append('rx="%s"' % rx)
    if opacity is not None: a.append('fill-opacity="%s"' % opacity)
    add('<rect %s/>' % " ".join(a))

def L(x1, y1, x2, y2, color=LINE, sw=1, dash=None):
    a = ['x1="%s"' % x1, 'y1="%s"' % y1, 'x2="%s"' % x2, 'y2="%s"' % y2, 'stroke="%s"' % color, 'stroke-width="%s"' % sw]
    if dash: a.append('stroke-dasharray="%s"' % dash)
    add('<line %s/>' % " ".join(a))

def tri(x, y, direction, color, size=7):
    if direction == "right": p = "%s,%s %s,%s %s,%s" % (x, y, x-size, y-size/1.7, x-size, y+size/1.7)
    elif direction == "up": p = "%s,%s %s,%s %s,%s" % (x, y, x-size/1.7, y+size, x+size/1.7, y+size)
    else: p = "%s,%s %s,%s %s,%s" % (x, y, x-size/1.7, y-size, x+size/1.7, y-size)
    add('<polygon points="%s" fill="%s"/>' % (p, color))

stages = []

stages.append({
 "num": "00", "title": "评测与任务定义", "color": C0,
 "goal": ["先定义“什么算完成”，再谈模型"],
 "y": 330, "h": 300, "cols": 3, "box_h": 105,
 "boxes": [
  ("任务域", ["Coding · 终端 · 浏览器 · 客服", "Deep Research · 数据分析"]),
  ("公开基准", ["SWE-bench Verified · Terminal-Bench", "OSWorld · WebArena · GAIA · τ-bench"]),
  ("私有 Eval", ["黄金集 · 回归集 · 对抗集", "线上失败回流 → 新用例"]),
  ("核心指标", ["任务成功率 · 步数 · $/task", "P95 时延 · 人工接管率"]),
  ("发布门禁", ["离线回归 + 在线 canary", "A/B · 自动回滚"]),
  ("评测驱动开发", ["先写 eval，再写 prompt / 训模型", "每个失败都变成测试用例"]),
 ],
 "repos": ["openai/evals", "EleutherAI/lm-evaluation-harness", "UKGovernmentBEIS/inspect_ai",
           "SWE-bench/SWE-bench", "web-arena-x/webarena", "sierra-research/tau-bench",
           "THUDM/AgentBench", "huggingface/lighteval"],
})

stages.append({
 "num": "01", "title": "算力与集群", "color": C1,
 "goal": ["稳定、可调度、可恢复的算力底座"],
 "y": 658, "h": 350, "cols": 3, "box_h": 130,
 "boxes": [
  ("GPU 节点", ["H100 / H200 / B200 / GB200", "NVLink / NVSwitch · 液冷"]),
  ("集群网络", ["InfiniBand NDR/XDR · RoCEv2", "rail-optimized · 无损 · 拥塞控制"]),
  ("存储", ["Lustre / WEKA / GPFS 并行文件系统", "对象存储 · checkpoint TB/s 写入"]),
  ("调度", ["Slurm / K8s + Volcano / Kueue", "gang scheduling · 拓扑感知 · 配额"]),
  ("可靠性", ["NCCL watchdog · XID/ECC 监控", "静默错误检测 · 异步 ckpt · 弹性训练"]),
  ("三池隔离", ["预训练 / RL rollout / 在线推理", "电力 · 散热 · 容量规划"]),
 ],
 "repos": ["NVIDIA/nccl", "NVIDIA/gpu-operator", "volcano-sh/volcano", "kubernetes-sigs/kueue",
           "ray-project/ray", "NVIDIA/DCGM", "ofiwg/libfabric", "kubeflow/training-operator"],
 "repo_note": "万卡集群的瓶颈通常在网络与存储",
})

stages.append({
 "num": "02", "title": "数据与训练", "color": C2,
 "goal": ["Agent 能力的真正来源：", "数据 × 环境 × RL"],
 "y": 1036, "h": 500, "cols": 3, "box_h": 130,
 "boxes": [
  ("预训练语料", ["网页 · 代码 · 数学 · 多语", "去重 · 质量分类 · benchmark 去污染"]),
  ("中期训练", ["32k → 256k / 1M 长上下文", "工具调用格式 · 合成 Agent 轨迹"]),
  ("SFT", ["专家 plan-act-observe 轨迹", "失败恢复 · 拒绝采样"]),
  ("偏好优化", ["DPO / RLHF", "有用性 · 安全性 · 风格"]),
  ("RLVR", ["单测通过 · 数学对答案", "规则奖励 · 防 reward hacking"]),
  ("Agentic RL", ["环境 rollout · 异步采样", "off-policy 修正 · 成功率 + 效率"]),
  ("环境工场", ["浏览器 / 终端 / IDE / API mock", "可重置 · 可判定 · 万级并发"]),
  ("训练栈", ["Megatron / FSDP2 / DeepSpeed", "FP8 · 序列并行 · 激活重算"]),
  ("训练中评测", ["held-out 私有集 · 失败分类", "checkpoint 选择 · 回归门禁"]),
 ],
 "repos": ["huggingface/datatrove", "allenai/dolma", "NVIDIA/NeMo-Curator", "modelscope/data-juicer",
           "NVIDIA/Megatron-LM", "pytorch/torchtitan", "deepspeedai/DeepSpeed", "volcengine/verl",
           "OpenRLHF/OpenRLHF", "huggingface/trl", "NovaSky-AI/SkyRL", "inclusionAI/AReaL",
           "unslothai/unsloth", "axolotl-ai-cloud/axolotl",
           "firecracker-microvm/firecracker", "e2b-dev/E2B"],
 "repo_note": "环境与轨迹数据 = Agent 时代的护城河",
})

stages.append({
 "num": "03", "title": "模型设计", "color": C3,
 "goal": ["围绕 Agent 场景做架构与能力取舍"],
 "y": 1564, "h": 340, "cols": 3, "box_h": 125,
 "boxes": [
  ("架构选择", ["Dense vs MoE · GQA / MLA", "128k–1M context · KV 成本"]),
  ("推理能力", ["长 CoT · 可控 thinking budget", "自检 · 回溯 · 计划分解"]),
  ("工具原生", ["tool-call 格式进训练分布", "JSON Schema · 并行调用"]),
  ("多模态", ["截图理解 · GUI grounding", "坐标输出 · OCR"]),
  ("模型梯队", ["旗舰 + 蒸馏小模型", "路由器按任务难度分流"]),
  ("开源基座", ["Qwen3 · Llama · DeepSeek-V3", "Gemma · Mistral · MiniCPM"]),
 ],
 "repos": ["QwenLM/Qwen3", "meta-llama/llama-models", "deepseek-ai/DeepSeek-V3",
           "huggingface/transformers", "Dao-AILab/flash-attention", "deepseek-ai/DeepEP",
           "NVIDIA/TransformerEngine", "huggingface/tokenizers"],
 "repo_note": "架构选择决定推理成本的上限",
})

stages.append({
 "num": "04", "title": "推理服务", "color": C4,
 "goal": ["把权重变成低延迟、低成本的 Token"],
 "y": 1932, "h": 440, "cols": 3, "box_h": 145,
 "boxes": [
  ("推理引擎", ["vLLM · SGLang", "TensorRT-LLM · LMDeploy"]),
  ("批处理", ["continuous batching", "chunked prefill · prefix caching"]),
  ("KV Cache", ["PagedAttention · PD 分离", "HBM → DRAM → SSD 分层"]),
  ("解码加速", ["投机解码 · FP8 / INT4", "MoE EP · CUDA Graph"]),
  ("网关路由", ["模型级联 · 会话粘性", "限流 · 多副本 · 多区域"]),
  ("SLO", ["TTFT · TPOT · cache hit", "$/task · P99 · 可用性"]),
 ],
 "callout": {"offset": 354, "h": 52,
             "lead": "成本关键：",
             "body": "Agent 负载 = 长 system prompt + 多轮工具调用 → prefix cache 命中率直接决定单位成本"},
 "repos": ["vllm-project/vllm", "sgl-project/sglang", "NVIDIA/TensorRT-LLM", "InternLM/lmdeploy",
           "LMCache/LMCache", "ai-dynamo/dynamo", "NVIDIA/Triton-Inference-Server",
           "BerriAI/litellm", "ggml-org/llama.cpp", "ollama/ollama",
           "huggingface/text-generation-inference", "llm-d/llm-d"],
 "repo_note": "prefix cache 是 Agent 推理的命门",
})

stages.append({
 "num": "05", "title": "Agent Harness", "color": C5,
 "goal": ["模型之外的体验分水岭"],
 "y": 2400, "h": 520, "cols": 3, "box_h": 160,
 "boxes": [
  ("Agent Loop", ["observe → plan → act → observe", "步数 / token / 时间预算 · 取消与恢复"]),
  ("上下文工程", ["系统提示 · 工具描述 · 压缩/摘要", "长期记忆 · 子 Agent · RAG"]),
  ("工具层", ["JSON Schema · 幂等 · 超时/重试", "给模型看的可读错误 · 权限"]),
  ("沙箱", ["Firecracker / gVisor · 快照恢复", "网络出口白名单 · 资源限额"]),
  ("编排", ["durable execution · 队列", "human-in-the-loop · 审批"]),
  ("输出控制", ["grammar / JSON 约束解码", "流式 SSE · 引用 · 审计"]),
 ],
 "callout": {"offset": 386, "h": 76,
             "lead": "体验分水岭：",
             "body": "同一模型，工具设计与上下文管理可带来数倍任务成功率差异",
             "body2": "评估重点：长任务完成率 · 工具调用正确率 · 失败恢复 · $/task"},
 "repos": ["langchain-ai/langgraph", "openai/openai-agents-python", "huggingface/smolagents",
           "microsoft/autogen", "SWE-agent/SWE-agent", "All-Hands-AI/OpenHands",
           "browser-use/browser-use", "modelcontextprotocol/servers", "microsoft/playwright-mcp",
           "mem0ai/mem0", "letta-ai/letta", "temporalio/temporal", "google/gvisor",
           "sst/opencode", "cline/cline", "block/goose"],
 "repo_note": "Harness 迭代速度 > 模型换代速度",
})

stages.append({
 "num": "06", "title": "Agent 平台与框架", "color": C8,
 "goal": ["把原型变成可运营的产品", "低代码与代码优先两条路线"],
 "y": 2948, "h": 480, "cols": 3, "box_h": 130,
 "boxes": [
  ("代码优先框架", ["LangGraph · OpenAI Agents SDK", "Pydantic AI · Mastra · Agno"]),
  ("多 Agent 协作", ["AutoGen · CrewAI", "Semantic Kernel · Google ADK"]),
  ("低代码编排", ["Dify · Coze · n8n", "Langflow · Flowise"]),
  ("RAG 与知识库", ["RAGFlow · FastGPT · LlamaIndex", "Haystack · 文档解析 · 混合检索"]),
  ("发布与运营", ["Web / API / SDK · 多渠道", "多租户 · RBAC · SSO"]),
  ("协议与集成", ["MCP · A2A · OpenAPI · OAuth", "插件市场 · 模板 DSL"]),
 ],
 "callout": {"offset": 330, "h": 76,
             "lead": "选型分叉：",
             "body": "Dify / Coze / n8n 适合快速交付；LangGraph / OpenAI Agents SDK 适合深水区",
             "body2": "企业常见组合 = 低代码编排 + 自建 Harness + 私有模型"},
 "repos": ["langgenius/dify", "coze-dev/coze-studio", "n8n-io/n8n", "langflow-ai/langflow",
           "FlowiseAI/Flowise", "infiniflow/ragflow", "labring/FastGPT", "open-webui/open-webui",
           "danny-avila/LibreChat", "run-llama/llama_index", "deepset-ai/haystack",
           "microsoft/semantic-kernel", "pydantic/pydantic-ai", "google/adk-python",
           "mastra-ai/mastra", "agno-agi/agno"],
})

stages.append({
 "num": "07", "title": "安全与权限", "color": C6,
 "goal": ["能执行代码和转账时，", "安全不是附加项"],
 "y": 3456, "h": 300, "cols": 4, "box_h": 100,
 "badge": "CROSS-CUTTING",
 "boxes": [
  ("最小权限", ["工具白名单 · 短期凭证", "按租户 / 会话隔离"]),
  ("策略引擎", ["OPA 策略 · 出站管控", "配额 · 审批流"]),
  ("注入防御", ["不可信内容隔离 · 双 LLM", "URL / 文件 / 网页沙箱"]),
  ("动作确认", ["高风险操作二次确认", "转账 / 删除 / 发布"]),
  ("数据安全", ["PII 脱敏 · 留存策略", "数据出境 · 密钥托管"]),
  ("审计", ["全量动作日志", "可追溯 · 可回放"]),
  ("持续红队", ["garak · promptfoo", "注入 / 越狱 / 工具滥用"]),
  ("供应链", ["依赖扫描 · 模型来源", "镜像签名 · SBOM"]),
 ],
 "repos": ["guardrails-ai/guardrails", "NVIDIA/NeMo-Guardrails", "meta-llama/PurpleLlama",
           "microsoft/presidio", "promptfoo/promptfoo", "NVIDIA/garak",
           "protectai/rebuff", "open-policy-agent/opa"],
})

stages.append({
 "num": "08", "title": "观测与数据飞轮", "color": C7,
 "goal": ["让每一次生产调用", "变成下一轮训练数据"],
 "y": 3784, "h": 340, "cols": 4, "box_h": 120,
 "badge": "DATA FLYWHEEL",
 "boxes": [
  ("全链路 Trace", ["每步 token · 时延", "工具结果 · 成本"]),
  ("任务指标", ["成功率 · 步数 · 接管率", "$/task · 失败分类"]),
  ("成本核算", ["token 明细 · 缓存命中", "GPU 利用率 · 分摊"]),
  ("失败归因", ["工具 / 推理 / 环境", "自动聚类 · 回归用例"]),
  ("离线回归", ["黄金集 · 私有 eval", "版本对比 · 门禁"]),
  ("在线实验", ["A/B · canary", "自动回滚 · 灰度"]),
  ("数据精选", ["脱敏 · 去重 · 难度分层", "轨迹质量打分"]),
  ("再训练", ["SFT / RL → 新 ckpt", "再评测 → 再发布"]),
 ],
 "repos": ["langfuse/langfuse", "Arize-ai/phoenix", "comet-ml/opik", "Helicone/helicone",
           "open-telemetry/opentelemetry-python", "HumanSignal/label-studio",
           "wandb/wandb", "confident-ai/deepeval"],
 "repo_note": "没有 trace 就没有飞轮",
})

journey = [
 ("01", "接入", ["Auth · rate limit", "session / tenant"], "EDGE / API", C0),
 ("02", "上下文组装", ["system + tools + memory", "history 按 token 预算裁剪"], "HARNESS", C5),
 ("03", "路由", ["模型级联", "区域 / 配额 / 成本"], "ROUTER", C3),
 ("04", "Prefill", ["tokenize · KV cache", "prefix cache 命中"], "GPU · PREFILL", C4),
 ("05", "Decode", ["流式 token", "grammar / tool-call"], "GPU · DECODE", C1),
 ("06", "工具执行", ["schema 校验", "沙箱 → observation"], "SANDBOX", C2),
 ("07", "循环", ["回到 02，直到", "预算 / 完成 / 失败"], "HARNESS", C5),
 ("08", "输出", ["SSE 流式返回", "trace · cost · feedback"], "STREAM + TRACE", C7),
]

roadmap = [
 ("PHASE 1 · 0–3 月", "验证闭环", ["前沿 API + Harness + 沙箱 + Eval", "先证明任务成功率与单位经济模型"],
  "EXIT · 端到端成功率 > 基线，$/task 可算", C0),
 ("PHASE 2 · 3–9 月", "降本可控", ["开源基座 + 领域 SFT + vLLM 自托管", "私有 eval 回归 + prefix cache 优化"],
  "EXIT · 成本降 5–10×，质量不降", C2),
 ("PHASE 3 · 9 月+", "规模化", ["Agentic RL + 自建训练集群 + 数据飞轮", "只有规模证明后才考虑预训练"],
  "EXIT · 成功率持续爬坡，边际成本下降", C3),
]

def box(x, y, w, h, title, lines, color):
    R(x, y, w, h, SOFT, "#ECECF1", 12)
    add('<circle cx="%s" cy="%s" r="3.5" fill="%s"/>' % (x + 18, y + 24, color))
    T(x + 30, y + 28, title, 14.5, INK, 600)
    for i, l in enumerate(lines[:3]):
        T(x + 18, y + 53 + i * 19, l, 12, INK2)

def callout(x, y, w, h, color, lead, body, body2=None):
    R(x, y, w, h, tint(color, 0.07), None, 10)
    R(x, y, 4, h, color, None, 2)
    add('<text x="%s" y="%s" font-size="12.5" fill="%s">'
        '<tspan font-weight="700" fill="%s">%s</tspan>%s</text>'
        % (x + 18, y + 31, INK2, color, esc(lead), esc(body)))
    if body2:
        T(x + 18, y + 52, body2, 11.5, INK2)

def repo_chip(x, y, w, h, full, color):
    url = "https://github.com/" + full
    add('<a href="%s" xlink:href="%s" target="_blank" rel="noopener" style="cursor:pointer" aria-label="Open %s on GitHub">'
        % (url, url, esc(full)))
    R(x, y, w, h, "#1F1F26", "#2E2E38", 8)
    gx, gy = x + 13, y + 12
    add('<rect x="%s" y="%s" width="11" height="14" rx="2.2" fill="none" stroke="#7D7D89" stroke-width="1.1"/>' % (gx, gy))
    add('<path d="M %s %s V %s M %s %s H %s M %s %s H %s" stroke="#7D7D89" stroke-width="1.1" fill="none"/>'
        % (gx + 3.5, gy, gy + 14, gx + 6, gy + 5, gx + 8.5, gx + 6, gy + 8, gx + 8.5))
    size = 12 if len(full) <= 29 else 11.2
    add('<text x="%s" y="%s" font-size="%s" font-weight="500" fill="#ECECF2">%s</text>'
        % (x + 32, y + 24, size, esc(full)))
    T(x + w - 17, y + 24, "↗", 10, "#6F6F7B", 600)
    add('</a>')

def repo_panel(x, y, w, h, repos, color, note=None):
    R(x, y, w, h, "#17171C", None, 16)
    T(x + 20, y + 30, "GITHUB REPOS", 10.5, "#85858F", 700, ls=1.6)
    T(x + w - 20, y + 30, "%d REPOS" % len(repos), 9.5, "#5E5E68", 700, anchor="end", ls=0.8)
    L(x + 20, y + 41, x + w - 20, y + 41, "#2A2A32", 1)
    cw = (w - 54) // 2
    for i, r in enumerate(repos):
        row, col = divmod(i, 2)
        repo_chip(x + 20 + col * (cw + 14), y + 52 + row * 46, cw, 38, r, color)
    if note:
        add('<circle cx="%s" cy="%s" r="3" fill="%s"/>' % (x + 22, y + h - 20, color))
        T(x + 32, y + h - 16, note, 10.5, "#85858F")

def stage_card(s):
    x, y, w, h, c = 140, s["y"], 2660, s["h"], s["color"]
    R(x, y, w, h, WHITE, "#E4E4EA", 22)
    R(x + 36, y + 30, 48, 4, c, None, 2)
    T(x + 36, y + 58, s["num"], 12, c, 700, ls=1.4)
    T(x + 36, y + 94, s["title"], 27, INK, 700)
    for i, g in enumerate(s["goal"]):
        T(x + 36, y + 120 + i * 18, g, 12.5, INK2)
    if s.get("badge"):
        label = s["badge"]
        bw = 9 * len(label) + 24
        by = y + 150
        R(x + 36, by, bw, 22, tint(c, 0.1), None, 11)
        T(x + 47, by + 15, label, 9, c, 700, ls=1.1)
    cols = s.get("cols", 3)
    gap = 20 if cols == 4 else 30
    bw = (1480 - (cols - 1) * gap) // cols
    vgap = 14 if cols == 4 else 16
    for i, (title, lines) in enumerate(s["boxes"]):
        col, row = i % cols, i // cols
        box(526 + col * (bw + gap), y + 30 + row * (s["box_h"] + vgap), bw, s["box_h"], title, lines, c)
    if s.get("callout"):
        co = s["callout"]
        callout(526, y + co["offset"], 1480, co["h"], c, co["lead"], co["body"], co.get("body2"))
    repo_panel(2036, y + 24, 728, h - 48, s["repos"], c, s.get("repo_note"))

def hero():
    R(140, 40, 2660, 260, WHITE, "#E4E4EA", 24)
    T(176, 82, "AGENT SYSTEM ARCHITECTURE · 2026", 11, C0, 700, ls=2.2)
    T(176, 150, "Agent 全链路技术架构", 52, INK, 700, ls=-0.6)
    T(176, 190, "从 GPU 集群到 Token 输出：模型、推理、Harness 与数据飞轮的完整拼图", 14.5, INK2)
    T(176, 214, "适用：Coding Agent · Computer Use · Deep Research · 企业自动化", 12.5, INK3)
    stats = [("9", "LAYERS", "评测 → 观测", C0),
             ("100", "GITHUB REPOS", "各阶段代表项目", C2),
             ("1", "FLYWHEEL", "trace → retrain", C3)]
    for i, (num, label, note, c) in enumerate(stats):
        sx = 2132 + i * 216
        R(sx, 80, 200, 120, SOFT, "#ECECF1", 14)
        T(sx + 18, 136, num, 34, c, 700)
        T(sx + 18, 160, label, 9, INK3, 700, ls=1.3)
        T(sx + 18, 181, note, 10.5, INK2)
    short = ["评测", "算力", "训练", "模型", "推理", "Harness", "平台", "安全", "观测"]
    for i, s in enumerate(stages):
        px = 176 + i * 155
        R(px, 240, 145, 30, WHITE, "#E4E4EA", 15)
        add('<circle cx="%s" cy="255" r="4" fill="%s"/>' % (px + 17, s["color"]))
        T(px + 29, 260, s["num"] + "  " + short[i], 11.5, INK, 600)
    T(1580, 260, "9 LAYERS · 100 REPOS · 1 FLYWHEEL", 10.5, INK3, 700, ls=1.3)

def journey_card():
    y = 4160
    R(140, y, 2660, 320, WHITE, "#E4E4EA", 22)
    T(176, y + 40, "一次请求的 Token 旅程", 22, INK, 700)
    T(176, y + 64, "从 HTTP 请求到流式 Token —— 中间是多次模型调用与工具执行的循环", 12.5, INK2)
    x0, bw, gap, by, bh = 176, 300, 26, y + 90, 150
    for i, (num, title, lines, tag, color) in enumerate(journey):
        bx = x0 + i * (bw + gap)
        R(bx, by, bw, bh, WHITE, "#E5E5EA", 14)
        add('<circle cx="%s" cy="%s" r="13" fill="%s"/>' % (bx + 24, by + 26, tint(color, 0.12)))
        T(bx + 24, by + 30, num, 10, color, 700, anchor="middle")
        T(bx + 44, by + 31, title, 14, INK, 700)
        for j, l in enumerate(lines):
            T(bx + 18, by + 64 + j * 19, l, 12, INK2)
        T(bx + 18, by + 132, tag, 9, color, 700, ls=1.2)
        if i < 7:
            ax, ay = bx + bw + 5, by + bh // 2
            ex = bx + bw + gap - 5
            L(ax, ay, ex, ay, "#B9B9C4", 1.4)
            tri(ex, ay, "right", "#B9B9C4", 6)
    sx = x0 + 5 * (bw + gap) + bw // 2
    ex2 = x0 + 1 * (bw + gap) + bw // 2
    ly = by + bh + 28
    add('<path d="M %s %s V %s H %s V %s" fill="none" stroke="%s" stroke-width="1.3" stroke-dasharray="5 5"/>'
        % (sx, by + bh + 4, ly, ex2, by + bh + 10, C5))
    tri(ex2, by + bh + 4, "up", C5, 7)
    T((sx + ex2) // 2, ly + 18, "observation 回填 → 在 step / token / 时间预算内循环", 11, C5, 600, anchor="middle")

def roadmap_card():
    y = 4508
    R(140, y, 2660, 260, WHITE, "#E4E4EA", 22)
    T(176, y + 42, "落地路线 · 务实版", 22, INK, 700)
    T(176, y + 66, "先验证闭环，再降本，最后才规模化", 12.5, INK2)
    T(2764, y + 42, "注意 · 预训练是最后才考虑的事", 13, C3, 700, anchor="end")
    cw, gap = 846, 24
    for i, (tag, title, lines, exit_, color) in enumerate(roadmap):
        cx, cy = 176 + i * (cw + gap), y + 92
        R(cx, cy, cw, 132, tint(color, 0.045), "#ECECF1", 14)
        R(cx, cy, 4, 132, color, None, 2)
        T(cx + 20, cy + 24, tag, 9.5, color, 700, ls=1.2)
        T(cx + 20, cy + 52, title, 17, INK, 700)
        for j, l in enumerate(lines):
            T(cx + 20, cy + 80 + j * 18, l, 12, INK2)
        T(cx + 20, cy + 120, exit_, 10.5, INK3, 600)

def build():
    add('<?xml version="1.0" encoding="UTF-8"?>')
    add('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%d" height="%d" viewBox="0 0 %d %d" '
        'font-family="Inter, \'PingFang SC\', \'Microsoft YaHei\', \'Segoe UI\', sans-serif">' % (W, H, W, H))
    add('<title>Agent 全链路技术架构</title>')
    add('<desc>从 GPU 集群、数据与训练、模型设计、推理服务到 Agent Harness、Agent 平台与 Token 输出的全链路架构图，'
        '含各阶段代表 GitHub 仓库（可点击）。</desc>')
    add('<rect width="%d" height="%d" fill="#F4F5F7"/>' % (W, H))
    add('<path d="M 136 3954 H 100 V 1286 H 128" fill="none" stroke="%s" stroke-width="1.4" '
        'stroke-dasharray="5 5"/>' % C0)
    tri(136, 1286, "right", C0, 7)
    add('<circle cx="136" cy="3954" r="3.5" fill="%s"/>' % C0)
    add('<text transform="translate(84,2620) rotate(-90)" text-anchor="middle" font-size="10" '
        'font-weight="700" letter-spacing="2" fill="%s">PRODUCTION TRACE → RETRAIN</text>' % C0)
    hero()
    for s in stages:
        stage_card(s)
    journey_card()
    roadmap_card()
    T(140, 4808, "Agent 全链路技术架构 · 2026-11 · 仓库为各阶段代表项目，非穷举 · 点击仓库名跳转 GitHub", 10.5, INK3)
    T(2764, 4808, "Editable SVG for Figma · 2880 × 4840", 10.5, INK3, anchor="end")
    add('</svg>')

build()
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent-architecture.svg")
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print(path, len(out), "elements")

repos = sorted({r for s in stages for r in s["repos"]})
plugin_dir = os.path.join(os.path.dirname(path), "figma-plugin")
os.makedirs(plugin_dir, exist_ok=True)
manifest = {
    "name": "Agent Diagram · GitHub Links",
    "id": "agent-architecture-github-links-2026",
    "api": "1.0.0",
    "main": "code.js",
    "editorType": ["figma"],
    "documentAccess": "dynamic-page",
}
with open(os.path.join(plugin_dir, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

js = r"""// Agent Diagram · GitHub Links
// Run this plugin after importing agent-architecture.svg into Figma.
// It finds repo text layers (owner/repo) and turns them into real Figma hyperlinks.
const REPOS = new Set(__REPOS__);

const nodes = figma.currentPage.findAll(n => n.type === "TEXT");
let linked = 0;
const seen = new Set();

for (const node of nodes) {
  const raw = (node.characters || "").trim();
  const match = raw.match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/);
  if (!match) continue;
  const repo = match[1];
  if (!REPOS.has(repo)) continue;
  node.hyperlink = { type: "URL", value: "https://github.com/" + repo };
  node.name = "GitHub · " + repo;
  linked += 1;
  seen.add(repo);
}

if (linked === 0) {
  figma.notify("没有找到仓库文本。请确认 SVG 导入时保留了 Text Layer（不要 outline）。", { error: true, timeout: 8000 });
} else {
  figma.notify("已为 " + linked + " 个仓库添加 GitHub 链接（共 " + seen.size + " 个仓库）", { timeout: 6000 });
}
figma.closePlugin();
"""
with open(os.path.join(plugin_dir, "code.js"), "w", encoding="utf-8") as f:
    f.write(js.replace("__REPOS__", json.dumps(repos, ensure_ascii=False)))
print("plugin:", plugin_dir, "|", len(repos), "repo links")







