# 男频新书榜定时采集池（3 天一轮）

本目录保存由 `.github/workflows/collect-newbook-rankings.yml` 每 3 天自动采集的三大男频平台新书榜累计数据，专门服务于 **TR-I-01 市场趋势分析** 与 **M03 素材库拆解**（刻意剔除月票榜、畅销老书榜）。

## 采集范围
- **起点**：签约作者新书榜（`signnewbook`）、公众作者新书榜（`pubnewbook`）、新人作者新书榜（`newauthor`）、三江推荐（`sanjiang`）
- **番茄**：男频各品类新书榜（`channel=1, type=1`，即 `/rank/1_1_*`）
- **刺猬猫**：新书榜（`newbook`，自动过滤女频并补全完整简介）

## 文件说明
- `newbooks.jsonl`：累计去重总库，每行包含 `id`、`platform`、`board`、`boardsSeen`、`category`、`title`、`author`、`intro`、`url`、`latestRank`、`firstSeenAt`、`lastSeenAt`、`seenCount`。
- `status.json`：最近一次采集时间、本轮新增/更新数量与各平台覆盖统计。

## 按时间窗口切片
使用 `tools/newbook-radar/newbook-pool-core.mjs` 中的 `filterNewbooksByWindow(records, { windowDays: 7 | 14 | 30 })`，随时只提取最近 7 / 14 / 30 天的新书，避免半年前的老风口混入当期分析。
