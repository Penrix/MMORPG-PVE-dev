# MMORPG-PVE｜当前文档权威地图

> **START HERE / 无上下文窗口先读本页。**
>
> 本页只回答一件事：**当前三大模块到底以哪些文档为准，哪些旧文档只能当实现记录或历史看。**
>
> 当前工程仓库：`Penrix/MMORPG-PVE-dev`。历史仓库 `Penrix/MMORPG-PVE` 不再接受当前 Module 1 / 2 / 3 正式实现。

## -1. 世界语义先于数据库结构

**先读：[28 世界语义总入口](28-world-semantic-layers-and-production-targets.md)。**

任何无上下文窗口必须先恢复：

```text
原生母体 = 世界本来怎样成立
认知母体 = Reader 进入前已经怎样理解、期待、定价
Project Reality = 本书到当前真正发生的唯一 Current
```

这三者是语义身份，不是三张必须独立建表的数据库。尤其禁止从“13 讲 Card + Typed Link”反推“Source World 只是百科仓库”，也禁止把 `VALUE` 或 Source Fact 直接当成认知母体。

第一模块同时存在两个合法生产目标：**Source World Production** 与 **Project Reality Expansion**。生产认知共用，Authority / 写入目标不同。当前代码已经分别跑通两条正式路径，见 28 / 16。

## 0. 当前总架构

```text
Module 1｜World Builder
创造世界内容
人 / 地 / 组织 / 力量 / 资产 / 活动 / 信息 / 价格 / 入口
        ↓ 作者采纳

Module 2｜Queryable Object Substrate
World Object Space = Source World / World Atlas + Project Reality
Creative Material Space = M03 等持续增长的创作素材库
Creative Operator Space = M01A / M02 / M03历史算法 / M04...M10 / TR02 等按需算子
People-centered = 世界对象默认叙事展开轴
        ↓ 当前世界对象 + 创意素材 + 可点名调用算子

Module 3｜Story Director
Wish-Fulfillment Frame（Reader意淫 / 男主之欲 / 多线程展开 / 承重）
× Upgrade Ladder
× Existing Cast
× 讲师编剧法
× M01B（升级 / 人物自己找事 / Reader张力常驻）
× Stake Ledger
= Story
        ↓
S05 Story Node
→ S06 Scene Expansion
→ S07 Reader Time
→ S08 Production Handoff
→ NarraLume draft / review / settlement
        ↓
Project Reality 更新
        ↺
世界内容不足时才回 Module 1
```

三模块最短定义：

```text
Module 1：什么值得男主去要？什么 Reality 能把它托贵？然后把它做成真正存在的世界内容。
Module 2：现在什么是真的？还能查询哪些世界对象、创意素材，以及按需调用哪些创意算子？
Module 3：当前哪几条意淫展开值得推进？靠什么 Reality 承重？这些已经存在的人怎样把它演成 Story 并兑现？
```

## 1. CURRENT AUTHORITY｜当前设计裁决

这些文件定义“现在系统应该是什么”。如果与旧文档冲突，以这里为准。

