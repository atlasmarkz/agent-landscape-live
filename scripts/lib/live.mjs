// Shared helpers for fetch-live.mjs and validate-queries.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA = path.join(ROOT, "data");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export function requireToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is required.");
    process.exit(1);
  }
  return token;
}

export function makeGh(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-landscape-live",
  };
  return async function gh(url) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await fetch(url, { headers });
      if (res.ok) return res.json();
      if (res.status === 403 || res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") || 0) * 1000;
        const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
        const untilReset = reset ? reset - Date.now() + 1000 : 0;
        const wait = Math.min(Math.max(retryAfter, untilReset, 5000), 90000);
        console.warn(`rate limited (${res.status}); waiting ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }
      const body = await res.text();
      const err = new Error(`${res.status} ${res.statusText}: ${body.slice(0, 240)}`);
      err.status = res.status;
      throw err;
    }
    throw new Error("rate limited after retries");
  };
}

export function mapRepo(r) {
  return {
    fullName: r.full_name,
    description: r.description || "",
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    language: r.language || "",
    pushedAt: r.pushed_at || "",
    createdAt: r.created_at || "",
    topics: Array.isArray(r.topics) ? r.topics.slice(0, 8) : [],
    url: r.html_url || `https://github.com/${r.full_name}`,
    archived: Boolean(r.archived),
    fork: Boolean(r.fork),
    license: r.license?.spdx_id || "",
    openIssues: r.open_issues_count || 0,
  };
}

export function buildQuery(spec, mode, since) {
  const base = `topic:${spec.topic} archived:false fork:false`;
  return mode === "rising"
    ? `${base} created:>${since} stars:>${spec.rising ?? 5}`
    : `${base} stars:>${spec.stars ?? 50}`;
}

export function searchUrl(q, perPage = 30) {
  return `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}`;
}

// GitHub topic search is noisy: popular lists, courses, and unrelated tools often
// share a topic. Keep the live modes useful with a small editorial filter.
const COMMON_DENY =
  /awesome|free-for-dev|\bcourse\b|\broadmap\b|tutorial|survey|\bbook\b|cheatsheet|interview|curriculum|handbook|list of|curated|\blearn\b|\bguide\b|\bblog\b|blogs|beginners|from[- ]scratch|no longer|deprecated|unmaintained|not maintained|分享|教程|入门|实战|课程|学习|指南|综述|论文|书籍|面试/i;

