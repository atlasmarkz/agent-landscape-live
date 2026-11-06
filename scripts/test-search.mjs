const q = process.argv[2] || "topic:llm-evaluation";
const token = process.env.GITHUB_TOKEN;
const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`;
const res = await fetch(url, {
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "test",
  },
});
console.log("status", res.status, url);
const d = await res.json();
console.log("total", d.total_count, "msg", d.message || "");
for (const i of d.items || []) {
  console.log(`${i.full_name} | ${i.stargazers_count} | ${i.description || ""}`);
  console.log("  topics:", (i.topics || []).join(","));
}
