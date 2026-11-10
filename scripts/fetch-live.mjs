// Fetch live GitHub metadata for the curated landscape + hot / rising search results.
// Requires GITHUB_TOKEN with public repo read access.
//
// Search is done per sub-section (stage → group → topic queries from scripts/queries.json).
// Every repo is then assigned to exactly one (stage, group) across the whole site, so the
// same project doesn't show up in several layers.
import fs from "node:fs/promises";
import path from "node:path";
import { DATA, ROOT, readJson, requireToken, makeGh, mapRepo, buildQuery, searchUrl, isRelevant, sleep } from "./lib/live.mjs";

const GROUP_LIMIT = 6; // live results kept per sub-section
const SEARCH_GAP_MS = 2200; // authenticated search: 30 req/min
// Rising results move slowly; refresh them about once a day instead of on every run.
// 22h (not 24h) so a slightly early cron tick doesn't push the refresh out by a full interval.
const RISING_INTERVAL_MS = 22 * 3600 * 1000;

const gh = makeGh(requireToken());
const curatedFile = await readJson(path.join(DATA, "curated.json"));
const queries = await readJson(path.join(ROOT, "scripts", "queries.json"));
const previous = await readJson(path.join(DATA, "live.json"), {});
const stages = curatedFile.stages;
const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

// fullName → { stage, group } for every curated repo.
const curatedHome = new Map();
for (const stage of stages) {
  for (const group of stage.groups) {
    for (const full of group.repos) curatedHome.set(full.toLowerCase(), { stage: stage.id, group: group.id });
  }
}
const curatedRepos = stages.flatMap((s) => s.repos);
const isCurated = (full) => curatedHome.has(full.toLowerCase());

const lastRisingAt = Date.parse(previous.risingFetchedAt || "") || 0;
const refreshRising =
  process.env.FORCE_RISING === "1" ||
  !previous.stages ||
  // A snapshot from before sub-sections has no `group` on its items; refetch once.
  !Object.values(previous.stages).some((s) => s.rising?.some((r) => r.group)) ||
  Date.now() - lastRisingAt >= RISING_INTERVAL_MS;

console.log(`curated: ${curatedRepos.length} repos | rising since: ${since}`);
console.log(
  refreshRising
    ? "rising: refreshing this run"
    : `rising: reusing snapshot from ${previous.risingFetchedAt} (set FORCE_RISING=1 to override)`,
);

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

const sortKey = (a, b) => Number(b.curated) - Number(a.curated) || b.stars - a.stars;

// Search every (stage, group) for one mode. Returns stageId → groupId → sorted candidates.
async function searchAll(mode) {
  const out = {};
  for (const stage of stages) {
    out[stage.id] = {};
    for (const group of stage.groups) {
      const merged = new Map();
      for (const spec of queries[stage.id]?.[group.id] || []) {
        const q = buildQuery(spec, mode, since);
        try {
          const data = await gh(searchUrl(q));
          let kept = 0;
          for (const item of data.items || []) {
            const repo = mapRepo(item);
            if (repo.archived || repo.fork) continue;
            if (!isRelevant(stage.id, group.id, repo)) continue;
            kept += 1;
            if (!merged.has(repo.fullName)) merged.set(repo.fullName, { ...repo, curated: isCurated(repo.fullName) });
          }
          console.log(`  ${stage.id}/${group.id}/${mode} ${spec.topic}: ${data.items?.length || 0} results, ${kept} relevant`);
        } catch (err) {
          console.warn(`  ${stage.id}/${group.id}/${mode} ${spec.topic} failed: ${err.message}`);
        }
        await sleep(SEARCH_GAP_MS);
      }
      out[stage.id][group.id] = [...merged.values()].sort(sortKey);
    }
  }
  return out;
}

