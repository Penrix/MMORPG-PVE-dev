# 第三模块｜Novel Studio 接入 World Atlas / Project Reality（2026-11-21）

> **STATUS: CURRENT AUTHORITY / MODULE 2 ↔ MODULE 3 BOUNDARY.** 本文定义 Source World reference、Project Reality current truth、POV/知识边界以及 Settlement 单一确认写回。第三模块不能另造第二套 Reality。

> **阅读前置：先读 [28 世界语义总入口](28-world-semantic-layers-and-production-targets.md)。** 本文中的 Source Atlas / Project Reality 是 Runtime 读写层；“原生母体 / 认知母体 / Project Reality”的语义分权不能被这里的 context transport 层压平。
>
> 本文件定义第三模块与当前第二模块的读写合同。
> Source World 是母体 reference；Project Reality 是当前项目事实；Novel Studio 不拥有第三套世界真相。

## 0. 一句话裁决

**Novel Studio 读取 Project Reality，必要时参考 Source Atlas；正文确认后仍通过现有 settlement 写回 Canon / Narrative State，再由 Project Reality 统一投影给下一轮。**

```text
Source World Card + Typed Relation
          │ reference
          ▼
      Project Reality
          │ current project truth
          ▼
   Module 3 Context Adapter
          │
          ├─ Scene Plan
          ├─ Chapter Draft
          ├─ Review / Revision
          ├─ Co-create
          └─ Author Assistant
                 │
                 ▼
        accepted Settlement
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 Canon Fact          Narrative State
                     relation/timeline/knowledge
       └─────────┬─────────┘
                 ▼
        Project Reality next read
```

## 1. 为什么需要 Adapter

NarraLume 原第三模块主要直接读取 Canon Entity / Canon Fact / NarrativeState / Retrieval。第二模块现在已经确立了 Source World Card + Typed Relation + Project Reality 的世界结构。如果第三模块继续绕开它，就会出现“Atlas 有一套世界，正文模型又自己拼一套世界”的平行结构。

因此第二模块 persistence 层新增 `WorldAtlasStoryContextBuilder`。它不替换 Canon，而是把 Project Reality / Source Atlas 投影成共享 ContextSource，供 narrative 与 services 同时消费。

## 2. 三层世界上下文

| 层                      | 内容                                             | authority | 使用位置                                                   |
| ----------------------- | ------------------------------------------------ | --------- | ---------------------------------------------------------- |
| Project Reality Current | 当前项目实体、Canon claims、项目关系与已发生事件 | confirmed | 作者侧步骤；无 POV 的叙事步骤                              |
| Source Atlas Baseline   | 母体身份摘要 + typed relations                   | reference | 作者侧步骤；无 POV 的叙事步骤                              |
| Source Atlas Full Card  | 完整 Markdown 母体卡片                           | reference | scene-plan / semantic-review / settlement / 作者 Assistant |

权威顺序固定：

```text
Project Reality
    >
Source Atlas reference
```

Source Atlas 不是项目当前事实，更不是项目未来。母体卡片与 Project Reality 冲突时，必须服从 Project Reality。

### 2.5 这里的“三层 Context”不是世界语义三分法

上表的 `Project Reality Current / Source Atlas Baseline / Source Atlas Full Card` 是**给模型传上下文的 Runtime 分层**。

世界语义仍按 28：

```text
Original Mother
= 世界本来怎样成立

Cognitive Mother
= Reader 已怎样理解、期待、定价

Project Reality
= 本书当前唯一确认事实
```

Cognitive Mother 不能因为当前 Adapter 尚未有独立字段就被删除。它未来只应进入 **author / director / Reader-product 侧语义**，不得因此泄漏给 character POV，也不得被写成 Source objective fact 或 Project Canon。

**当前代码状态：世界级 Cognitive Mother 仍不是整包自动注入 Module 3 的一等 ContextSource；但对象级 Reader Semantics 已作为 author-side `reader_semantics` reference surface 投影进入 Story Object Field。** 它提供 Reader 对具体对象的预装价格、期待、自然入口与注意触发，不是 Source objective fact，也不是 Project Reality，更不得进入 Character POV。

## 3. POV / 人物认知边界

接入 Atlas 不能破坏 NarraLume 原有的角色认知过滤。

共享访问策略：

```text
author
  → Project Reality + Source baseline + Full Source Card

narrative
  → Project Reality + Source baseline

character
  → 不直接注入全知 Atlas
  → 继续由 character-filtered StoryStatePacket 决定角色知道什么
```

