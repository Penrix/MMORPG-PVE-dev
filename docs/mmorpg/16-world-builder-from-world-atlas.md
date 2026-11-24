# 第一模块｜从 World Atlas 反推 World Builder（2026-11-21）

> **STATUS: CURRENT AUTHORITY / MODULE 1.** 当前固定：World Builder = World Atlas Content Producer。第一模块创造世界里真实存在的人、地、组织、力量、资产、活动、价格与入口，并把它们接入人物社会网络；不为第三模块临时预写剧情。

> **阅读前置：先读 [28 世界语义总入口](28-world-semantic-layers-and-production-targets.md)。** 本文负责“怎样生产”，28 负责“生产的是哪一种世界语义、写到哪里、谁有 Authority”。
>
> **本文件是第一模块当前最高优先级工程合同。**
>
> 第二模块已经确定：
>
> - [13：World Atlas 轻量核心](13-world-atlas-lightweight-core.md) 定义资料怎样保存；
> - [14：World Atlas Content Framework](14-world-atlas-content-framework-v01.md) 定义世界应该包含什么；
> - [15：People-Centered Narrative Axis](15-people-centered-narrative-axis.md) 定义小说世界怎样以“人”为叙事中心被查询和展开。
>
> 因此第一模块不再从“怎样写一份世界观”正向自由发挥，而是从 **World Atlas 最终需要什么 Card + Typed Relation** 反向设计生产程序。

---

## 0. 一句话裁决

**World Builder = World Atlas Content Producer。**

第一模块的工作不是生成一篇“完整世界观”，而是持续生产：

```text
World Object/Card Candidates
        +
Typed Relation Candidates
        +
Current Activities
        +
Playable / Valuable Connections
        ↓
经过作者审阅
        ↓
进入 World Atlas / Project Reality
```

WorldPack 继续存在，但它只是**一次生产批次的 staging envelope**，不是世界的最终本体，也不是与 World Atlas 竞争的第二套世界模型。

### 0.5 两个合法 production target｜同一套 World Builder，不同 Authority

第一模块不能再被理解为“只给某一本小说的 Project Canon 补世界”。同一套生产认知有两个目标：

| Production Target             | 主要输入                                          | 候选产物                                       | 作者采纳后写入         | 权限                                |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------- | ---------------------- | ----------------------------------- |
| **Source World Production**   | 原始资料 / 已有 Source Atlas / Existing IP / 历史 | Source Card / Relation / 活动 / 价格与入口候选 | **Source World Atlas** | reference；不得自动变 Project Canon |
| **Project Reality Expansion** | 当前 Project Reality / story world gap            | WorldPack / project world delta                | **Project Reality**    | confirmed current after adoption    |

```text
                     World Builder
                    /             \
                   ▼               ▼
        Source World Target    Project Reality Target
                   │               │
          reusable mother       one novel current
```

两边共用十 Family、People-centered、CONNECT / ACTIVATE / PRICE / AUDIT 等生产认知。**区别是输入 Authority、证据要求和写入目标，不是两套世界设计理论。**

已有 IP 的 Source World Production 可直接从 ZONE / HUMANIZE / CONNECT / ACTIVATE / PRICE 进入，不要求 ROOT 重造火影、海贼等世界。LLM 补出的内容在无证据时只能保持 Candidate / inference / original expansion 身份。

> **当前实现状态：** Project Reality Target 已有正式 `/api/projects/:projectId/world-packs/*` 链路；Source World Target 尚未成为一等 runtime / API。本文先固定业务合同，下一轮代码改造再补正式接线，不能把“尚未实现”误写成“不属于第一模块”。

---

## 1. 第二模块给第一模块规定了输出合同

过去：

```text
Prompt
  ↓
一份世界设定文本 / 一个 WorldPack
  ↓
“看起来像世界”
```

现在：

```text
World Builder
  ↓
生产稳定对象
  ↓
生产对象之间的 typed relations
  ↓
把对象接入人物社会网络
  ↓
检查十个 World Family 的内容缺口
  ↓
继续扩张最值得补的部分
  ↓
World Atlas
```