function lexLess(a, b) {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// Give each repo exactly one home. Curated repos always live in their curated
// (stage, group) — found anywhere in that stage they are re-tagged there, found only in
// other stages they are dropped. Everything else goes to the (stage, group) where it
// ranked highest (ties → earlier stage / group).
function assignOwners(candidates) {
  const best = new Map();
  stages.forEach((stage, si) => {
    stage.groups.forEach((group, gi) => {
      (candidates[stage.id][group.id] || []).forEach((repo, rank) => {
        const key = repo.fullName.toLowerCase();
        const home = curatedHome.get(key);
        if (home) {
          if (home.stage === stage.id) best.set(key, { score: [0], stage: home.stage, group: home.group });
          return;
        }
        const score = [1, rank, si, gi];
        const cur = best.get(key);
        if (!cur || lexLess(score, cur.score)) {
          best.set(key, { score, stage: stage.id, group: group.id });
        }
      });
    });
  });
  return best;
}

function dedupeSimilar(repos) {
  const seenDescriptions = new Set();
  const seenNames = new Set();
  const unique = [];
  for (const repo of repos) {
    const desc = (repo.description || "").toLowerCase().replace(/\s+/g, " ").trim();
    const name = repo.fullName.split("/").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (desc && seenDescriptions.has(desc)) continue;
    if (name && seenNames.has(name)) continue;
    if (desc) seenDescriptions.add(desc);
    if (name) seenNames.add(name);
    unique.push(repo);
  }
  return unique;
}

// Build stageId → sorted list (each item tagged with `group`), falling back per group
// to the previous snapshot when a group's searches came back empty.
function buildMode(candidates, mode) {
  const owners = assignOwners(candidates);
  const result = {};
  for (const stage of stages) {
    const prevItems = previous.stages?.[stage.id]?.[mode] || [];
    const items = [];
    // Every candidate found in this stage, once, so a repo found under group A but
    // owned by group B of the same stage still lands in B.
    const pool = new Map();
    for (const group of stage.groups) {
      for (const repo of candidates[stage.id][group.id] || []) pool.set(repo.fullName, repo);
    }
    const ordered = [...pool.values()].sort(sortKey);
    for (const group of stage.groups) {
      const own = ordered.filter((repo) => {
        const owner = owners.get(repo.fullName.toLowerCase());
        return owner && owner.stage === stage.id && owner.group === group.id;
      });
      let picked = dedupeSimilar(own).slice(0, GROUP_LIMIT);
      if (!picked.length) picked = prevItems.filter((r) => r.group === group.id);
      items.push(...picked.map((r) => ({ ...r, group: group.id, curated: isCurated(r.fullName) })));
    }
    result[stage.id] = items.sort(sortKey);
  }
  return result;
}

console.log("fetching curated metadata...");
const freshCurated = await fetchCurated();
const curatedOut = {};
for (const full of curatedRepos) {
  const fresh = freshCurated[full];
  const prev = previous.curated?.[full];
  curatedOut[full] = fresh?.error && prev && !prev.error ? prev : fresh;
}

console.log("searching hot...");
const hot = buildMode(await searchAll("hot"), "hot");
let rising;
if (refreshRising) {
  console.log("searching rising...");
  rising = buildMode(await searchAll("rising"), "rising");
} else {
  rising = {};
  for (const stage of stages) {
    rising[stage.id] = (previous.stages?.[stage.id]?.rising || []).map((r) => ({ ...r, curated: isCurated(r.fullName) }));
  }
}

const stagesOut = {};
let hotCount = 0;
let risingCount = 0;
for (const stage of stages) {
  stagesOut[stage.id] = { hot: hot[stage.id], rising: rising[stage.id] };
  hotCount += hot[stage.id].length;
  risingCount += rising[stage.id].length;
}

// Don't publish a snapshot that lost most of its results (rate limit, API outage).
const prevHot = Object.values(previous.stages || {}).reduce((n, s) => n + (s.hot?.length || 0), 0);
if (prevHot && hotCount < prevHot * 0.5) {
  console.error(`hot results dropped from ${prevHot} to ${hotCount}; keeping previous live.json`);
  process.exit(1);
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