| 模块            | 文档                                                                                                        | 当前权威                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World Semantics | [28 原生母体 × 认知母体 × Project Reality × 双生产目标](28-world-semantic-layers-and-production-targets.md) | **世界语义总入口。** 先决定“这是什么世界语义、谁有 Authority”，再讨论存储/生产/读取；当前 Source World production 与第二模块 Cognitive Mother / Reader Semantics 已正式落地 |
| Module 2        | [13 World Atlas 轻量核心](13-world-atlas-lightweight-core.md)                                               | Source World 怎样保存：Card + typed links + derived index                                                                                                                   |
| Module 2        | [14 World Atlas Content Framework](14-world-atlas-content-framework-v01.md)                                 | 世界应该有什么；v0.1～v0.7 是 Content Schema，不是 SQL Schema                                                                                                               |
| Module 2        | [15 People-Centered Narrative Axis](15-people-centered-narrative-axis.md)                                   | 人是默认叙事展开中心，其他世界对象通过人与人 / 人与世界关系进入故事                                                                                                         |
| Module 2        | [25 World Objects × Creative Materials × Creative Operators](25-module2-dual-object-space.md)               | **对象空间权威。** 世界对象与创意素材都属于第二模块可查询底座；素材不是算法，也不是 Reality                                                                                 |
| Module 1        | [29 Wish-Fulfillment Selection × Bearing](29-wish-fulfillment-selection-and-bearing.md)                      | **第一模块选材权威。** 先决定什么世界对象值得男主/Reader意淫，再用Reality承重把它托贵；Coverage Audit不得冒充Creative Selection                 |
| Module 1        | [16 World Builder ← World Atlas](16-world-builder-from-world-atlas.md)                                      | World Builder = World Atlas Content Producer                                                                                                                                |
| Module 3 ↔ 2    | [17 Novel Studio ↔ World Atlas](17-module3-world-atlas-integration.md)                                      | Module 3 读取 Project Reality / Source Atlas 的正式边界与单一 settlement 写回                                                                                               |
| Module 3        | [23 Upgrade Ladder × Existing Cast × Stake Ledger](23-module3-upgrade-stake-director.md)                    | **故事发动机权威。** 升级路线写长，配角下注与反应写爽；已有世界人物是故事对象                                                                                               |
| Module 3        | [24 Creative Frame × Protagonist Camera × M Methods](24-creative-frame-protagonist-camera-m-methods.md)     | **结构权威。** S 是父层+前序区段继承的创作状态框架；M 算法与 Module-2 素材对象严格分离                                                                                      |
| Module 2 ↔ 3    | [26 M-series × TR-I-02 Creative Method Catalog](26-m-series-tr02-creative-method-catalog.md)                | **创作方法目录权威。** 逐项记录 M01A～M10 与 TR02 各版本仍有价值的搜索、发散、迁移和变奏方法；不覆盖 23 的 Story Director                                                   |
| Module 2 ↔ 3    | [27 M01B Embedded × Creative Operator Invocation](27-m-series-runtime-routing.md)                           | **方法运行时实现合同。** M01B内嵌第三模块；其他M/TR02进入第二模块算子空间，按需显式调用；自动主辅路由已停用                                                                 |

### 当前 Module 3 主链

```text
Reader Fantasy
→ Protagonist Desire
→ Wish-Fulfillment Threads（同一高价对象允许多条并行展开）
→ Bearing Evidence from Module 2
→ Upgrade Ladder
→ Current Stage Goal
→ Module 2 Existing Cast / Reality
→ M01B三前线持续深挖（Upgrade / Actor / Reader）
→ Scarcity / Established Belief / Advantage Gap
→ Three Camps + Stake Ledger
→ Story Node
→ Before / During / After
→ Scene
→ Reader Time
→ Production
→ Supporting-character Reaction / Payoff
→ Settlement / Retained Upgrade Assets
→ Next Upgrade Step
```

## 2. CURRENT SUPPORT｜当前仍有效，但必须服从上层权威

这些文件有真实实现价值，但**不能反过来覆盖 CURRENT AUTHORITY**。

