# 第三模块｜Novel Studio 接入 World Atlas / Project Reality（2026-11-21）

> **本文件定义第三模块与当前第二模块之间的唯一正确接口。**
>
> 第三模块不另建世界数据库，不把 Source World 复制进小说项目，也不在正文结算后维护一份“Novel Studio Atlas”副本。
>
> 第二模块的当前基础：
>
> - [13：World Atlas 轻量核心](13-world-atlas-lightweight-core.md)
> - [14：World Atlas Content Framework](14-world-atlas-content-framework-v01.md)
> - [15：People-Centered Narrative Axis](15-people-centered-narrative-axis.md)

---

## 0. 一句话裁决

**Novel Studio 读取第二模块的 World Atlas / Project Reality，正文确认后继续写 NarraLume 原生 Canon / Timeline / Relationship；Project Reality 从这些原生真相投影，而不是第三模块双写另一份世界状态。**

~~~text
【写作读取】

Source World Atlas
Markdown Card + Typed Relation
        │
        │ authority = reference
        ▼
   Project Reality  ← Canon / Relationship / Timeline
        │                authority = confirmed
        │
        ▼
Novel Studio Context
        │
 scene plan / review / settlement
        ▼
正文


【正文结算】

已确认正文
    │
    ▼
chapter.settle
    │
    ├─ Canon Fact
    ├─ relationship_events
    ├─ timeline_events
    └─ knowledge / foreshadow
          │
          ▼
Project Reality 统一投影
          │
          ▼
下一章再次读取
~~~

---

## 1. 为什么不能再造第三模块世界数据库

NarraLume 原底座已经有：

- Canon Entity / Fact
- Relationship Event
- Timeline Event
- Character / Reader Knowledge
- Foreshadow
- Chapter settlement
- Author review

而第二模块已经把：

- Source World → Markdown Card + Typed Relation
- Project World → Project Reality

定义成统一世界入口。

如果第三模块再增加：

~~~text
novel_studio_world_cards
novel_studio_relations
novel_studio_current_state
~~~

就会立刻出现三份真相：

~~~text
Canon
Project Reality
Novel Studio World
~~~

随后必然需要同步、冲突处理和“到底听谁”的额外规则。

因此第三模块适配的原则不是“把第二模块复制过来”，而是：

> **让第三模块读第二模块；让第二模块投影第三模块已经确认的原生写入。**

---

## 2. Source World 与 Project Reality 的权威必须分开

第三模块看到的世界资料至少分两层。

### Source World Atlas

~~~text
authority = reference
~~~

它回答：

- 原著人物是谁
- 原著组织怎样构成
- 某能力谁掌握
- 地点与人物怎样连接
- 母体世界原本有哪些关系

它**不能**回答：

> “这本项目小说现在已经发生了什么？”

原著未来内容即使完整存在，也仍然只是 reference。

### Project Reality

~~~text
authority = confirmed
~~~

它回答：

- 项目中的人物现在是什么身份
- 这段故事已经建立了哪些关系
- 已经取得/失去什么
- 当前世界事实是什么
- 穿越、移动、事件已经怎样改变 Reality

因此：

~~~text
Source World Atlas
= 世界原本是什么

Project Reality
= 这本书现在已经变成什么
~~~

两者都进入作者侧写作上下文，但不能被压成同一种 Canon。

---

## 3. 第三模块的读取链

第三模块新增一个窄适配层：

WorldAtlasNarrativeContextBuilder

它只负责读取和组装，不修改世界。

### 3.1 Focal Entity

本章已经规划的人物 / POV 人物优先读取：

~~~text
Project Canon Entity
      │
      ▼
Project Reality
      │
      ├─ confirmed project slots
      ├─ current relationship network
      ├─ world affiliations
      └─ travel history
      │
      ▼
linked Source World Atlas Card
      │
      ├─ full Markdown
      └─ typed relations
~~~

### 3.2 Query Retrieval

章节标题、摘要、目标、冲突形成检索 query。

只搜索**本项目已绑定的 Source Corpus**，再解析到当前 Source World Atlas Card。

结果按 People-centered priority 排序：

~~~text
人物
 ↓
组织 / 职位 / 人口
 ↓
地点 / 资源 / 物品 / 能力 / 信息 / 事件
 ↓
外围规则 / 其他
~~~

这意味着写“木叶医院”时，不只给建筑简介，还能通过 typed relations 把真正活动于此的人带回来。

---

## 4. POV / Reader Knowledge 边界不能被 Atlas 绕过

World Atlas 是作者可以查询的世界资料，不等于 POV 人物知道所有资料。

因此当前接线：

| Purpose | Atlas / Project Reality |
|---|---|
| scene-plan | 作者视图，可用 |
| semantic-review | 作者视图，可用 |
| chapter-settlement | 作者视图，可用 |
| chapter-draft，有明确 POV | 不直接注入作者级 Atlas |
| chapter-revision，有明确 POV | 不直接注入作者级 Atlas |
| Context Preview，author | 可用 |
| Context Preview，character / reader | 不直接注入作者级 Atlas |

正文草稿继续服从原有 StoryStatePacket 的人物知识权限。

> **数据库知道，不代表人物知道。**

