// Sanity-check curated groups and per-group topic queries before trusting them.
//   GITHUB_TOKEN=$(gh auth token) node scripts/validate-queries.mjs [--rising] [--stage harness]
// Reports: curated repos that 404 / were renamed / archived / inactive, and for every
// topic query the raw hit count, how many survive the relevance filter, and the top hits.
import path from "node:path";
import { DATA, ROOT, readJson, requireToken, makeGh, mapRepo, buildQuery, searchUrl, isRelevant, sleep } from "./lib/live.mjs";

const args = process.argv.slice(2);
const withRising = args.includes("--rising");
const onlyStage = args.includes("--stage") ? args[args.indexOf("--stage") + 1] : null;
const gh = makeGh(requireToken());

const curated = await readJson(path.join(DATA, "curated.json"));
const queries = await readJson(path.join(ROOT, "scripts", "queries.json"));
const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
const staleBefore = Date.now() - 180 * 864e5;
const stages = curated.stages.filter((s) => !onlyStage || s.id === onlyStage);
let problems = 0;

console.log("## Curated repos\n");
const all = stages.flatMap((s) => s.repos);
const queue = [...all];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const full = queue.shift();
      try {
        const r = await gh(`https://api.github.com/repos/${full}`);
        const notes = [];
        if (r.full_name.toLowerCase() !== full.toLowerCase()) notes.push(`renamed → ${r.full_name}`);
        if (r.archived) notes.push("archived");
        if (Date.parse(r.pushed_at) < staleBefore) notes.push(`inactive since ${r.pushed_at.slice(0, 10)}`);
        if (notes.length) {
          problems += 1;
          console.log(`- ${full}: ${notes.join(", ")} (★${r.stargazers_count})`);
        }
      } catch (err) {
        problems += 1;
        console.log(`- ${full}: ${err.status === 404 ? "NOT FOUND" : err.message}`);
      }
    }
  }),
);
console.log(`\n${all.length} curated repos checked\n`);

for (const stage of stages) {
  console.log(`## ${stage.id}`);
  const groupIds = new Set(stage.groups.map((g) => g.id));
  for (const gid of Object.keys(queries[stage.id] || {})) {
    if (!groupIds.has(gid)) console.log(`  ! queries.json group "${gid}" not in curated groups`);
  }
  for (const group of stage.groups) {
    const specs = queries[stage.id]?.[group.id] || [];
    if (!specs.length) console.log(`  ! ${group.id}: no queries`);
    for (const spec of specs) {
      for (const mode of withRising ? ["hot", "rising"] : ["hot"]) {
        const q = buildQuery(spec, mode, since);
        const data = await gh(searchUrl(q));
        const kept = (data.items || []).map(mapRepo).filter((r) => isRelevant(stage.id, group.id, r));
        const flag = kept.length < 3 ? "  ⚠" : "";
        console.log(
          `  ${group.id.padEnd(12)} ${mode.padEnd(6)} ${spec.topic.padEnd(24)} total ${String(data.total_count).padStart(5)} kept ${String(kept.length).padStart(2)}${flag}  ${kept
            .slice(0, 6)
            .map((r) => `${r.fullName}(${r.stars})`)
            .join(", ")}`,
        );
        await sleep(2200);
      }
    }
  }
}
console.log(`\ncurated problems: ${problems}`);
