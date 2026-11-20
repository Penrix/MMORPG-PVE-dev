# MMORPG-PVE｜世界生成工作台（WorldPack）

> **状态（2026-11-20）**：已实现独立 WorldPack Schema、运行任务、SQLite 包级草稿、编辑、世界关系、活动候选和原子 Canon 采用。未在本轮完成 CI/Node24 运行及真实模型内容验收。详细源码见 [04 WorldPack实际实现](mmorpg/04-world-pack-implementation.md)。

## 实际功能

1. 在 NarraLume 书架创建作品，进入“**世界生成**”。
2. 输入世界构想、当前世界时间，选择 **W0 整书世界底图**或 **W1 已有区域的深化**。W1 可指定已经采用的地点/社会区域ID，并提供类型文/Reader情绪/高价目标与稀缺性。
3. 选择“**制作新区域与内容**”或“**推进已有NPC / 组织的生活**”（世界 advance 模式）。
4. 模型使用原项目已采用的世界事实、关系、历史，连同[完整 v0.7 方法](mmorpg/research/world-v07-complete.md)选出的原文材料，产出一个带 **nodes/links/activities/openThreads** 的世界包。
5. 世界包里同时具有具体人物、组织、地点、物品、高价资源与进入路径；对象之间的关系以局部ID相连，历史已有角色引用既有Canon ID。结构/关系问题会阻止生成落库。
6. 包先保存在 `world_pack_drafts`，不修改已确认世界。作者可以看完整文字、关系、正在发生的事务，使用JSON修订并保存新版本。
7. 作者确认后“**整体采用世界包**”：程序分配真正的实体ID并在SQLite一次事务中建立对象、世界内容事实、位置、关系和持续活动，保留来源、锁定和原有版本。
8. 已采用的世界在工作台图谱中可按地点向外查看关联对象；后续 W1 或 world advance 可以继续使用同样的人、组织、资产和当前状态。
9. 每个采用对象都添加带来源的 `world.content` 事实，使原 NarraLume 正文编译器能够实际读到这批世界内容，而不是只能在世界生成界面查看。

## 直接可查的核心文件

- [世界包Schema和引用校验](../packages/contracts/src/world-pack.ts)
- [三步 AI WorldPack 生产器](../packages/narrative/src/world-pack-workers.ts)
- [W1 地理与社会关系上下文](../packages/narrative/src/world-pack-context.ts)
- [SQLite 世界包草稿仓储](../packages/persistence/src/world-pack-repository.ts)
- [世界包生成、修订、采用接口](../packages/services/src/world-pack-routes.ts)
- [唯一 Canon 的关系图投影](../packages/services/src/world-graph-routes.ts)
- [世界生成 React 工作台](../apps/web/src/workspaces/world-builder.tsx)
- [包级 API 集成测试](../apps/server/test/world-pack-api.test.ts)

## 设计来源

- **已接入真实原文**：[v0.1 母本](mmorpg/research/world-v01-original.md)、[v0.7 完整手册](mmorpg/research/world-v07-complete.md)、[世界生成章程](mmorpg/research/world-generation-charter.md)。
- **开源底座**：NarraLume 原有 React、Harness、Provider、SQLite、Canon、Story State/章节结算。
- **世界包和对象结构对标**：Covel / OnlyWorlds。
- **世界关系与活动对标**：WorldForge / SNEQ；当前写的是适配本项目的新TypeScript源码，不是直接复制这些仓库的实现。
- 详细 [Crosswalk](mmorpg/01-reuse-crosswalk.md)。

## 还不能宣称完成的事项

- 真正运行 Node >=24、npm >=11 的 `npm ci && npm run verify:ci`，以及带真实AI Provider的玄幻、历史世界包质量实演。
- 完整的NPC per-agent GOAP、自治世界多角色调度与物理仲裁、社会模拟。
- 更好的可视化地图/所见即所得世界包编辑器、原著史实材料自动核对。
- 第三模块进入尚不存在地图时自动生成 WorldContentGap 并暂停/恢复原章节；目前作者可主动打开世界生成。
- 已有长篇百万字连续运行和多世界分支的充分验证。

**交付边界**：这是可审阅的世界内容生产链源码，不是已证明能自动产出高质量商业男频长篇世界的最终产品。