因此：

- `scene-plan / semantic-review / chapter-settlement` 是 author access。
- 无 POV 的 draft/revision 可以使用 narrative access。
- 有 POV 的 draft/revision 不接收全知 Project Reality / Source Atlas，避免作者秘密和原著未来泄给角色。
- Co-create 中 character Persona 同样只依赖角色 StoryState；narrator 才使用 narrative Atlas context。

## 4. Source fallback 已改成当前 Atlas 核心

`SqliteProjectRealityRepository` 过去的 source fallback 会优先展开 Migration 053 的专业百科 dossier。现在规则变为：

```text
如果存在当前 Atlas Markdown Card
    Card + Typed Relations = Source reference truth
否则
    旧专业百科 dossier = compatibility fallback
```

这保证 Novel Studio 读取的确实是第二模块当前接受的轻量 World Atlas，而不是历史遗留的复杂专项表。

## 4.5 People-centered 关系排序

第二模块已经裁决：十个 World Family 是内容覆盖轴，People-centered 是叙事关系轴。因此第三模块读取 Source Atlas typed relations 时，不再沿数据库默认的 relation/name 排序直接交给模型。

Narrative Context 的关系展开顺序服从第二模块共享的：

```text
worldAtlasNarrativePriority()
```

即同一焦点对象存在大量邻接节点时，优先让模型先看到：

```text
具体人物
  ↓
组织 / 职位 / 人口群体
  ↓
地点 / 资源 / 物品 / 能力 / 信息 / 事件
  ↓
规则 / 技术 / 其他外围对象
```

这**不改变 Source Atlas 数据，也不删减非人物内容**，只是保证第三模块读取同一张图时继续服从第二模块的叙事轴，而不是重新退回平权邻接列表。

---

## 4.8 三模块共享 Wish-Fulfillment 纵轴｜2026-11-25

第三模块现在除 `UpgradeLedger / Expectation / StakeLedger` 外，正式读取同一份作者侧：

~~~text
WishFulfillmentFrame
├─ readerFantasy
├─ protagonistDesire
├─ threads[]
├─ bearingRequirements[]
└─ settlementTargets[]
~~~

这里最重要的不是多一个字段，而是恢复一条从产品目标到 Reality 的连续纵轴：

~~~text
Reader 想意淫什么
        ↓
这个男人自己现在想要什么
        ↓
围绕高价对象展开哪些值得写的变化
        ↓
什么 Reality 把这些变化托贵
        ↓
StoryUnit 推进具体 thread
        ↓
Settlement 留下真实资产
        ↓
下一轮更贵的意淫
~~~

### 意淫展开是多线程，不是单选关系

同一个人物可以同时存在 recognition / mentorship / need / private access / public backing / political alliance / affection / destiny rewrite 等多条线程。它们可以在不同章、卷逐渐进入、回返、叠加。当前 `WishFulfillmentThread[]` 就是为了防止模型把一个高价人物压成一个 `desiredRelation`。

### StoryUnit 的硬合同

当当前 Creative Context 存在 Wish-Fulfillment Frame 时，READY StoryUnit 必须：

1. 用 `wishFulfillmentAdvances[]` 明确本轮推进了哪些 thread、推进到哪一 phase、Story move 是什么；
2. 用 `bearingEvidenceRefs[]` 引用当前 `StoryObjectField` 的真实 surface，说明这轮幻想靠什么 Reality / Reader price / 人物 / 规则 / 权限承重；
3. 若缺关键承重，返回 `BLOCKED_WORLD_GAP` 给 Module 1，而不是第三模块临时造人、造世界或加平衡税。

Finalizer 会拒绝 READY + 有意淫帧但无 thread advance、无 bearing evidence、未知 thread、thread phase 倒退或不存在于 Object Field 的 bearing ref。

### Creative State 跨章节继承

采用后的 `mmorpgCreativeState` 现在同时继承 Upgrade Ledger、WishFulfillmentFrame、Stake Ledger、Expectation Threads、Retained Assets。因此高价关系已经走到哪一步，不应下一章失忆重置。

### Character Agent 仍然不知道 Reader 意淫

Wish-Fulfillment Frame 属于 Author / Director side。Character Observation 不注入 Reader 最终幻想、thread 最终 payoff 或作者全知未来。角色只知道自己的事实、关系、利益、资源、记忆、当前压力和局部人物线方向。这个边界与此前修复 `payoffReaction` 提前剧透是同一条纪律。

