// Fetch live GitHub metadata for the curated landscape + hot / rising search results.
// Requires GITHUB_TOKEN with public repo read access.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("GITHUB_TOKEN is required.");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${TOKEN}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "agent-landscape-live",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.ok) return res.json();
    if (res.status === 403 || res.status === 429) {
      const retry = Number(res.headers.get("retry-after") || 0);
      const wait = retry ? retry * 1000 : 15000;
      console.warn(`rate limited (${res.status}); waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 240)}`);
  }
  throw new Error("rate limited after retries");
}

function mapRepo(r) {
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

// GitHub topic search is noisy: popular lists, courses, and unrelated tools often
// share a topic. Keep the live modes useful with a small editorial filter.
const COMMON_DENY =
  /awesome|free-for-dev|\bcourse\b|\broadmap\b|tutorial|survey|\bbook\b|cheatsheet|interview|curriculum|handbook|list of|curated|\blearn\b|\bguide\b|\bblog\b|blogs|no longer|deprecated|unmaintained|not maintained|分享|教程|入门|实战|课程|学习|指南|综述|论文|书籍|面试/i;

const FILTERS = {
  eval: {
    must: /eval|benchmark|test|score|judge|metric|audit|observ/i,
    deny: /wifi|spatial|scrap|crawler|image|vision|diffusion|vulnerability scanner|penetration/i,
  },
  infra: {
    must: /gpu|cluster|compute|infra|distributed|cloud|kubernetes|slurm|training|serving|scheduler|accelerat|hardware/i,
    deny: /image|vision|cnn|diffusion|wifi|scrap|secret|security|penetration/i,
  },
  training: {
    must: /train|fine-tun|rlhf|post-train|peft|lora|alignment|distill|reinforcement|sft|dpo|grpo|pre-train/i,
    deny: /secret|security|penetration|bug bounty|image|vision|diffusion|video|wifi|scrap|document processing|retrieval|\brag\b|vector database|llmops/i,
  },
  model: {
    must: /model|llm|language|moe|transformer|multimodal|vision-language|foundation|weights|architecture|long-context/i,
    deny: /serving|\bserve\b|inference engine|scrap|crawler|workflow|agent framework|platform|vector database|security scanner|wifi|agents?|agentic|plugin|\bclaude\b|\bcodex\b|\bcursor\b|visualiz|robotics|dataset|toolkit|data integration|\bocr\b/i,
  },
  serving: {
    must: /inference|serving|server|serve|engine|kv-cache|quantiz|throughput|latency|vllm|sglang|llama\.cpp|model-serving|deploy|runtime|backend/i,
    deny: /wifi|spatial|image|vision|diffusion|security|scanner|distributed compute|compute engine/i,
  },
  harness: {
    must: /agent|harness|mcp|tool|workflow|orchestrat|framework|assistant|automat|skill/i,
    deny: /wifi|spatial|image|vision|diffusion/i,
  },
  platform: {
    must: /platform|workflow|rag|retrieval|llmops|low-code|agent|automat|orchestrat|interface|chat|knowledge|pipeline|studio/i,
    deny: /video|short|scrap|crawler|security|scanner|image generation|wifi|spatial|fine-tun|world model|train|\bocr\b/i,
  },
  security: {
    must: /security|guardrail|prompt|injection|safety|red team|audit|sandbox|scanner|vulnerab|attack|defense|threat|malicious|privacy/i,
    deny: /system prompts|leak|wifi|spatial|image|vision|diffusion|programming language|router|decision layer/i,
  },
  observability: {
    must: /observ|trace|monitor|telemetry|eval|metric|log|debug|analytics|instrument|dashboard/i,
    deny: /wifi|spatial|image|vision|diffusion|scrap/i,
  },
};

function isRelevant(stageId, repo) {
  const text = `${repo.fullName} ${repo.description} ${repo.topics.join(" ")}`;
  if (COMMON_DENY.test(text)) return false;
  const filter = FILTERS[stageId];
  if (!filter) return true;
  if (filter.deny.test(text)) return false;
  return filter.must.test(text);
}

const curatedFile = JSON.parse(await fs.readFile(path.join(DATA, "curated.json"), "utf8"));
const queries = JSON.parse(await fs.readFile(path.join(ROOT, "scripts", "queries.json"), "utf8"));
const curatedRepos = curatedFile.stages.flatMap((s) => s.repos);
const curatedSet = new Set(curatedRepos);
const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

console.log(`curated: ${curatedRepos.length} repos | rising since: ${since}`);

async function fetchCurated() {
  const out = {};
  const queue = [...curatedRepos];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const full = queue.shift();
      try {
        out[full] = mapRepo(await gh(`https://api.github.com/repos/${full}`));
      } catch (err) {
        console.warn(`curated failed: ${full} (${err.message})`);
        out[full] = { fullName: full, error: true, url: `https://github.com/${full}` };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchMode(stageId, mode) {
  const merged = new Map();
  for (const template of queries[stageId]?.[mode] || []) {
    const q = template.replaceAll("{since}", since);
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=40`;
      const data = await gh(url);
      let kept = 0;
      for (const item of data.items || []) {
        const repo = mapRepo(item);
        if (repo.archived || repo.fork) continue;
        if (!isRelevant(stageId, repo)) continue;
        kept += 1;
        if (!merged.has(repo.fullName)) merged.set(repo.fullName, repo);
      }
      console.log(`  ${stageId}/${mode}: ${data.items?.length || 0} results, ${kept} relevant`);
    } catch (err) {
      console.warn(`  ${stageId}/${mode} query failed: ${err.message}`);
    }
    await sleep(2200);
  }
  const unique = [];
  const seenDescriptions = new Map();
  const seenNames = new Set();
  for (const repo of [...merged.values()].sort((a, b) => (b.curated ? 1 : 0) - (a.curated ? 1 : 0) || b.stars - a.stars)) {
    const key = (repo.description || "").toLowerCase().replace(/\s+/g, " ").trim();
    const repoName = repo.fullName.split("/").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key && seenDescriptions.has(key)) continue;
    if (repoName && seenNames.has(repoName)) continue;
    if (key) seenDescriptions.set(key, repo);
    if (repoName) seenNames.add(repoName);
    unique.push(repo);
  }
  return unique
    .map((r) => ({ ...r, curated: curatedSet.has(r.fullName) }))
    .slice(0, 12);
}

let previous = {};
try {
  previous = JSON.parse(await fs.readFile(path.join(DATA, "live.json"), "utf8"));
} catch {
  previous = {};
}

// Rising results move slowly; refresh them about once a day instead of on every run.
// 22h (not 24h) so a slightly early cron tick doesn't push the refresh out by a full interval.
const RISING_INTERVAL_MS = 22 * 3600 * 1000;
const lastRisingAt = Date.parse(previous.risingFetchedAt || "") || 0;
const refreshRising =
  process.env.FORCE_RISING === "1" ||
  !previous.stages ||
  Date.now() - lastRisingAt >= RISING_INTERVAL_MS;
console.log(
  refreshRising
    ? "rising: refreshing this run"
    : `rising: reusing snapshot from ${previous.risingFetchedAt} (set FORCE_RISING=1 to override)`,
);

console.log("fetching curated metadata...");
const freshCurated = await fetchCurated();
const curatedOut = { ...(previous.curated || {}) };
for (const [full, repo] of Object.entries(freshCurated)) {
  if (repo.error && curatedOut[full] && !curatedOut[full].error) continue;
  curatedOut[full] = repo;
}

const stagesOut = {};
let hotCount = 0;
let risingCount = 0;
for (const stage of curatedFile.stages) {
  console.log(`fetching live results: ${stage.id}`);
  const hot = await fetchMode(stage.id, "hot");
  const prev = previous.stages?.[stage.id] || {};
  const rising = refreshRising
    ? await fetchMode(stage.id, "rising")
    : (prev.rising || []).map((r) => ({ ...r, curated: curatedSet.has(r.fullName) }));
  stagesOut[stage.id] = {
    hot: hot.length ? hot : prev.hot || [],
    rising: rising.length ? rising : prev.rising || [],
  };
  hotCount += stagesOut[stage.id].hot.length;
  risingCount += stagesOut[stage.id].rising.length;
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: "GitHub REST API (search + repos)",
  since: refreshRising ? since : previous.since || since,
  risingFetchedAt: refreshRising ? new Date().toISOString() : previous.risingFetchedAt,
  stats: {
    curated: Object.keys(curatedOut).length,
    hot: hotCount,
    rising: risingCount,
  },
  curated: curatedOut,
  stages: stagesOut,
};

await fs.writeFile(path.join(DATA, "live.json"), JSON.stringify(payload, null, 2), "utf8");
console.log(`wrote data/live.json | curated ${payload.stats.curated} | hot ${hotCount} | rising ${risingCount}`);
