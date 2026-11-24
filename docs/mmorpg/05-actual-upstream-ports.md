# 真正移植的对标项目源代码与运行接线

> **STATUS: IMPLEMENTATION REFERENCE / PORT RECORD.** 本文用于证明实际移植了哪些上游源码、许可证和接线位置，不拥有 Module 1 / 2 / 3 的业务定义权。

> 2026-11-20 当前事实：此前只参考思想重写了 WorldPack 接口；后来纠正方向，**直接把下列 MIT 源代码移植到开发分支，并在调用路径中使用**。这与“某项目完整引擎已移植”是两件不同的事。完整说明见 [MIT 许可与原始 SHA](../../THIRD_PARTY_NOTICES.md)。

## 已经复制原项目代码，而不是重新发明

| 上游项目的真实源文件                                 | GitHub 原始 blob                           | 移植到本项目                                                 | 实际功能及调用                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Covel `packages/create/src/lore-processor.ts`        | `dbfc129c7f3a197a20c604e8cd4c53547dc5f551` | `packages/narrative/src/vendor/covel/lore-processor.ts`      | `world-pack-workers.ts` 使用 `parseWorldOutput()` 正式解析 `WORLD_YAML` / `WORLD_MD` / `WORLD_PACKAGE_YAML`                       |
| Covel `apps/server/src/world-data/source-order.ts`   | `2a67c97d5e8f06eaf8d2511a27892bbfc4547ce6` | `packages/narrative/src/vendor/covel/source-order.ts`        | 真实调用 `orderSources()`，把按当前对象选中的研究方法、原世界包、已确认Canon、作者请求按声明依赖排序                              |
| Covel `apps/server/src/world-data/revision-cache.ts` | `64bab876da828774ac99454c93f4cb518404c37f` | `packages/narrative/src/vendor/covel/revision-cache.ts`      | 真实调用 `createRevisionCache()` 缓存来源文件解析，避免重复计算，返回独立副本                                                     |
| WorldForge `src/lib/simulation/causality.ts`         | `afbe5ecf4a85c855cc00272e57fbc0cefe9585e7` | `packages/narrative/src/vendor/worldforge/causality.ts`      | `world-pack-workers.ts` 调用 `causalCandidates()`，从旧Canonical时间事件找出新活动的前因候选；**候选不等于事实，未自动写入Canon** |
| WorldForge `src/lib/simulation/registry.ts`          | `c15e31ddc0afbd2a7489fef5aa440367e57ccca3` | `packages/narrative/src/vendor/worldforge/registry.ts`       | 真实调用 `emptyRegistry()`、`tryRegisterDimension()`，由先前已采用世界包中的维度观察信号追踪工艺/力量/社会观念发展轴              |
| CampaignRepo `lib/relationships.ts`                  | `acbeeaa995e789e593723d5893ac833e846e7eca` | `packages/services/src/vendor/campaignrepo/relationships.ts` | `world-graph-routes.ts` 直接调用原 `getRelLabel()/getInverseLabel()`，世界关系图可取得主人/所属、领导/下属等正反向标签            |

实际移植的源代码放在 `vendor` 子目录，保留原版算法正文，额外添加具体上游路径、blob SHA 和 MIT 来源头；模块导入的 `.ts` 适配成 NarraLume ESM 使用的 `.js`；非常窄的 `types.ts` 负责类型适配，**不将 WorldForge 自有的国家模拟数据库误设成第二套 Canon**。

## 为什么没有把两整个项目压进本仓库？

NarraLume 本身已负责作者项目、正式Canon、卷弧章节、大纲、正文提交、上下文、模型Provider、运行器及SQLite。如果把 Covel 的跑团服务器、插件体系与 WorldForge 的 Tauri/Rust 国家物理模拟器整体塞进项目，会造成多个数据库、两套 API 和相互冲突的“世界真相”。

**但不能把这一点当成不移植真正引擎的借口**：现在移植的只是低依赖而确有价值的组件。用户指定“先移植成熟项目代码打底”，所以下一步更昂贵但必须做的是 Covel 世界生成/修订的主体机制、WorldForge 的独立EntityAgent与Arbiter（**本轮已按真实依赖移植并投入势力层调用**），再接 GM、NPC GOAP/Storylets 的项目特殊规则。**不能再声称参考了它们就已做完。**

## v0.1～v0.7 七版研究怎样进入运行

- [七个独立原文全集](research/README.md) 在源码仓库保真保存，不改成几张字段卡。
- `packages/narrative/src/mmorpg-method-catalog.ts` 带版号、文件与行号保存原文选段，并按当前世界范围和任务调用：v0.1 原始母本、v0.2 世界生成开放状态机、v0.3 超凡/力量、v0.4 男主 Build（只在明确要求时）、v0.5 游戏内容/玩法、v0.6 信息/社会/NPC记忆、v0.7 GM 与 NPC GOAP。
- `packages/narrative/src/world-pack-workers.ts` 在真实 AI 生成请求中通过 Covel **原始** `orderSources()` 汇总适用版本原文，旧世界包及已采纳 Reality，随后要求一个互相关联的世界包。
- 目前是**材料正确召回 + 外部底层代码接线**，并未将 v0.2 状态机、v0.5 Affordance 和 v0.7 GM/GOAP 全部变成独立可运行的算法。

## 已有的自动化验证与范围

- `packages/narrative/test/ported-upstream-modules.test.ts` 分别实测 Covel 原解析器、排序器、缓存和 WorldForge 原因果函数、维度注册算法。
- `packages/narrative/test/mmorpg-method-catalog.test.ts` 验证七版各有出处并能按 W0/W1、玄幻、是否已经指定男主进行差异调用。
- `apps/server/test/world-pack-api.test.ts` 用Mock模型测试 W0生成到作者采用、W1 ID继承、NPC活动/社会资产状态和正文上下文。
- **GitHub Actions 现已启用**。第一次失败日志显示Prettier / ESLint / TS问题，已逐项处理并继续查看最新 CI。仅在GitHub真实返回全部成功后，才写“CI通过”。

## 未完成，必须继续

- Covel 原主体 `packages/create/src/create-world.ts` 的多阶段生成、分区、修改、校验与修复及它的配套依赖。
- WorldForge 原 `agent.ts`、`arbiter.ts`、`engine.ts` 和全部纯 TypeScript 依赖 **现已直接移植并由 `world.advance` 使用势力Agent**。但其个人GOAP和完整世界时间同步尚未实现，见 [06](06-worldforge-full-engine-port.md)。
- CampaignRepo 图形关系 UI及其更多 Wiki / 地图交互；SNEQ 已移植纯 belief/salience 推导，但跨区域Carriage传播/官方记录/传言延误的Canon集成仍待实施；Spindle补强能力。
- 世界生成完整开放状态机，NPC按个人知识/目标/行动前提独立行动，GM对男主任意主动动作的世界裁定，长期世界游玩及创作回环的实际模型验收。

**目标状态**：对标成熟实现成为可执行工程基础；v0.1～v0.7 则使这些能力生产更昂贵、更有生活和更多可分叉玩法的男频世界。WorldPack/Canon负责存储采纳结果，不冒充创作引擎本身。