### 一个对象不因“被生成”就算完成

例如生成“查克拉金属”时，只有：

- 产地
- 性能
- 价格
- 用途

仍然只是资料碎片。

它至少还应尽量回答：

- 谁生产？
- 谁控制？
- 谁会鉴定？
- 谁使用？
- 谁需要？
- 谁交易？
- 谁能把别人带进这个市场？
- 谁正在围绕它行动？

因此：

> **Node creation is not completion. A world object becomes useful after it is connected into the world graph.**

---

## 2. 两条 Atlas 轴怎样反推第一模块

### 2.1 World Content Axis 决定“需要生产哪些内容”

十个 Family 保持并排：

```text
People
Space
Organization
Power
Asset
Economy
Activity
Information
Value
Playable Content
```

它们不是十个 SQL 表，也不是十个一次性 Prompt。

它们是第一模块的**生产覆盖镜头**：

> 当前世界在哪些方向已经有真实内容，哪些方向仍然薄？

### 2.2 People-Centered Narrative Axis 决定“生产出的东西怎样接入故事世界”

每次生成非人物内容，都优先追问其人物接口：

```text
地点
→ 谁住这里 / 控制这里 / 能带人进入 / 正在这里行动

组织
→ 谁领导 / 谁真正掌权 / 谁执行 / 谁反对

资源
→ 谁拥有 / 生产 / 运输 / 买卖 / 争夺

能力
→ 谁掌握 / 教授 / 垄断 / 使用 / 反制

信息
→ 谁知道 / 隐瞒 / 传播 / 想知道

事件
→ 谁发动 / 参与 / 受益 / 受损
```

这不是要求所有对象必须有人归属。

真正非人的地形、灾害、自然规律、无主资源可以存在；但如果一个对象本来属于社会世界，却没有任何人物连接，World Builder 应把它视为**可能尚未制作完成**。

---

## 3. World Builder → World Atlas Production Crosswalk

| World Builder 工序 | 主要覆盖 Family                                        | 主要生产对象                                       | 必须优先寻找的人物连接                 |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------- | -------------------------------------- |
| geography          | Space / Playable                                       | location                                           | 谁生活、控制、通行、带入               |
| factions           | Organization / People / Value                          | organization / position / institution / population | 谁掌权、执行、争位、代表               |
| people             | People / Activity / Information                        | character / population                             | 与谁有私人/职业/权力关系，正在做什么   |
| economy            | Asset / Economy / Value                                | resource / item / work / technology                | 谁拥有、生产、运输、交易、消费、争夺   |
| power              | Power / Asset / Value                                  | ability / rule / technology / resource             | 谁掌握、教授、授权、使用、反制         |
| events             | Activity / Information / People                        | activity / event                                   | 谁发动、参与、受益、受损、知道         |
| social             | People / Organization / Information / Value / Playable | character / position / information / institution   | 谁能引荐、批准、阻碍、评价、泄密       |
| playability        | Playable / Space / Asset / Value                       | 不强制新增实体，主要补关系与可操作入口             | 谁提供入口、谁决定结果、拿到后还能找谁 |
| living             | Activity / People / Information / Value                | activity / event + 既有人物关系变化                | 已有人物凭现有资产和认知正在做什么     |

**注意：Crosswalk 不是固定流水线。**

它只告诉程序：

> 一个工序应该向 Atlas 的哪些方向生产，以及什么叫“这个工序真的生产出了东西”。

---

## 4. 第一模块新的生产状态机

