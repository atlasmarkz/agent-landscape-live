# Agent 全链路技术架构 · Figma 可编辑图

## 文件

| 文件 | 用途 |
|---|---|
| `agent-architecture.svg` | 可编辑源文件，直接拖入 Figma；100 个仓库带 `<a>` 链接 |
| `agent-architecture.png` | 2880 × 4840 预览图 |
| `build_svg.py` | 生成脚本，改数据后重新生成 SVG 和 Figma 插件 |
| `figma-plugin/` | 导入 SVG 后运行，把仓库文本变成 Figma 原生 Hyperlink |

## 导入 Figma

1. 打开 Figma，新建 Design File。
2. 把 `agent-architecture.svg` 直接拖进画布（或 File → Place image）。
3. 导入后是一个 2880 × 4840 的 Frame，文字保留为 Text Layer，可直接改字、换色、拆组件。
4. 建议安装 **Inter** 与 **思源黑体 / Microsoft YaHei**，避免中文字体回退导致换行变化。

### 让仓库在 Figma 里真正可点击

SVG 里的 `<a>` 标签在浏览器中可直接点击；Figma 的 SVG 导入不一定保留超链接。用附带插件补上：

1. Figma 菜单 → **Plugins → Development → Import plugin from manifest…**
2. 选择 `figma-plugin/manifest.json`。
3. 运行 **Agent Diagram · GitHub Links**。
4. 插件会扫描当前页面所有 `owner/repo` 文本，自动设置 `https://github.com/owner/repo` 的 Hyperlink，并提示成功数量。

> 如果提示 0 个链接，说明 SVG 导入时文字被转成了轮廓。重新导入时保留 Text Layer 即可。也可以直接打开 SVG 在浏览器里点击仓库。

## 图里有什么

- **9 个阶段**：评测与任务定义 → 算力与集群 → 数据与训练 → 模型设计 → 推理服务 → Agent Harness → **Agent 平台与框架** → 安全与权限 → 观测与数据飞轮
- **61 个能力模块**：每个阶段 6–9 个关键组件
- **100 个代表 GitHub 仓库**，按阶段归类，全部可点击，包括：
  - 平台层：`langgenius/dify`、`coze-dev/coze-studio`、`n8n-io/n8n`、`langflow-ai/langflow`、`infiniflow/ragflow`
  - 框架层：`langchain-ai/langgraph`、`openai/openai-agents-python`、`pydantic/pydantic-ai`、`google/adk-python`
  - 训练与推理：`NVIDIA/Megatron-LM`、`volcengine/verl`、`vllm-project/vllm`、`sgl-project/sglang`、`LMCache/LMCache`
- **一次请求的 Token 旅程**：接入 → 上下文组装 → 路由 → Prefill → Decode → 工具执行 → 循环 → 输出
- **数据飞轮**：左侧虚线从生产 Trace 回接到训练阶段
- **三阶段落地路线**：验证闭环 → 降本可控 → 规模化

## 重新生成

```bash
python build_svg.py
```

会同时更新 `agent-architecture.svg` 和 `figma-plugin/` 里的仓库链接列表。修改脚本中的 `stages`、`journey`、`roadmap` 数据即可。仓库为各阶段代表项目，非穷举。