如果未来需要把 Source Atlas 的公开常识安全送入 POV，需要建立明确的 public/known-by 投影，而不是直接把作者世界卡全部塞进角色上下文。

---

## 5. Project Reality 的 Source fallback 必须读当前轻量 Atlas

此前 SqliteProjectRealityRepository 的母体 fallback 仍然主要读取 Migration 053 的 specialist encyclopedia dossier。

这与当前第二模块裁决不一致。

现在调整为：

~~~text
Project source identity
(corpusId + sourceKey)
       │
       ▼
canonical Source World
       │
       ▼
SourceWorldCard
Markdown + typed relations
       │
       ▼
Reality reference slots
~~~

旧 specialist dossier 继续保留为兼容 fallback：

~~~text
有当前 Atlas Card
→ Atlas Card 为优先母体资料

没有 Atlas Card
→ 旧 dossier 作为兼容 fallback
~~~

不删除旧数据，也不让旧结构继续主导新的写作链。

---

## 6. 正文写回不双写 Atlas

章节 settlement 已经会产生：

- factCandidates
- timelineCandidates
- relationshipCandidates
- knowledge
- foreshadow

采用后写入 NarraLume 原生：

~~~text
canon_facts
timeline_events
relationship_events
...
~~~

这些就是项目已经发生的真相。

Project Reality 现在直接投影：

~~~text
canon_facts
→ claim slots

relationship_events
→ relationship slots

timeline / travel / project world records
→ Project Reality 的时空和历史视图
~~~

因此禁止：

~~~text
chapter.settle
   ├─ write Canon
   └─ 再复制写一份 Atlas relation
~~~

正确的是：

~~~text
chapter.settle
   ↓
native accepted state
   ↓
Project Reality projection
~~~

**Projection 可以重建，accepted story truth 只保留一份。**

---

## 7. 为什么 Project Relationship 不能写回 Source typed relation

Source typed relation：

~~~text
卡卡西 ─老师→ 水门
~~~

属于母体世界 reference。

项目正文可能后来产生：

~~~text
卡卡西 ─怀疑→ 男主
卡卡西 ─保护→ 男主
~~~

这些属于 Project Reality。

即使关系名称相同，也不能把项目关系写回 Source World Card，因为：

1. 同一个母体世界可能服务多本小说；
2. 项目已经 Fork；
3. Source Card 是可复用百科；
4. 项目关系具有故事时间和 supersession。

所以第二模块内部实际存在：

~~~text
Source typed relation
= 母体参考索引

Project relationship_events
= 项目动态关系真相
~~~

Novel Studio 读取时可以统一呈现，存储时绝不能混写。

---

## 8. Semantic Review 也必须看到世界资料变化

如果写完正文并完成 semantic review 后，作者修改了：

- Source Atlas 卡片
- Project Reality
- 已确认 Canon world fact

旧 review 不应继续被当成对当前世界资料有效的审阅。

因此 World Atlas / Project Reality 已加入 editorial source fingerprint。

~~~text
世界资料变化
       ↓
source fingerprint 变化
       ↓
旧 semantic review 失效
       ↓
重新 review
       ↓
才能 settle / commit
~~~

这保证审阅不是基于一版过期世界继续放行正文。

---

## 9. 当前 Crosswalk

| 第三模块对象 | 第二模块对应 | 处理方式 |
|---|---|---|
| plannedEntityIds | Project Reality entity | focal query |
| POV entity | Project Reality + Story Knowledge | Reality 受知识权限约束 |
| 世界背景资料 | Source World Atlas Card | reference |
| 原著人物关系 | Source typed relations | reference |
| 项目已确认事实 | Canon → Reality claim | confirmed |
| 项目人物关系 | relationship_events → Reality relationship | confirmed |
| 已发生事件 | timeline_events | confirmed |
| 跨世界/时间移动 | Project World travel | confirmed |
| 正文章节 settlement | Canon/Timeline/Relationship native write | Reality 自动投影 |
| semantic review grounding | Atlas + Reality + Canon + manuscript | fingerprinted author source |

---

## 10. 防重犯状态机

~~~text
第三模块需要世界资料
        │
        ▼
第二模块已经有吗？
        │
   ┌────┴────┐
   │         │
  有         无
   │         │
   ▼         ▼
直接读 Atlas / Reality   先补第二模块能力
   │
   ▼
不要建立 Novel Studio 专用世界表


正文产生新事实
        │
        ▼
已经属于 Canon / Relationship / Timeline 吗？
        │
   ┌────┴────┐
   │         │
  是         否
   │         │
   ▼         ▼
写原生真相          证明第二模块确有缺口
   │
   ▼
Project Reality 投影
   │
   ▼
下一章读取


Source 世界发生变化？
        │
        └─ 不因为项目故事修改 Source

Project 世界发生变化？
        │
        └─ 不写回 Source Card
~~~

---

## 11. 当前第三模块定义

> **Novel Studio 是 Project Reality 的消费者和已确认故事事实的生产者。它从 World Atlas 获取母体世界 reference，从 Project Reality 获取本书当前 confirmed Reality；写作完成后仍通过 NarraLume 原生 settlement 将事实、关系、事件结算为项目真相。第二模块负责把这些真相投影成下一轮可查询的世界，而不是要求第三模块维护第二套世界副本。**
