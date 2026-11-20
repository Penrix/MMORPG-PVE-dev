# 对标项目复用 Crosswalk｜除 NarraLume 底座以外究竟要吸收什么

> 日期：2026-11-20；状态：架构候选与已核对源码来源。**“借鉴”不等于“已经移植”。** PR #1 最初只复用 NarraLume 的 `canon-spread-candidate`；随后实现了新的 WorldPack生成/校验/采纳及图检索，参考 Covel/WorldForge 的架构与算法但**未直接复制第三方源码**。详情见 [04 真实代码](04-world-pack-implementation.md)。决定移植前须再次检查上游版本、测试和许可证。

## 0. 确定的主底座：NarraLume（Apache-2.0）

**不重写**：项目管理、书架、作者意图、`book→volume→arc→chapter→scene→beat` 大纲、Story Compass/长期故事线、滚动规划、正文生成/版本/编辑、审稿、章结算、Canon/实体/关系/时间线/知识、检索/上下文/模型供给/AI运行/备份。

已核查源头：

- [`packages/persistence/src/migrations/002-story-kernel.ts`](https://github.com/abligail/narralume/blob/main/packages/persistence/src/migrations/002-story-kernel.ts)：大纲节点、Canon、世界时间线及关系数据库。
- [`packages/context/src/compiler.ts`](https://github.com/abligail/narralume/blob/main/packages/context/src/compiler.ts)：语境预算与来源。
- [`packages/narrative/src/automation-workers.ts`](https://github.com/abligail/narralume/blob/main/packages/narrative/src/automation-workers.ts)：建书、滚动规划、阶段回顾。
- [`packages/narrative/src/workers.ts`](https://github.com/abligail/narralume/blob/main/packages/narrative/src/workers.ts)：章节工作流与结算。
- [`packages/narrative/src/settlement-application-service.ts`](https://github.com/abligail/narralume/blob/main/packages/narrative/src/settlement-application-service.ts)：Canon 变化采用事务。
- [`packages/services/src/canon-candidate-routes.ts`](https://github.com/abligail/narralume/blob/main/packages/services/src/canon-candidate-routes.ts)：当前世界生成原型复用的候选创建、列表、逐项采纳 API。

**裁决：NarraLume 是现阶段②和③的产品代码底座，①不是在它的通用 Canon 修改提示词外包一层按钮就可以结束。**

## 1. 其他项目：具体来源、迁移价值与处理方法

| 来源（2026-11-20核查）                                                               | 真正有用的东西                                                                                                                  | 具体源码/入口                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 目标落点                                                     | 复用方式及注意事项                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Covel](https://github.com/ackness/covel)**（MIT）                                 | **可分发、可编辑、可校验的世界包**；世界清单 `world.yaml`、`WORLD.md`、结构化世界数据、角色文件，按当前 schema 动态查询生成契约 | [`.claude/skills/create-world/SKILL.md`](https://github.com/ackness/covel/blob/main/.claude/skills/create-world/SKILL.md)、[`apps/server/src/world-data/validate-world-package.ts`](https://github.com/ackness/covel/blob/main/apps/server/src/world-data/validate-world-package.ts)、[`apps/server/src/world-data/schema-registry.ts`](https://github.com/ackness/covel/blob/main/apps/server/src/world-data/schema-registry.ts)                                                                                                                                                             | ① 世界包的生成/编辑/引用/校验/导出机制                       | **优先吸收架构**。借“发现有效生成契约 → 生产成套内容 → 稳定ID → 校验跨文件引用 → 可导入/扩展”，不要把骰子、插件运行时和游戏 UI 全盘装进小说产品，也不能只复制那条 Skill 提示词                                                                           |
| **[WorldForge](https://github.com/Fange12306/worldforge)**（MIT）                    | **世界实体关系图、图遍历、事件引发的相关索引更新；独立实体行动与模拟运行**                                                      | [`src-tauri/src/services/event_cascade.rs`](https://github.com/Fange12306/worldforge/blob/main/src-tauri/src/services/event_cascade.rs)、[`graph_traverse.rs`](https://github.com/Fange12306/worldforge/blob/main/src-tauri/src/services/graph_traverse.rs)、[`src/lib/simulation/agent.ts`](https://github.com/Fange12306/worldforge/blob/main/src/lib/simulation/agent.ts)、[`arbiter.ts`](https://github.com/Fange12306/worldforge/blob/main/src/lib/simulation/arbiter.ts)、[`engine.ts`](https://github.com/Fange12306/worldforge/blob/main/src/lib/simulation/engine.ts)                | ① 地图/组织/NPC可达关系、世界事务状态；②关系可视化的后端投影 | **优先借架构并选择性移植TS算法**。Rust/Tauri图服务不能直接等同于 NarraLume SQLite，应映射到现有实体ID和事件记录；数值 tick 是可选世界运行工具，不能让“模拟人口经济”代替 LLM 创造具体人物生活和高价内容                                                   |
| **[CampaignRepo](https://github.com/avorial/CampaignRepo)**（MIT）                   | Wiki 页面、别名/双链/反链、角色关系图、地图点位、家族树、可视化管理                                                             | [`app/api/campaigns/[id]/graph/route.ts`](https://github.com/avorial/CampaignRepo/blob/main/app/api/campaigns/%5Bid%5D/graph/route.ts)、[`app/campaigns/[id]/graph/graph-client.tsx`](https://github.com/avorial/CampaignRepo/blob/main/app/campaigns/%5Bid%5D/graph/graph-client.tsx)、[`lib/relationships.ts`](https://github.com/avorial/CampaignRepo/blob/main/lib/relationships.ts)、[`app/campaigns/[id]/maps/maps-client.tsx`](https://github.com/avorial/CampaignRepo/blob/main/app/campaigns/%5Bid%5D/maps/maps-client.tsx)                                                          | ② 世界百科工作台的地图、关系与跨页面浏览                     | **优先复用UI交互思路/可兼容组件**。不能把它的 Next.js/Git Wiki/登录/RPG跑团玩法整体替换现有 React/NarraLume。[`lib/generators.ts`](https://github.com/avorial/CampaignRepo/blob/main/lib/generators.ts) 为随机表式资料生成，不等于真正的世界内容生产引擎 |
| **[SNEQ](https://github.com/JeanDes-Code/sneq-narrative-system)**（MIT）             | **事件一次提交、事实投影、角色或群体所知事实、临时发明如何成为正典、知识传播**                                                  | [`src/core/commit-narrative.ts`](https://github.com/JeanDes-Code/sneq-narrative-system/blob/main/src/core/commit-narrative.ts)、[`derive-beliefs.ts`](https://github.com/JeanDes-Code/sneq-narrative-system/blob/main/src/core/derive-beliefs.ts)、[`promotion.ts`](https://github.com/JeanDes-Code/sneq-narrative-system/blob/main/src/core/promotion.ts)、[`holder-context.ts`](https://github.com/JeanDes-Code/sneq-narrative-system/blob/main/src/core/holder-context.ts)                                                                                                                 | ②/③之间的“事件发生 → 谁知道 → Reality如何变化”语义           | **先参考算法和事件协议**，不可平行部署另一套独立 SNEQ Canon 作为事实权威。NarraLume 已有 `canon_facts`、`knowledge_records`、`relationship_events`，只在有实际缺口时移植事件投影、认知传播或采用规则                                                     |
| **[Spindle](https://github.com/VerifiedOrganic/spindle)**（MIT）                     | MCP 工具设计、剧情状态/记忆层、事实变化事件流、章/场景提交回执、分支与连续性机制                                                | [`crates/spindle-adapters/migrations/V0051__canon_event_store.sql`](https://github.com/VerifiedOrganic/spindle/blob/main/crates/spindle-adapters/migrations/V0051__canon_event_store.sql)、[`V0055__layered_memory.sql`](https://github.com/VerifiedOrganic/spindle/blob/main/crates/spindle-adapters/migrations/V0055__layered_memory.sql)、[`crates/spindle-core/src/canon/reducer.rs`](https://github.com/VerifiedOrganic/spindle/blob/main/crates/spindle-core/src/canon/reducer.rs)、[`skills/profiles.toml`](https://github.com/VerifiedOrganic/spindle/blob/main/skills/profiles.toml) | ②历史事实/③长篇工作流、将来 MCP                              | **按功能借协议或外接窄 MCP**。不移植整套 Rust 数据库或全量 MCP 工具以致出现第二数据库和超长工具目录                                                                                                                                                      |
| **[OnlyWorlds](https://github.com/OnlyWorlds/OnlyWorlds)**（MIT）                    | 标准化世界实体和有类型的引用关系：Location、Zone、Map、Character、Institution、Object、Ability、Event、Relation 等              | [`schema/world.yaml`](https://github.com/OnlyWorlds/OnlyWorlds/blob/main/schema/world.yaml)、[`schema/location.yaml`](https://github.com/OnlyWorlds/OnlyWorlds/blob/main/schema/location.yaml)、[`schema/relation.yaml`](https://github.com/OnlyWorlds/OnlyWorlds/blob/main/schema/relation.yaml)、[`schema/zone.yaml`](https://github.com/OnlyWorlds/OnlyWorlds/blob/main/schema/zone.yaml)                                                                                                                                                                                                  | ①世界包类型设计、②对象关系/地图存储结构                      | **以 schema 作映射参照或按需使用 SDK**；不直接把 NarraLume 现有ID和表一键替换成 OnlyWorlds，也不要求所有小说世界都强制生成22类实体                                                                                                                       |
| **[MMORPG-PVE 现有旧Atlas](https://github.com/Penrix/MMORPG-PVE)**（私有、项目自有） | W0/世界对象生成原型、旧 `entries/facts/links/arrangements` / UI 结构、R2资料、MCP 与研究形成史                                  | `dist/atlas-core.js`、`dist/studio.js`、`worker/atlas-store.mjs`、`worker/mcp.mjs`、`WORLD-FORMAT.md`（只在私有仓库查看）                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ①原始算法/已有世界资料迁移，②数据导入和过渡                  | **保真迁移而不是弃库重来**。与 NarraLume Canon 统一ID映射、转换/校验、冲突日志；此公开 Fork 不复制私有世界数据或原文。                                                                                                                                   |

### 还有哪些项目不作为近期主底座

- [OpenNovel](https://github.com/Yaemikoreal/OpenNovel)：有多智能体、审批、快照，但与 NarraLume 现有创作系统重叠，不引入第二个完整写作框架；只对照某个缺口。
- [mythpen](https://github.com/niyongsheng/mythpen)：人物/世界/时间线界面可参考，但 **GPL-3.0**，不在没有许可证评估时直接复制源码到 Apache-2.0 Fork。
- 无明确可复用许可的项目：**研究其公开思路可以，但不擅自复制源代码**。
- 此处开源名单不是“全装”。选择每个模块前先确认它是否真的比 NarraLume 原有实现多一项**创造增益或工程能力**。

## 2. 复用路线按价值排序，而不是仓库名排序

```text
主底座: NarraLume (保留)
    │
    ├── 第一缺口: 世界能够成套生产和迭代
    │       └── Covel 世界包、动态schema、内容校验
    │           + OnlyWorlds 世界对象/引用建模
    │
    ├── 第二缺口: 世界中的连接能够被探索
    │       └── WorldForge 图遍历/事件级联
    │           + CampaignRepo Wiki、地图、双链前端
    │
    ├── 第三缺口: 世界不是静态卡片
    │       └── WorldForge entity-agent / arbitration
    │           + SNEQ 事件→事实/知情传播思路
    │
    ├── 第四缺口: 章节需要新世界时能主动请求①
    │       └── 对接 NarraLume context、story-state、run
    │
    └── 备选增强: Spindle 窄 MCP / 记忆与阶段回执
```

**世界生产的“创造思路”以 MMORPG 原有研究为主，对标项目负责可复用的结构、协议、算法、数据/界面组件。** 不能反过来让随机生成器或数值模拟框架裁决什么是商业男频高价内容。

## 3. 架构映射：外部源码不能产生第二份 Reality

| 外部对象                                | NarraLume当前已具备的概念               | 我们真正要新增的接口或投影                                                                             |
| --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Covel `world.yaml` / world package      | `Project` + `CanonEntity` + Story Bible | **`WorldPackDraft`** 作为独立生成/审阅包，采用后分配/绑定原有 Canon ID；保留包来源和各条记录的采纳结果 |
| Covel `characters.json` / content files | `canon_entities`                        | 具体人物的高价凭借、独立欲望与活动、社会位置；稳定关联其他实体                                         |
| OnlyWorlds Zone/Map/Location            | `canon_entities.type=location` 等       | W0/W1父子区域、社会地图与场所导航；不能只把所有地点压进长 description                                  |
| WorldForge Graph/Relation               | `relationship_events` + `canon_facts`   | 查询适用时间范围的实体邻接/有向关系 + 反向索引投影（不是第二个独立事实来源）                           |
| WorldForge Agent/Event                  | `timeline_events`、`canon_change_sets`  | 独立的行动候选及具体前后状态；通过原版审批事务提交，而不是 tick 自动覆盖 Canon                         |
| SNEQ Commit/Knowledge Holder            | `knowledge_records`、`canon_facts`      | 如果业务确需，增加传播/证据与事件投影算法；继续以原 Canon 为唯一 Reality                               |
| CampaignRepo Wiki/Maps                  | Story Bible + API                       | ①②的地图、人物关系、组织和宝物查询/编辑前端，读统一ID                                                  |
| Spindle MCP profile                     | NarraLume run/context/Canon             | 为外部模型提供精选世界查询和生成工具，避免堆满无关的几十个接口                                         |
| 私有旧 Atlas 世界对象                   | 自有JSON/R2                             | 正式迁移适配器、差异报告、回滚映射，不丢弃旧世界                                                       |

## 4. 工程复用约束与许可

1. 当前底座 NarraLume 是 Apache-2.0；Covel、WorldForge、CampaignRepo、SNEQ、Spindle、OnlyWorlds 所查仓库标注 MIT。若以后实际复制源码，请逐项保留许可、原始版权声明和必要 NOTICE，写到仓库第三方归属清单。**本轮仅研究和记录，不宣称已复制这些仓库的代码。**
2. 不一次性吞进 Tauri/Rust/Next.js/多套数据库等完整运行时。先借清楚的行为与接口，选择源代码可直接移植的 TypeScript 模块，再做完整测试。
3. 各上游代码变化快；本文文件路径是 2026-11-20 查阅时的来源，不是锁定了第三方版本的依赖清单。真复制代码时固定上游 commit SHA、许可证和仓内代码来源位置。
4. 数据和接口不能重名套叠：**NarraLume Canon 是唯一已确认 Reality**；世界包、NPC未来行动、创意组件与大纲是不同作用的资料，不能通过同名字段混成同一种事实。
5. **拒绝“只抄提示词=对标架构已经引入”**。每个来源都应有实现对象、集成点、实际状态流、测试与可用样本，才算真正复用。