```text
[空世界 / 已有 Source World / 当前 Project Reality]
        │
        ▼
① ROOT
建立世界根规则、时代、大尺度空间
        │
        ▼
② SKELETON
建立关键地区 / 组织 / 力量 / 资源骨架
        │
        ▼
③ ZONE
选择一个实际区域、行业或圈层向下制作
        │
        ▼
④ HUMANIZE
让地点、组织、资产、能力接上具体的人
        │
        ▼
⑤ CONNECT
建立 typed relations，消除“孤立设定”
        │
        ▼
⑥ ACTIVATE
让人物和组织拥有正在推进的现实事务
        │
        ▼
⑦ PRICE
明确社会价格、稀缺性、权限、入口和高价对象
        │
        ▼
⑧ AUDIT
用 World Atlas 两条轴检查缺口
        │
        ├─ 有重要缺口 → 回到对应工序继续生产
        │
        └─ 当前区域足够可用 → 结束本批 / 开下一 Zone
```

它是开放状态机，不是“八步全部跑一遍才算完成”。

例如：

- 已有 IP Source World 可以直接从 ZONE / HUMANIZE / CONNECT 开始；
- 已经非常丰富的历史城市可能只缺 ACTIVATE 或 PRICE；
- 一个新玄幻世界可能先需要 ROOT + SKELETON；
- advance 模式主要在 ACTIVATE → CONNECT → AUDIT 循环。

---

## 5. 世界缺口检测不是“字段完整率”

禁止：

```text
十个 Family 各有 1 项
= 100% 完成
```

World Builder 应检测**结构性缺口**。

### 典型缺口

```text
有 20 个 NPC
但没有任何人与人 / 人与组织关系
→ People 存在，但社会网络薄

有 15 个宝物
但没有持有人、生产者、争夺者、使用者
→ Asset 很多，但没有接入 People-centered 轴

有组织
但没有具体掌权人、岗位、资源和当前事务
→ Organization 只是标签

有地图
但没有通行、控制、社会入口和在此行动的人
→ Space 是空地图

有能力体系
但没人掌握、没人教、没人反制、没有社会价格
→ Power 是百科说明

有人、有组织、有资源
但没人正在做事
→ 世界是静态标本

有很多关系
但没有进入、获得、经营、享受、改变世界的可能
→ Playable Content 薄
```

因此缺口检测输出应是：

```text
Family
status: missing / thin / present
evidence: 当前真实对象和关系
reason: 为什么仍然薄
suggestedWorkshop: 下一步最合适的生产工序
```

而不是简单分数。

---

### Playable Content 不等于必须有 WorldAction

第一模块借鉴游戏行业的 Affordance / Exploration / Access / Reward 思想，但产物仍然是**文字世界**。

因此：

```text
Playable Content
≠ 必须先生成两个 action / quest / game button 才算完成

Playable Content
= 世界中已经存在可进入、可取得、可学习、可经营、可争夺、可享受的真实路径
```

例如：

```text
叶掌柜 ─领导→ 三江商会 ─控制→ 紫金矿
三江商会 ─经营于→ 紫霄坊市
紫金矿：价值明确
紫霄坊市：准入方式明确
叶掌柜：正在联合工匠竞买矿权
```

这已经是可用于小说的 Playable World Content，即使尚未另写一条 `WorldAction`。

`interaction / WorldAction` 是把现有世界路径进一步显式执行化的工具：

- 在需要检查“进入 → 行动 → 取得 → 留下权益”的闭环时很有用；
- 在 Project Reality advance 中，如果现状只有“能进入”却没有任何把现有权益转化成新权益的路径，可以触发 playability 工序；
- **但它不是所有新建世界批次的硬性完成条件。**

Atlas Audit 可以把没有显式 action 的区域标成 `thin` 供后续扩张，但不能仅凭这一点否定一组已经成立的文字世界内容。

---

## 6. WorldPack 的新定位

当前代码已经围绕 WorldPack 做：

- AI structured output
- 多对象内部引用
- 审阅
- 原子采用
- checkpoint
- production workshop

这些能力继续保留。

但它的语义改为：

> **WorldPack = 一次 World Builder 生产批次的候选集合。**

它不是：

- 新的世界百科；
- 第二模块替代品；
- “生成完整世界”的终点；
- 世界对象永久必须遵守的六类 Node Schema。

长期方向：

```text
World Builder Workshop
      ↓
WorldPack / Candidate Batch
      ↓ author review
World Atlas Card + Typed Relation / Project Reality
```