---
## 5. Settlement 写回不双写

章节正式结算继续使用已有成熟入口：

```text
Settlement accepted
   ├─ Canon Fact
   ├─ Timeline Event
   ├─ Relationship Event
   ├─ Knowledge
   └─ Foreshadow
```

禁止为了“适配 Atlas”再复制一份同样的事实到 `project_reality_revisions` 或另一张 Atlas 专用表。

Project Reality 是统一世界读取视图。已确认 Canon Fact、当前 relationship_events、以及实体参与过的 timeline_events 会直接投影成 Project Reality slots；**knowledge 仍由 StoryStatePacket 负责人物认知过滤**。这些都只是读取投影，不复制原生真相，因此仍然只有一个确认写入口，没有双真相同步问题。

## 5.6 Project Reality 直接投影原生关系与时间线

第三模块 settlement 已经把项目关系与事件写入 NarraLume 原生真相：

```text
relationship_events
timeline_events
```

因此 Project Reality 不应只恢复 Canon claims。当前读取会直接投影：

```text
canon_facts
→ claim

relationship_events
→ relationship

entity participant timeline_events
→ chronicle
```

这仍然**不是双写**。Project Reality 只是读取视图，不新增一份关系或事件真相。

Knowledge 不进入这层统一世界投影，因为：

> 数据库知道世界发生了什么，与某个角色知道什么，是两件不同的事。

角色认知继续由 StoryStatePacket / knowledge 体系过滤。

---

## 5.5 底座 schema 适配

第三模块正式调用 Project Reality 后，暴露出 NarraLume 底座两处“Migration 已升级、Repository/后续 schema 未跟上”的断口。本分支一并修复，因为它们正是底座适配当前第二模块所必需的。

### Migration 055｜Scoped Canon FTS 修复

Migration 052 已把 `canon_entities` 别名列统一为 `aliases_json`，但当时重建的 external-content FTS 仍声明 `aliases`，导致 FTS5 读取时寻找不存在的 `canon_entities.aliases`。

055 以新迁移重建：

```text
canon_entities_fts
name / aliases_json / description
```

并同步修正 insert / delete / update triggers。历史 052 不修改 checksum，已有数据库和新数据库通过 055 收敛。

### Migration 056｜Project Reality 事件版本 overlay

`SqliteProjectRealityRepository` 已经定义了：

```text
project_reality_revisions
  project + entity
  event + optional branch
  facet + slotKey
  set / unset
  optional canonFact pointer
  optional section JSON
```

但此前没有迁移真正创建该表。056 补齐这一 schema。

它不是第二套真相：

- `claim SET` 只保存 `canon_fact_id` 指针，不复制 Canon Fact；
- 非 claim 的世界 section 才保存事件版本 JSON；
- revision 必须绑定已有 timeline event；
- Project / entity / event / branch / fact 跨项目错配由数据库拒绝。

### Canon 默认 World Scope

Migration 052 把 `canon_entities.world_scope_id` 设为 `NOT NULL DEFAULT ''`，其中空字符串表示默认/未显式分区 world scope。

旧 `insertEntity()` 却显式传入 `NULL`，绕过 default。现在与已经正确的 update 路径统一为：

```text
entity.worldScopeId ?? ""
```

这三个修复共同保证旧 NarraLume Canon 写入口、搜索入口与 Project Reality 读取入口真正服从当前第二模块 schema。

---

## 6. 第三模块各入口 Crosswalk

| 第三模块入口                | Atlas 接入                                                              | 权限                  |
| --------------------------- | ----------------------------------------------------------------------- | --------------------- |
| Chapter scene-plan          | Reality + baseline + full card                                          | author                |
| Chapter draft 有 POV        | 不注入全知 Atlas；用 StoryState                                         | character             |
| Chapter draft 无 POV        | Reality + baseline                                                      | narrative             |
| Semantic review             | Reality + baseline + full card                                          | author                |
| Chapter revision            | 跟随 draft 的 POV 边界                                                  | character / narrative |
| Chapter settlement          | Reality + baseline + full card                                          | author                |
| Co-create character Persona | 不注入全知 Atlas                                                        | character             |
| Co-create narrator          | Reality + baseline                                                      | narrative             |
| Author Assistant            | 聚焦实体 Reality + baseline + full card；另显示已绑定 Source Corpus     | author                |
| Context Preview             | 使用同一 WorldAtlasStoryContextBuilder；仅 author/omniscient 注入 Atlas | author boundary       |

