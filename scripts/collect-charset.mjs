// Collect every character that can appear on the site, then probe subset sizes.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");

// 1. Static copy
const files = [
  "index.html",
  "assets/app.js",
  "assets/styles.css",
  "data/curated.json",
  "data/live.json",
  "README.md",
];
let text = "";
for (const f of files) {
  text += await fs.readFile(path.join(ROOT, f), "utf8");
}

// 2. Live repo descriptions (these change every refresh -> need a safety net)
const live = JSON.parse(await fs.readFile(path.join(ROOT, "data/live.json"), "utf8"));
for (const repo of Object.values(live.curated || {})) {
  text += ` ${repo.description || ""} ${repo.language || ""} ${(repo.topics || []).join(" ")}`;
}
for (const stage of Object.values(live.stages || {})) {
  for (const mode of ["hot", "rising"]) {
    for (const repo of stage[mode] || []) {
      text += ` ${repo.description || ""} ${repo.language || ""} ${(repo.topics || []).join(" ")}`;
    }
  }
}

// 3. Everything the UI can render at runtime
const runtime = [
  "精选最热新锐编辑推荐星标语言更新于仓库个阶段结果实时显示全部收起展开清除搜索没有匹配的仓库试试更短的关键词或切换榜单模式",
  "数据加载失败请检查是否可访问或稍后重试重新加载实时不可用显示快照更新于可能已过期当前技术层精选仓库查询自动刷新",
  "GitHub Search API 创建近个月按降序质量过滤去重元数据补全教程书籍面试课程学习指南综述论文分享实战入门",
  "评测与任务定义算力与集群数据与训练模型设计推理服务运行时平台框架安全与权限观测数据飞轮一次请求的旅程接入上下文组装路由工具执行循环输出验证闭环降本可控规模化",
  "架构图一张看懂全链路越细节越能看见系统可编辑矢量海报张图包含代表项目下载完整原图方法榜单是怎么来的不把热度伪装成质量三种视角分开呈现并保留可追溯的数据来源",
  "评审打印适合用保留文字图形且每个都标注了核心模块来自的代表按覆盖度生态位置与可复用性人工挑选不按排序只保留最近个月创建仍活跃的",
  "只保留最近个月创建仍活跃的仓库适合发现下一批正在上升的项目不把热度伪装成质量三种视角分开呈现并保留可追溯的数据来源每次运行都重新抓取并部署",
  "静态同源读取无泄露获取刷新已经好上传成功失败检测到新的快照改动项目名目标部署触发工作流手动运行定时计划",
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  "·—…、。，；：？！“”‘’（）《》〈〉【】「」『』［］｛｝／＼｜～￥＆＠＃％＋－×÷＝＜＞←→↑↓★☆✓✕✦↗◉",
  "评测与任务定义算力与集群数据与训练模型设计推理服务运行时平台框架安全与权限观测数据飞轮核心能力模块代表项目一次请求的旅程接入上下文组装路由工具执行循环输出验证闭环降本可控规模化",
];
text += runtime.join("");

const chars = new Set();
for (const ch of text) chars.add(ch);

const han = [...chars].filter((c) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(c));
const hanExt = [...chars].filter((c) => /[\u3000-\u303F\uFF00-\uFFEF]/.test(c));
const other = [...chars].filter((c) => !/[\u3400-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/.test(c));

console.log("unique chars:", chars.size);
console.log("  hanzi:", han.length, " cjk punctuation:", hanExt.length, " other:", other.length);

const list = [...han, ...hanExt, ...other].sort();
await fs.writeFile(path.join(ROOT, "scripts", "subset-charset.txt"), list.join(""), "utf8");
console.log("charset written:", list.length, "chars");
