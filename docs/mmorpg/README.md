# MMORPG-PVE 开发资料导航

> **NO-CONTEXT START HERE：先读 [CURRENT.md](CURRENT.md)。** 它是当前文档权威地图，明确哪些文件是 CURRENT AUTHORITY、哪些只是实现参考、哪些已经 SUPERSEDED。**任何旧文档与 CURRENT.md / 当前模块权威文件冲突时，旧文档没有裁决权。**

> 这是基于 [NarraLume](https://github.com/abligail/narralume) 的小说世界与长篇创作系统开发仓库。原版用户指南、数据库、写作流程、测试与许可**继续有效**；本目录只记录 MMORPG-PVE 新业务的决策和修正，不宣称已有功能已完成。

## 2026-11-22 当前整合线：World Builder Atlas → Upgrade/Stake Story Director → NarraLume Production

当前三模块已经收敛为同一条长期小说闭环：**第一模块生产世界内容；第二模块保存 Source World 并维护 Project Reality；第三模块直接面对第二模块已有的人物网，沿 Upgrade Ladder 用讲师的稀缺/固有认知/三阵营/信息差/配角下注主动设计故事，再交 NarraLume 生产正文并通过 Settlement 写回 Reality。** 第一模块只在真实世界缺口出现时继续增量制作，不为剧情功能临时捏 NPC。

- **第一模块生产合同：[16 World Builder ← World Atlas](16-world-builder-from-world-atlas.md)**。World Builder 持续生产 Atlas Card / Typed Relation / 当前事务候选，并根据真实图结构缺口决定下一轮制作；这是第三模块 Object Field 的上游内容来源。
- **第三模块当前合同：[17 Novel Studio 接入 World Atlas / Project Reality](17-module3-world-atlas-integration.md)**。定义 Project Reality / Source Atlas 权威层、POV 认知边界、Chapter / Co-create / Assistant 接线和 settlement 单写原则。
- **第三模块最新核心：[23 Upgrade Ladder × Existing Cast × Stake Ledger](23-module3-upgrade-stake-director.md)**。当前最高优先级：第二模块已经提供世界和现成人物；第三模块沿既定升级路线，用讲师的稀缺/固有认知/三阵营/信息差/配角下注主动编故事。Upgrade Ledger负责写长，Stake Ledger与配角反应负责写爽；Agent只负责符合人设的具体演法，不得否决编剧线。
- **第三模块故事核心：[18 Story Runtime Core](18-story-runtime-core.md)**。冻结 Reality → Character Observation → independent Action → World Arbitration → speculative delta → Narrative Director / Horizon Rehearsal 的核心；NarraLume 原生 Chapter Pipeline 保留为正文生产下半段。
- **第三模块第二层：[19 Expectation / Narrative Runtime](19-expectation-narrative-runtime.md)**。定义“什么值得写 / Reader Time 投在哪里”：Reader需求 → 稀缺性 → 世界/圈层固有认知 → 主角优势 → 期待差 → 铺垫/人物下注 → 打破认知 → 三阵营反应 → 真实权益与下一笔期待。禁止用精彩度分数、临时震惊或单个NPC随手belief替代。
- **第三模块编剧上游：[20 Object-Grounded Writers' Room](20-object-grounded-writers-room.md)**。冻结两个最新作者裁决：故事不是监控录像，S04必须先主动设计；所有想象先有对象，S01-S03必须从Module 2 Object Field上搜索，再形成Concept/Engine、Stage Opportunity、Story Opportunity/Seeds。包含2026-11-22错误仓库漂移的Guardrail。
- **第三模块节点到场景：[21 S05 Story Node → S06 Scene Expansion](21-s05-story-node-s06-scene-expansion.md)**。纠正旧定义：S05本体是一个具体问题节点，Character Agent / World Arbiter只是节点内部Reality rehearsal；S06按讲师原稿把一个Node展开成多个before/during/after场景，S07保留Reader Time主权。
- **第三模块正文交接：[22 S08 Production Handoff](22-s08-production-handoff.md)**。S06/S07锁定后，确定性转换为NarraLume生产清单；有locked handoff时原生 `scene.plan` 不再调用模型二次编剧，`draft.generate` 只负责正文演奏，review/revision/settlement继续复用原链。
- **第二模块轻量核心：[13 World Atlas 轻量核心](13-world-atlas-lightweight-core.md)**。Source World 卡片正文是真相，typed links 是关系，索引可重建。

- **最新且最高优先级：[13 World Atlas 轻量核心](13-world-atlas-lightweight-core.md)**。后续 Source World 开发先读此文；若与 10～12 的旧设计复杂度冲突，以 13 为准。\n- **世界内容语言：[14 World Atlas 世界内容框架](14-world-atlas-content-framework-v01.md)**。v0.1～v0.7 是 Content Schema，不是 SQL Schema；十个 World Family 是并排的内容覆盖轴。\n- **叙事重心：[15 People-Centered Narrative Axis](15-people-centered-narrative-axis.md)**。人物是默认图谱展开、检索和 LLM Context 的中心，但不改数据库层级；两条轴共享同一批 Card + Typed Edge。

- **历史实现参考：[12 原生母体专业世界百科](12-original-world-encyclopedia.md)**。053/054 已落地结构保留，但不再把大量专项表视为当前 World Atlas 完成度中心；当前优先卡片编辑、typed links、反向关系和图谱。
- **最新认知：[11 世界 Fork/Diff 与人物内核恒定](11-world-fork-diff-character-invariants.md)**。原生母体是参考基线，项目 Canon 是持续改写的 Fork；人格锚点稳定，经历与现实状态可因故事改变。Migration 051 的第一版数据库映射与差异查询见本页。
- **必读：[10 已确认认知及历史错误禁令](10-module2-cognition-and-error-guardrails.md)**。此文记录母体/项目/跨世界/穿越/高价人物等历次误解，未来任务先读，不能凭旧记忆重新争论。
- **全库需求：[08 v0.1～v0.7 数据库 Crosswalk](08-world-database-v01-v07-crosswalk.md)**。七版是世界内容要求，不是七个单独 Prompt。
- **已经存在：[09 火影原生母体导入](09-naruto-source-corpus-import.md)** 和 Migration 049，不得再造第二份 Source Corpus。
- **本轮补强：Migration 050** 将项目人物 ↔ 来源人物、世界区域、事件时空坐标、跨世界/时间旅行对应到 NarraLume **同一项目 Canon**。楼兰的时间分支必须作者明确决定；不是穿越自动创建。
- **工程真值**：Migration / API / 自动测试成功、真实来源导入、已核实世界事实、真实小说回访是四种不同验收。任何一项未通过要明确报告。

## 实现 / 历史入口（理解当前架构前先读 CURRENT.md）

| 文件                                                                   | 解决的问题                                                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [00 架构决定及连续纠错](00-architecture-decisions.md)                  | 为什么 Fork NarraLume、三模块如何共用 Reality、为什么暂停特殊 S 系列开发、上一轮原型怎样被重新定性                |
| [01 对标源码复用 Crosswalk](01-reuse-crosswalk.md)                     | 除 NarraLume 外，Covel、WorldForge、CampaignRepo、SNEQ、Spindle、OnlyWorlds 和私有旧 Atlas 分别借什么，源码在哪里 |
| [02 第一模块代码审查和目标结构](02-world-builder-audit-and-design.md)  | “第一模块是自己编的还是按对标项目开发的？”；清楚列出已有源码、没有移植的能力、WorldPack和世界运行的正确方向       |
| [03 实施顺序与实际验收](03-build-order-and-acceptance.md)              | 从世界包、复杂内容生产、Canon 采用、世界关系图、NPC 动态到正文世界缺口往返                                        |
| [04 WorldPack 当前实际代码](04-world-pack-implementation.md)           | 世界包生成/修订/原子采纳、图查询、NPC活动推进、正文实际上下文与待验收部分                                         |
| [17 Novel Studio ↔ World Atlas](17-module3-world-atlas-integration.md) | 第三模块如何读取 Project Reality / Source Atlas、保持 POV 权限，并通过 settlement 单写回当前 Reality              |

**当前直接移植与研究全文**：[06 WorldForge完整模拟核心迁入](06-worldforge-full-engine-port.md) · [05 已移植的第三方源码和运行接线](05-actual-upstream-ports.md) · [v0.1～v0.7 七版独立母本](research/README.md)。**第二模块数据库需求**：[v0.1～v0.7 全覆盖差距及宇智波一族实例](08-world-database-v01-v07-crosswalk.md)。

另见 [World Builder 技术入口](../mmorpg-world-builder.md) 与 [07 可执行世界制作、状态继承与游戏试玩](07-executable-world-workshops.md)，后者记录本轮真正新增的生产状态机、互动行动和断点续作。

## 一句话判断

**保留 NarraLume 已有的②世界 Canon 和③小说系统；把①世界内容生产当成独立的世界制作业务来实现；优先借 Covel 的世界包、WorldForge 的关系/事件、CampaignRepo 的浏览界面，以及 SNEQ/Spindle 的特定状态机制。** 不是再造三个数据库，也不是把对标项目名称写进提示词就视为移植。

## 当前状态

- GitHub Fork：[`Penrix/MMORPG-PVE-dev`](https://github.com/Penrix/MMORPG-PVE-dev)，**当前公开，也是唯一正式 NarraLume 工程开发仓**。`Penrix/MMORPG-PVE` 为历史原型仓，不再接受当前三模块正式实现。
- 原 NarraLume 正文生成、版本、审阅、知识、Canon 和状态管理保持不变。
- World Builder 已有**独立 WorldPack 生产链、候选审阅、引用校验、原子采纳和世界图查询代码**，原 PR #4 的缺口驱动 World Atlas Content Producer 已吸收到 PR #5；PR #4 已关闭，避免两条兄弟分支长期漂移。第三模块直接在这套对象输出之上构建 Object Field。
- 本目录文档属于设计与实现指导，**不是**已通过模型/CI 验收的功能声明。
- 完整 v0.1～v0.7 七个独立研究版本已在用户明确公开授权下收入 [research](research/README.md)；旧 Atlas 在原仓库。原文不能被运行时摘录或简要指南替换。

## 提醒

判断“世界生成做成了没有”，看一个具体世界有没有能够进入的地区、正在经营的组织、有独立生活的NPC、高价对象的实际所有权和接近路径；看这些人如何行动、世界如何继续演化、男主真正获得什么、下次到新地图是否仍记得旧世界。**文件存在、字段完整、提示词很长，都不是这些结果的替代品。**