因此后续扩展 Card Type 时，优先服从 Atlas Content Schema，而不是不断扩大 WorldPack 自己的本体论。

---

## 7. 第一批工程改造

本文件落地后，第一批代码必须做到：

1. **Shared Production Crosswalk**
   - 在 contracts 中暴露 World Builder 工序 → Atlas Family / Card Kind / 人物连接问题。
   - 供 Narrative、UI、测试共用，不把这套认知复制进多个 Prompt。

2. **Atlas-oriented Deficiency Audit**
   - 对当前 WorldPack / Existing Reality 做十 Family 覆盖检查。
   - 区分 missing / thin / present。
   - 特别检查非人物内容是否接上人物社会网络。

3. **Work Order 带 Atlas 目标**
   - 每个工序明确 targetFamilies、suggestedCardKinds、peopleQuestions。
   - LLM 不再只收到“做 economy”，而知道要为 Atlas 生产什么。

4. **UI 取消“一次生成完整世界”的措辞**
   - 改成“生产/扩张世界内容”。
   - WorldPack 显示为一次候选生产批次。
   - 作者能看到当前 Atlas coverage/gap，而不是只看 Node 数量。

5. **不改数据库**
   - 此阶段是第一模块生产逻辑。
   - 第二模块现有 Card + Typed Edge 底座继续作为目标语言。

---

## 7.5 WorldPack 粗类型与 Atlas 逻辑类型

NarraLume 旧 WorldPack / Canon 只认识六种粗类型：

```text
character / location / organization / item / rule / concept
```

但第二模块 World Atlas 已经拥有更细的世界语言：

```text
resource / information / position / ability / technology / work / event ...
```

因此第一模块采用**双层类型兼容**，而不是重建数据库：

```text
Atlas logical kind         WorldPack coarse staging type
resource                → item
work                    → item
ability                 → rule
information             → concept
position / institution  → concept
technology              → concept
event / activity        → concept
creature                → character
```

新生成的 WorldPack 节点必须同时携带：

```text
type       = 旧底座兼容类型
atlasKind  = 真正的 World Atlas Card Type
```

例如：

```json
{
  "type": "item",
  "atlasKind": "resource",
  "name": "查克拉金属"
}
```

采用到 Project Reality 后，`atlasKind` 保存在 Canon attributes / world.content 中；下一轮 World Builder 再读取 Reality 时恢复该逻辑类型。

旧 WorldPack 没有 `atlasKind` 仍然可以读取，但只保留粗粒度语义，不凭空猜它过去究竟是“信息”“职位”还是“技术”。

> **这层兼容的目的正是让第一模块开始说第二模块的世界语言，同时不把 Content Schema 的成长错误翻译成 SQL/Canon Schema 重构。**

---

## 8. 防重犯

```text
想做一个新的 World Builder 功能
        │
        ▼
它最终会产生什么 Atlas Card / Relation？
        │
        ├─ 说不清
        │    → 先不要加生成器
        │
        └─ 说得清
             │
             ▼
这个对象怎样接入 People-centered 网络？
             │
        ┌────┴────┐
        │         │
     能接入      确实非人环境
        │         │
        └────┬────┘
             ▼
现有 Card + Typed Edge 能表达吗？
        │
        ├─ 能 → 不新增数据库结构
        └─ 不能 → 先证明缺口，再讨论新结构
```

---

## 9. 当前第一模块定义

> **World Builder 是一个开放式世界内容生产引擎。它读取现有 Source World / World Atlas 或 Project Reality，依据 v0.1～v0.7 的世界设计认知发现结构性缺口，选择实际世界对象作为生产目标，生成新的 Card/Relation/Activity 候选；当 target=Source World 时建设可复用原生母体，当 target=Project Reality 时扩张具体小说 Current。两者都持续把世界从“有设定”推进到“有人、有关系、有资产、有行动、有价格、有入口、可持续产生故事”，但绝不混淆 Authority 与写入位置。**

这就是第一模块接下来所有代码改造的总方向。
