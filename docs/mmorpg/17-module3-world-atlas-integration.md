# 第三模块｜Novel Studio 接入 World Atlas / Project Reality（2026-11-21）

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

| 层                      | 内容                               | authority | 使用位置                                                   |
| ----------------------- | ---------------------------------- | --------- | ---------------------------------------------------------- |
| Project Reality Current | 当前项目实体与已确认 project slots | confirmed | 作者侧步骤；无 POV 的叙事步骤                              |
| Source Atlas Baseline   | 母体身份摘要 + typed relations     | reference | 作者侧步骤；无 POV 的叙事步骤                              |
| Source Atlas Full Card  | 完整 Markdown 母体卡片             | reference | scene-plan / semantic-review / settlement / 作者 Assistant |

权威顺序固定：

```text
Project Reality
    >
Source Atlas reference
```

Source Atlas 不是项目当前事实，更不是项目未来。母体卡片与 Project Reality 冲突时，必须服从 Project Reality。

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

Project Reality 是统一读取视图。已确认 Canon Fact 会立即出现在下一次 Project Reality context；关系、时间线、认知继续由 StoryStatePacket 提供。这样只有一个确认写入口，没有双真相同步问题。

## 6. 第三模块各入口 Crosswalk

| 第三模块入口                | Atlas 接入                                                          | 权限                  |
| --------------------------- | ------------------------------------------------------------------- | --------------------- |
| Chapter scene-plan          | Reality + baseline + full card                                      | author                |
| Chapter draft 有 POV        | 不注入全知 Atlas；用 StoryState                                     | character             |
| Chapter draft 无 POV        | Reality + baseline                                                  | narrative             |
| Semantic review             | Reality + baseline + full card                                      | author                |
| Chapter revision            | 跟随 draft 的 POV 边界                                              | character / narrative |
| Chapter settlement          | Reality + baseline + full card                                      | author                |
| Co-create character Persona | 不注入全知 Atlas                                                    | character             |
| Co-create narrator          | Reality + baseline                                                  | narrative             |
| Author Assistant            | 聚焦实体 Reality + baseline + full card；另显示已绑定 Source Corpus | author                |
| Context Preview             | 使用同一 WorldAtlasStoryContextBuilder                              | author preview        |

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
