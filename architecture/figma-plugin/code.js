// Agent Diagram · GitHub Links
// Run this plugin after importing agent-architecture.svg into Figma.
// It finds repo text layers (owner/repo) and turns them into real Figma hyperlinks.
const REPOS = new Set(["Arize-ai/phoenix", "BerriAI/litellm", "Dao-AILab/flash-attention", "EleutherAI/lm-evaluation-harness", "Helicone/helicone", "HumanSignal/label-studio", "InternLM/lmdeploy", "LMCache/LMCache", "LibreChat-AI/LibreChat", "Mintplex-Labs/anything-llm", "NVIDIA-NeMo/Curator", "NVIDIA-NeMo/Guardrails", "NVIDIA/DCGM", "NVIDIA/Megatron-LM", "NVIDIA/TensorRT-LLM", "NVIDIA/TransformerEngine", "NVIDIA/garak", "NVIDIA/gpu-operator", "NVIDIA/nccl", "NovaSky-AI/SkyRL", "OpenHands/OpenHands", "OpenRLHF/OpenRLHF", "QwenLM/Qwen3", "SWE-agent/SWE-agent", "SWE-bench/SWE-bench", "THUDM/AgentBench", "Tencent/AI-Infra-Guard", "UKGovernmentBEIS/inspect_ai", "aaif-goose/goose", "agno-agi/agno", "ai-dynamo/dynamo", "allenai/dolma", "anomalyco/opencode", "areal-project/AReaL", "axolotl-ai-cloud/axolotl", "browser-use/browser-use", "cline/cline", "comet-ml/opik", "confident-ai/deepeval", "coze-dev/coze-studio", "data-privacy-stack/presidio", "datajuicer/data-juicer", "deepseek-ai/DeepEP", "deepseek-ai/DeepSeek-V3", "deepset-ai/haystack", "deepspeedai/DeepSpeed", "e2b-dev/E2B", "firecracker-microvm/firecracker", "flashinfer-ai/flashinfer", "ggml-org/llama.cpp", "google/adk-python", "google/gvisor", "guardrails-ai/guardrails", "huggingface/datatrove", "huggingface/lighteval", "huggingface/smolagents", "huggingface/tokenizers", "huggingface/transformers", "huggingface/trl", "infiniflow/ragflow", "kubeflow/trainer", "kubernetes-sigs/kueue", "labring/FastGPT", "langchain-ai/langgraph", "langflow-ai/langflow", "langfuse/langfuse", "langgenius/dify", "letta-ai/letta", "llm-d/llm-d", "mastra-ai/mastra", "mem0ai/mem0", "meta-llama/PurpleLlama", "meta-llama/llama-models", "microsoft/autogen", "microsoft/playwright-mcp", "microsoft/semantic-kernel", "modelcontextprotocol/servers", "n8n-io/n8n", "ofiwg/libfabric", "ollama/ollama", "open-policy-agent/opa", "open-telemetry/opentelemetry-python", "open-webui/open-webui", "openai/evals", "openai/openai-agents-python", "promptfoo/promptfoo", "pydantic/pydantic-ai", "pytorch/torchtitan", "ray-project/ray", "run-llama/llama_index", "sgl-project/sglang", "sierra-research/tau-bench", "temporalio/temporal", "triton-inference-server/server", "unslothai/unsloth", "verl-project/verl", "vllm-project/vllm", "volcano-sh/volcano", "wandb/wandb", "web-arena-x/webarena"]);

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
