# MMORPG-PVE 开发资料导航

> 这是基于 [NarraLume](https://github.com/abligail/narralume) 的小说世界与长篇创作系统开发仓库。原版用户指南、数据库、写作流程、测试与许可**继续有效**；本目录只记录 MMORPG-PVE 新业务的决策和修正，不宣称已有功能已完成。

## 当前先读这四份

| 文件 | 解决的问题 |
|---|---|
| [00 架构决定及连续纠错](00-architecture-decisions.md) | 为什么 Fork NarraLume、三模块如何共用 Reality、为什么暂停特殊 S 系列开发、上一轮原型怎样被重新定性 |
| [01 对标源码复用 Crosswalk](01-reuse-crosswalk.md) | 除 NarraLume 外，Covel、WorldForge、CampaignRepo、SNEQ、Spindle、OnlyWorlds 和私有旧 Atlas 分别借什么，源码在哪里 |
| [02 第一模块代码审查和目标结构](02-world-builder-audit-and-design.md) | “第一模块是自己编的还是按对标项目开发的？”；清楚列出已有源码、没有移植的能力、WorldPack和世界运行的正确方向 |
| [03 实施顺序与实际验收](03-build-order-and-acceptance.md) | 从世界包、复杂内容生产、Canon 采用、世界关系图、NPC 动态到正文世界缺口往返 |
| [04 WorldPack 当前实际代码](04-world-pack-implementation.md) | 世界包生成/修订/原子采纳、图查询、NPC活动推进、正文实际上下文与待验收部分 |

另见原型说明：[当前 World Builder 技术入口](../mmorpg-world-builder.md)。

## 一句话判断

**保留 NarraLume 已有的②世界 Canon 和③小说系统；把①世界内容生产当成独立的世界制作业务来实现；优先借 Covel 的世界包、WorldForge 的关系/事件、CampaignRepo 的浏览界面，以及 SNEQ/Spindle 的特定状态机制。** 不是再造三个数据库，也不是把对标项目名称写进提示词就视为移植。

## 当前状态

- GitHub Fork：[`Penrix/MMORPG-PVE-dev`](https://github.com/Penrix/MMORPG-PVE-dev)，**当前公开**。
- 原 NarraLume 正文生成、版本、审阅、知识、Canon 和状态管理保持不变。
- 旧版只是提示词/Canonical候选接线原型；现在已经新增**独立WorldPack生成链、SQLite包级候选、引用校验、原子采纳和世界图查询代码**，但尚未完成CI或真实模型验收。第三方机制是参照后再实现，非直接源码移植。
- 本目录文档属于设计与实现指导，**不是**已通过模型/CI 验收的功能声明。
- 私有 `Penrix/MMORPG-PVE` 的 v0.1/v0.7 全文研究与旧 Atlas 是本项目原始资产；不要以本目录的提炼替换原文，也不要未经授权复制到本公开 Fork。

## 提醒

判断“世界生成做成了没有”，看一个具体世界有没有能够进入的地区、正在经营的组织、有独立生活的NPC、高价对象的实际所有权和接近路径；看这些人如何行动、世界如何继续演化、男主真正获得什么、下次到新地图是否仍记得旧世界。**文件存在、字段完整、提示词很长，都不是这些结果的替代品。**