// Stage-level must/deny; a group may override `must` (and add `deny`) when the
// stage vocabulary doesn't describe it (e.g. sandboxes inside the harness layer).
export const FILTERS = {
  eval: {
    must: /eval|benchmark|test|score|judge|metric|audit|observ/i,
    deny: /wifi|spatial|scrap|crawler|image|vision|diffusion|vulnerability scanner|penetration/i,
  },
  infra: {
    must: /gpu|cluster|compute|infra|distributed|cloud|kubernetes|slurm|training|serving|scheduler|accelerat|hardware|rdma|network|nccl|batch|workflow|pipeline|ray/i,
    deny: /image|vision|cnn|diffusion|wifi|scrap|secret|security|penetration|apple silicon|macos|\bmac\b|jetson/i,
    groups: {
      compute: { must: /machine learning|\bml\b|\bai\b|llm|gpu|training|ray|python|data science/i },
    },
  },
  training: {
    must: /train|fine-tun|rlhf|post-train|peft|lora|alignment|distill|reinforcement|sft|dpo|grpo|pre-train/i,
    deny: /secret|security|penetration|bug bounty|image|vision|diffusion|video|wifi|scrap|document processing|retrieval|\brag\b|vector database|llmops|tts|speech|voice|lorawan|\bradio\b|firmware|esp32|\bmesh\b|meshtastic|drone/i,
    groups: {
      data: { must: /llm|language model|pre-?train|training data|corpus|dataset|synthetic data|dedup/i },
      pretrain: { must: /llm|language model|transformer|megatron|parallel|pre-?train|distributed training/i },
      env: { must: /environment|gym|sandbox|rollout|simulat|reinforcement|\brl\b|agent/i },
    },
  },
  model: {
    must: /model|llm|language|moe|transformer|multimodal|vision-language|foundation|weights|architecture|long-context/i,
    deny: /serving|\bserve\b|inference engine|scrap|crawler|workflow|agent framework|platform|vector database|security scanner|wifi|plugin|\bclaude\b|\bcodex\b|\bcursor\b|visualiz|robotics|dataset|toolkit|data integration|\bocr\b|forecast|time series|tabular|notes|\basr\b|\btts\b|speech|audio|music|image models|segmentation/i,
    groups: {
      base: { must: /llm|language model|foundation model|\bqwen|llama|\bgpt|mistral|gemma|deepseek|internlm/i, deny: /vision|visual|multimodal|\bvl\b|-vl\b/i },
      multimodal: { must: /vision|multimodal|vlm|gui|screen|visual|image|video|grounding/i, deny: /diffusion|stable-diffusion|text-to-image|comfyui/i },
      library: { must: /library|framework|transformers|tokeniz|modeling|toolkit|array|autograd/i },
      kernels: { must: /kernel|cuda|triton|attention|gemm|moe|fused|operator|fp8/i },
    },
  },
  serving: {
    must: /inference|serving|server|serve|engine|kv-cache|kv cache|quantiz|throughput|latency|vllm|sglang|llama\.cpp|model-serving|deploy|runtime|backend|gateway|proxy|router|local|gguf|decod/i,
    deny: /wifi|spatial|image|vision|diffusion|security|scanner|distributed compute|compute engine|whisper|speech|redis/i,
    groups: {
      kv: { must: /kv.?cache|prefill|prefix.?cach|disaggregat|cache offload/i },
    },
  },
  harness: {
    must: /agent|harness|mcp|tool|workflow|orchestrat|framework|assistant|automat|skill|memory|context|claude|codex|coding/i,
    deny: /wifi|spatial|image|vision|diffusion|low-code|no-code|chatgpt-ui|web ui|webui/i,
    groups: {
      sandbox: { must: /sandbox|isolat|container|microvm|secure execution|code execution|interpreter|runtime/i },
      durable: { must: /durable|workflow|orchestrat|job|queue|resilient|reliab/i, deny: /low-code|no-code|internal tools/i },
      context: { must: /context|compress|token|prompt|memory/i },
      memory: { must: /memory|memories|remember|recall/i, deny: /database|\bsql\b|key-value store/i },
      skills: { must: /skill/i },
      tools: { must: /mcp|tool|browser|automation|model context protocol/i },
      coding: { must: /\bcod(e|ing)\b|coder|program|\bide\b|terminal|\bcli\b|software engineer/i, deny: /commerce|e-commerce|shop/i },
    },
  },
  platform: {
    must: /platform|workflow|rag|retrieval|llmops|low-code|agent|automat|orchestrat|interface|chat|knowledge|pipeline|studio|framework|\bui\b|webui|llm/i,
    deny: /video|short|scrap|crawler|security|scanner|image generation|wifi|spatial|fine-tun|world model|train|\bocr\b/i,
    groups: {
      lowcode: { must: /llm|\bai\b|agent|gpt|\brag\b|model|chatbot/i },
      rag: { must: /\brag\b|retrieval|knowledge|search|document|vector|index/i },
      chat: { must: /chat|\bui\b|webui|interface|client|desktop|assistant/i },
    },
  },
  security: {
    must: /security|guardrail|prompt|injection|safety|red team|red-team|audit|sandbox|scanner|vulnerab|attack|defense|threat|malicious|privacy|pii|policy|authoriz|permission|anonymi/i,
    deny: /system prompts|leak|wifi|spatial|image|vision|diffusion|programming language|router|decision layer|jailbreak prompts|liberation prompts|cve-\d{4}/i,
    groups: {
      redteam: { must: /(llm|\bai\b|agent|model|prompt|genai|jailbreak).*(red.?team|attack|scan|vulnerab|probe|fuzz)|(red.?team|attack|scan|vulnerab|probe|fuzz).*(llm|\bai\b|agent|model|prompt|genai)/i },
      "agent-sec": { must: /mcp|agent|skill|tool|sandbox/i },
    },
  },
  observability: {
    must: /observ|trace|tracing|monitor|telemetry|eval|metric|log|debug|analytics|instrument|dashboard|experiment|label|annotat|mlops/i,
    deny: /wifi|spatial|diffusion|scrap/i,
    groups: {
      tracing: { must: /(llm|\bai\b|agent|genai|model|gpt).*(observ|trac|telemetry|monitor)|(observ|trac|telemetry|monitor).*(llm|\bai\b|agent|genai|model|gpt)/i },
      experiment: { must: /experiment|tracking|registry|mlops|lifecycle/i, deny: /vector database|airflow|dagster|orchestrat/i },
      labeling: { must: /label|annotat/i, deny: /screen|recorder|screenshot/i },
    },
  },
};

// SEO spam that rides on popular topics (game boosters, cracks, …).
const SPAM = /\bfps\b|booster|boost performance|\bcrack(ed)?\b|keygen|\bcheats?\b|free download|windows 1[01]/i;

// Repos to keep out of live lists regardless of topic (suspicious star counts, mirrors…).
export const DENY_REPOS = new Set([]); // lower-case "owner/name"

export function isRelevant(stageId, groupId, repo) {
  const text = `${repo.fullName} ${repo.description} ${repo.topics.join(" ")}`;
  if (DENY_REPOS.has(repo.fullName.toLowerCase())) return false;
  if (COMMON_DENY.test(text) || SPAM.test(text)) return false;
  const stage = FILTERS[stageId];
  if (!stage) return true;
  const group = stage.groups?.[groupId] || {};
  if (stage.deny?.test(text) || group.deny?.test(text)) return false;
  return (group.must || stage.must).test(text);
}