| 文档                                                                                      | 仍然有效的部分                                                 | 不得怎样误读                                                                 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [10 Module 2 Cognition / Guardrails](10-module2-cognition-and-error-guardrails.md)        | Module 2 历次纠错与禁令                                        | 不能覆盖 13～15 最新轻量 Atlas 定义                                          |
| [11 World Fork / Diff / Character Invariants](11-world-fork-diff-character-invariants.md) | Source mother world 与 Project Reality Fork/Diff；人物内核稳定 | 不能把“人物内核稳定”误读成 Agent 可否决作者编剧线                            |
| [18 Story Runtime Core](18-story-runtime-core.md)                                         | Character Observation / Action / Arbitration 的实现子程序      | **不是第三模块总架构。** Agent 只在作者人物线内找符合人设的具体演法          |
| [19 Expectation / Narrative Runtime](19-expectation-narrative-runtime.md)                 | 稀缺、固有认知、信息差、Reader Time、payoff 连续性             | 旧的“设计不预设人物结果 / Agent拥有剧情否决权”措辞已被 23 覆盖               |
| [20 Object-Grounded Writers' Room](20-object-grounded-writers-room.md)                    | 想象必须有世界对象；故事不是监控录像；Object grounding         | S01/S02/S03 不再是三台独立故事生成器；它们只是同一 Upgrade Ledger 的尺度视角 |
| [21 S05 → S06](21-s05-story-node-s06-scene-expansion.md)                                  | 一个具体问题 Node → 多个 Before/During/After Scene             | Character Agent / Arbiter 只是 Node 内部 Reality rehearsal                   |
| [22 S08 Production Handoff](22-s08-production-handoff.md)                                 | S06/S07 锁定后接 NarraLume production                          | `scene.plan` 不是第二个 Writers' Room                                        |

## 3. IMPLEMENTATION / REFERENCE｜实现记录、迁移和源码复用依据

这些文档回答“代码当时怎么做 / 从哪里借 / 已经移植了什么”，**不是当前业务认知入口**。

| 文档                                                                | 用途                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [01 Reuse Crosswalk](01-reuse-crosswalk.md)                         | 对标源码、许可证与复用位置                                       |
| [04 WorldPack Implementation](04-world-pack-implementation.md)      | WorldPack 历史实现与代码地图                                     |
| [05 Actual Upstream Ports](05-actual-upstream-ports.md)             | 已实际移植的第三方源码                                           |
| [06 WorldForge Full Engine Port](06-worldforge-full-engine-port.md) | WorldForge 移植记录                                              |
| [07 Executable World Workshops](07-executable-world-workshops.md)   | 世界制作状态机/工作坊实现记录                                    |
| [09 Naruto Source Corpus Import](09-naruto-source-corpus-import.md) | 火影 Source Corpus 导入实现记录                                  |
| [research/README](research/README.md)                               | v0.1～v0.7 原始研究母本索引；Source Material，不是工程 Authority |

这些实现如果与 13～17、23～25 的业务定义冲突，应**适配当前业务定义**，不能拿旧实现反证新认知。

## 4. SUPERSEDED / HISTORY｜历史认知，不作为当前设计依据

这些文档保留是为了知道“我们为什么走到今天”，但新窗口不得把它们作为当前架构起点。

| 文档                                                                       | 当前地位                         | 被谁覆盖                               |
| -------------------------------------------------------------------------- | -------------------------------- | -------------------------------------- |
| [00 Architecture Decisions](00-architecture-decisions.md)                  | 早期架构形成史                   | 13～17、23                             |
| [02 World Builder Audit](02-world-builder-audit-and-design.md)             | 旧第一模块审查/目标设计史        | 16                                     |
| [03 Build Order / Acceptance](03-build-order-and-acceptance.md)            | 旧实施顺序                       | README + 16 + 23                       |
| [08 v0.1～v0.7 Database Crosswalk](08-world-database-v01-v07-crosswalk.md) | 需求研究史；“数据库化”解释已过期 | 14：v0.1～v0.7 = Content Schema        |
| [12 Original World Encyclopedia](12-original-world-encyclopedia.md)        | 专业百科阶段历史实现             | 13：轻量 Card + typed links 为当前核心 |

**SUPERSEDED 不等于删除。** 其中的历史事实、迁移号、实现证据仍可引用；只是其中的设计判断没有当前裁决权。

## 5. 无上下文窗口的强制阅读顺序

### 只想理解整个项目

```text
CURRENT.md
→ 28
→ 13
→ 14
→ 15
→ 16
→ 17
→ 25
→ 23
→ 24
→ 26
→ 27
```

### 修改 Module 1

```text
CURRENT.md
→ 28
→ 29
→ 14 / 15
→ 16
→ 13 / 17（确认 Source / Project 写入边界）
→ 01 / 04 / 05 / 06 / 07（仅查实现）
```

### 修改 Module 2

```text
CURRENT.md
→ 28
→ 13
→ 14
→ 15
→ 25（World Objects × Creative Materials）
→ 10 / 11（纠错与 Fork 语义）
→ 12（仅查历史实现）
```

### 修改 Module 3

```text
CURRENT.md
→ 25
→ 23
→ 24
→ 26
→ 27
→ 17
→ 21
→ 22
→ 19 / 20 / 18（只读取仍有效的子能力）
```

特别禁止：

```text
先读18 Agent Runtime
→ 把人物自主性抬成编剧权
→ Author不能设计震惊/投靠/犯错/下注
```

正确：

```text
Author / Director
决定故事目标、人物线、下注、payoff方向
        ↓
Character execution
按人设、利益、已知Reality选择具体演法
        ↓
World Arbiter
只检查硬Reality冲突
```

## 5.5 Wish-Fulfillment 纵轴属于三模块共享，不是第四模块

~~~text
Module 1
SELECT / BEAR
什么值得生产，什么 Reality 把它托贵

Module 2
GROUND
Source / Reader Semantics / Project Reality 提供可引用底盘

Module 3
REALIZE / SETTLE
多条意淫 thread 进入 Story、兑现、留下资产
~~~

当前共享合同在 `packages/contracts/src/wish-fulfillment.ts`。它是 author/director-side creative direction，不拥有 Source truth 或 Project Reality Authority，也不得进入 Character POV。

权益边界固定：**StoryUnit 只允许 `bearing / realizing`，不得提前写 `realized / retained`；只有作者接受 Chapter Settlement 后，匹配实际 retained gain 的意淫线程才能进入 `retained`。**

---
## 6. 三模块不可混淆的权限

### Module 1

创造世界内容，但**不替第三模块预写剧情**。同一套 World Builder 有两个合法 production target：

```text
Source World Production
→ 建设可被多项目重复引用的原生母体 Atlas

Project Reality Expansion
→ 为某一本正在运行的小说补真实世界缺口
```

两者共用十 Family / People-centered / 活动 / 价格 / 入口等生产认知，但 Authority 和写入目标不同。**当前两条 target 都是一等运行路径：Project target 写 Project Reality；Source target 走独立 Source production draft / review / adopt，最终只写 Source Atlas。**

### Module 2

保存 Source World 与 Project Reality，提供当前世界和人物关系网；同时保存可复用 Creative Materials 与可按需调用 Creative Operators，但**不决定故事结构**。M01B 不在 Operator Space，它属于第三模块常驻运行状态。

### Module 3

不凭剧情功能捏功能 NPC。默认直接使用 Module 2 已存在的人物，围绕男主 Upgrade Stage，用讲师方法设计；M01B 始终从“升级、人物自己找事、Reader张力”三个方向继续深挖，而不是作为一个可选步骤：

```text
稀缺
→ 固有认知
→ 配角下注
→ 信息差
→ 主角兑现
→ 配角反应
→ 阵营 / 关系 / 权限变化
→ 男主留下真实升级资产
```

如果世界真的缺人、缺组织、缺资源，返回 world gap 给 Module 1，而不是第三模块偷偷补世界。

## 7. 当前最重要的长期认识

> **世界不丢，人物不丢，关系不丢，升级路线不丢，配角下注不丢，已经赢到手的资产不丢，Reader尚未平仓的期待也不丢。**

这套外部认知结构的目的不是让 LLM 一次写得更花，而是让它能长期写百万字仍然知道：

- 世界里有什么；
- 当前什么是真的；
- 男主已经赢到了哪里；
- 周围的人各自押了什么；
- 下一次应该在哪里、和谁、以什么价格继续赢。