## 6.5 Context Preview 权限边界

Context Preview 不能因为是“预览工具”就绕过正式生成的知识权限。

当前规则：

```text
author / omniscient
→ 可预览 Project Reality + Source Atlas full author reference

character / reader
→ 不直接注入 author-level Atlas
→ 继续服从 CanonAccess / StoryState 知识边界
```

这修复了一个中断前审计发现的真实问题：旧实现虽然正式 Chapter pipeline 有正确的 POV 边界，但 Preview 曾无条件加入 current + reference + full card，可能让角色预览看到作者秘密或母体未来。

---

## 7. Assistant 不加载整个百科

作者 Assistant 是全知作者工具，但也不能每次把整个 Source World 几千张卡塞进上下文。

它按当前 `outlineNodeId` / selected document 找到 focal chapter，再从 `povEntityId + plannedEntityIds` 取得最多 40 个焦点实体，只为这些对象加载 Reality / Source Atlas 详细上下文。没有明确焦点时只列出项目绑定的 Source Corpus 元数据。

## 8. 防重犯

```text
第三模块需要世界信息
        │
        ▼
先问：项目当前事实，还是母体参考？
        │
   ┌────┴────┐
   ▼         ▼
Reality    Source Atlas
confirmed  reference
   │         │
   └────┬────┘
        ▼
再问：当前模型是作者视角还是角色视角？
        │
   ┌────┴──────────────┐
   ▼                   ▼
author/narrative     character
   │                   │
Atlas 分层进入       StoryState 认知过滤
   │                   │
   └─────────┬─────────┘
             ▼
          生成故事
             │
             ▼
       作者接受 Settlement
             │
             ▼
      单一确认写入口
```

禁止：

- 第三模块直接修改 Source World。
- 把 Source Card 当项目当前事实。
- 把原著未来自动推进成项目未来。
- 为了接 Atlas 重复写一份 Canon Fact / Relationship。
- Character POV 吃作者全知 Project Reality。
- Context Preview 与正式生成使用两套不同世界来源。
- Assistant 无焦点时把整个母体百科塞入上下文。

## 9. 当前定义

> **Novel Studio 是 Project Reality 的消费者，也是经作者确认后的 Reality 变化生产者。它通过统一 Adapter 读取第二模块；故事发生后的变化仍由 Canon / Narrative State 单写，随后成为下一轮 Project Reality。**

## 10. 2026-11-23｜第三模块现在读取第二模块的两类对象空间

17 原先只定义 Novel Studio 如何读取 Project Reality / Source Atlas。当前新增边界见 [25](25-module2-dual-object-space.md)。

第三模块的作者侧创作上下文现在分成：

```text
StoryObjectField
← Module 2 World Object Space
← 当前世界里真正可编剧的人、地、组织、能力、资源、关系与 Reality surfaces

CreativeMaterialSelection[]
← Module 2 Creative Material Space
← M03 等素材库里可拿来联想、碰撞、迁移和变奏的成熟创意对象

CreativeMethodInvocation[]
← Creative Algorithm layer
← 真正的 M 系列算法调用
```

三者不能互相冒充。

### World Object 的权限

- Project Reality confirmed surface 仍是当前项目真值；
- Source Atlas 仍只是 reference baseline；
- StoryObjectField 仍是本轮作者侧对象切片；
- Character POV 仍不能绕过知识边界。

### Creative Material 的权限

- 素材是 reference，不是 Project Reality；
- 素材没有当前世界 entity 身份；
- 素材不能进入 Character knowledge；
- 素材可以记录本次拿来碰撞的 `inputObjectIds`；
- 素材被采用为创意启发，不等于其中原故事事实被移植进本书；
- 只有本书实际写成、作者接受并 Settlement 的结果，才可能成为下一轮 Reality。

### 数据生命周期

Creative Material Library 与 World Atlas 一样是活数据库。它可以继续采集、修正和扩容，Runtime 只依赖稳定的查询接口，不依赖固定卡数或固定分类全集。

当前实现使用：

```text
external authoritative Markdown / curated index
        ↓ repeated import / upsert
text_segments(source_type = creative_material)
        ↓
CreativeMaterialRetrievalService
        ↓
CreativeMaterialSelection[]
```

因此第三模块只消费查询结果，不拥有素材库，也不负责把素材库冻结成系统提示词。
