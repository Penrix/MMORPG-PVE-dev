# MMORPG-PVE 开发资料导航

> 这是基于 [NarraLume](https://github.com/abligail/narralume) 的小说世界与长篇创作系统开发仓库。原版用户指南、数据库、写作流程、测试与许可**继续有效**；本目录只记录 MMORPG-PVE 新业务的决策和修正，不宣称已有功能已完成。

## 2026-11-21 当前任务：从第二模块反推第一模块 World Builder

第二模块 World Atlas 的底层已经收敛为 **Markdown 卡片 + typed relations + 可重建关系索引/图谱**，并明确了两条正交轴：

- **World Content Axis**：十个 World Family 并排，回答“世界里有什么”。
- **People-Centered Narrative Axis**：人物作为默认关系展开、检索和叙事生产中心，回答“故事从哪里发动”。

现在第一模块重新启动，并以第二模块作为**输出合同**：

- **第一模块总合同：[16 World Builder ← World Atlas 反推](16-world-builder-from-world-atlas.md)**。World Builder 不再生成一篇“完整世界观”，而是持续生产 Atlas Card / Typed Relation / 当前事务候选，并根据结构性缺口决定下一轮制作。
- **存储底座：[13 World Atlas 轻量核心](13-world-atlas-lightweight-core.md)**。卡片正文是真相，typed links 写关系，索引可重建。
- **世界内容语言：[14 World Atlas 世界内容框架](14-world-atlas-content-framework-v01.md)**。v0.1～v0.7 是 Content Schema，不是 SQL Schema。
- **叙事重心：[15 People-Centered Narrative Axis](15-people-centered-narrative-axis.md)**。人物中心改变 View / Query / Priority，不改变数据库层级。
- **必读纠错：[10 已确认认知及历史错误禁令](10-module2-cognition-and-error-guardrails.md)**。母体世界与项目 Reality 继续严格分开。

当前工程原则：**WorldPack 只是一轮生产候选的 staging envelope，不是世界本体；第一模块生产，第二模块保存/查询，第三模块写故事并结算项目 Reality。**

## 当前先读这五份

| 文件                                                                  | 解决的问题                                                                                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [00 架构决定及连续纠错](00-architecture-decisions.md)                 | 为什么 Fork NarraLume、三模块如何共用 Reality、为什么暂停特殊 S 系列开发、上一轮原型怎样被重新定性                |
| [01 对标源码复用 Crosswalk](01-reuse-crosswalk.md)                    | 除 NarraLume 外，Covel、WorldForge、CampaignRepo、SNEQ、Spindle、OnlyWorlds 和私有旧 Atlas 分别借什么，源码在哪里 |
| [02 第一模块代码审查和目标结构](02-world-builder-audit-and-design.md) | “第一模块是自己编的还是按对标项目开发的？”；清楚列出已有源码、没有移植的能力、WorldPack和世界运行的正确方向       |
| [03 实施顺序与实际验收](03-build-order-and-acceptance.md)             | 从世界包、复杂内容生产、Canon 采用、世界关系图、NPC 动态到正文世界缺口往返                                        |
| [04 WorldPack 当前实际代码](04-world-pack-implementation.md)          | WorldPack 生成/修订/原子采纳、图查询、NPC活动推进；现在重新定位为候选生产批次                                    |
| [16 World Builder ← World Atlas](16-world-builder-from-world-atlas.md) | 当前第一模块最高优先级：Atlas 输出合同、生产 Crosswalk、开放状态机、结构缺口检测与 People-centered 生产原则        |

**当前直接移植与研究全文**：[06 WorldForge完整模拟核心迁入](06-worldforge-full-engine-port.md) · [05 已移植的第三方源码和运行接线](05-actual-upstream-ports.md) · [v0.1～v0.7 七版独立母本](research/README.md)。**第二模块数据库需求**：[v0.1～v0.7 全覆盖差距及宇智波一族实例](08-world-database-v01-v07-crosswalk.md)。

另见 [World Builder 技术入口](../mmorpg-world-builder.md) 与 [07 可执行世界制作、状态继承与游戏试玩](07-executable-world-workshops.md)，后者记录本轮真正新增的生产状态机、互动行动和断点续作。

## 一句话判断

**保留 NarraLume 已有的②世界 Canon 和③小说系统；把①世界内容生产当成独立的世界制作业务来实现；优先借 Covel 的世界包、WorldForge 的关系/事件、CampaignRepo 的浏览界面，以及 SNEQ/Spindle 的特定状态机制。** 不是再造三个数据库，也不是把对标项目名称写进提示词就视为移植。

## 当前状态

- GitHub Fork：[`Penrix/MMORPG-PVE-dev`](https://github.com/Penrix/MMORPG-PVE-dev)，**当前公开**。
- 原 NarraLume 正文生成、版本、审阅、知识、Canon 和状态管理保持不变。
- 旧版只是提示词/Canonical候选接线原型；现在已经新增**独立WorldPack生成链、SQLite包级候选、引用校验、原子采纳和世界图查询代码**，但尚未完成CI或真实模型验收。其中部分第三方机制已实际移植 MIT 原始源码，且投入运行路径，详见 [05 移植记录](05-actual-upstream-ports.md)；完整引擎尚待续迁。
- 本目录文档属于设计与实现指导，**不是**已通过模型/CI 验收的功能声明。
- 完整 v0.1～v0.7 七个独立研究版本已在用户明确公开授权下收入 [research](research/README.md)；旧 Atlas 在原仓库。原文不能被运行时摘录或简要指南替换。

## 提醒

判断“世界生成做成了没有”，看一个具体世界有没有能够进入的地区、正在经营的组织、有独立生活的NPC、高价对象的实际所有权和接近路径；看这些人如何行动、世界如何继续演化、男主真正获得什么、下次到新地图是否仍记得旧世界。**文件存在、字段完整、提示词很长，都不是这些结果的替代品。**
