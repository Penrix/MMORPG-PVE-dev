# 第三模块｜Creative Frame × Protagonist Camera × M Algorithms（2026-11-23）

> **STATUS: CURRENT AUTHORITY / MODULE 3 STRUCTURAL COMPLETION.**
>
> 本文与 [23 Upgrade Ladder × Existing Cast × Stake Ledger](23-module3-upgrade-stake-director.md)、[25 World Objects × Creative Materials](25-module2-dual-object-space.md) 和 [26 M-series × TR-I-02 Creative Method Catalog](26-m-series-tr02-creative-method-catalog.md) 一起构成当前第三模块权威。23 定义故事发动机与“什么值得写”；25 定义第二模块两类可查询对象空间；本文定义长期创作状态与方法端口；26 逐项记录现有 M / TR02 的真实搜索、发散、迁移和变奏方法。

## 1. 一句话

**S 系列是长篇创作状态框架；男主是故事推演的主摄像机；Module 2 提供 World Objects 与 Creative Materials；M 系列是作用于这些对象的创作算法。**

```text
NarraLume Outline Tree
父层状态 + 同层前序状态
        ↓
Creative Frame Context
        ↓
Protagonist Camera
        ↓
Module 2 World Object Space
StoryObjectField
        +
Module 2 Creative Material Space
CreativeMaterialSelection[]
        +
Creative Algorithms
CreativeMethodInvocation[]
        ↓
Story Director / 讲师方法
稀缺 → 固有认知 → 配角下注 → 信息差 → 主角行动 → 加注 → Payoff
        ↓
S05 Node
→ S06 Scene
→ S07 Reader Time
→ S08 Production
        ↓
Settlement
        ↓
Project Reality + Creative Frame 后续状态
```

## 2. S 系列到底是什么

第四代中枢金字塔的核心不是“每一层再调用一次模型”，而是：

```text
当前区段可读取
=
父层已经决定的东西
+
同层前面区段已经发生 / 决定的东西
+
当前 Project Reality
+
当前 Upgrade / Stake / Expectation 状态
```

因此 S 更接近 Creative State Space / Creative Frame Tree。

一个区段可以是：

```text
Book
→ Volume / Stage
→ Arc / Segment
→ Chapter
→ Scene
→ Beat
```

真正重要的是继承关系：

```text
Parent Frame
        │
        ├── Previous Sibling A
        ├── Previous Sibling B
        ├── Previous Sibling C
        └── Current Frame
```

当前 Frame 不从零开始。它读取 Parent 与 Previous Siblings，再继续往后写。

### 工程裁决

复用 NarraLume 现有：

- `outline_nodes.parent_id`
- `outline_nodes.ordinal`
- `book → volume → arc → chapter → scene → beat`
- 每个节点的 `goal / conflict / outcome / metadata`

不新建 S 专用数据库。

`StoryCreativeFrameContext` 是派生投影：

```text
currentFrame
+ parentFrames[]
+ previousSiblingFrames[]
+ inheritedState
```

它是作者侧创作上下文，不是新真相库。

## 3. 男主是摄像机是什么意思

不是限制正文必须第一人称，也不是否定配角戏。

它表示：

> Reader 通过男主的移动、目标、行动、冒险、升级与获得不断打开世界。

第三模块开始一轮故事设计时，先明确：

```text
男主现在在哪里？
现在是什么身份 / 实力 / 资产 / 处境？
当前想要什么？
这一步要升级什么？
准备对哪个世界对象采取什么行动？
```

然后面对 Module 2 World Object Space：

```text
这里已经有哪些人？
谁控制目标？
谁掌握入口？
谁拥有资源？
谁能教？
谁能阻挡？
谁已有怎样的固有认知？
谁会因男主行动受到利益影响？
```

剧情来自：

```text
男主行动
×
现成人物认知
×
现成人物利益
×
现成人物关系
×
世界规则 / 资源 / 权限
```

不是让 NPC 在摄影棚里自主走一天，再挑一段“最像故事”的录像。

## 4. World Objects 与 Creative Materials 是两种不同的创作对象

第三模块不能只有算法，还必须有对象。

### World Object

来自 Module 2 World Atlas / Project Reality。

它回答：

> 当前这本书里具体可以对谁、对什么编剧？

例如：

- 秀信；
- 木叶医院；
- 医疗忍者；
- 任务体系；
- 基础忍术；
- 某个真实组织；
- 某个当前资源；
- 某段已成立关系。

### Creative Material

来自 Module 2 Creative Material Space。

它回答：

> 有哪些成熟创意形状可以拿来撞当前世界对象？

例如 M03 素材库中的：

- BRG；
- MOVE；
- SIT；
- REV；
- SEQ；
- ARCH；
- REL；
- DLG；
- PLAY；
- CP；
- 未来继续增长的新分类。

素材本身不是本书世界事实。

正确关系是：

```text
World Objects
        ×
Creative Materials
        ×
Creative Algorithms
        ↓
new story possibilities
```

## 5. M 系列的正确身份

M 系列属于 Cross-Cutting Creative Algorithms。

真正的 M 算法回答：

> 面对当前对象和问题，应该怎样搜索、迁移、组合、回返、反推或变奏？

因此代码中的算法合同仍然是：

```text
CreativeMethodInvocation
- methodFamily
- methodId
- sourceRef
- scope
- purpose
- inputObjectIds
- instruction
```

它只用于真正的方法调用。

### M03 名称的历史歧义

TR02 / M03 早期同时含有算法思想与内置数据库。后来数据库不断扩大，今天 `database/m03` 已主要成为大型素材库。

所以：

```text
M03 historical algorithm ideas
→ 保留
→ 以后与其他 M 系列一起研究

database/m03 material cards
→ Module 2 Creative Material Space
→ 不是 CreativeMethodInvocation
```

TR02 各版本的方法谱系已在 [26](26-m-series-tr02-creative-method-catalog.md) 逐项恢复。不得把它重新压成一个“最新版巨型 Prompt”，也不得因此改写 23 已成立的 Story Director。

## 6. Creative Material 的合同

当前选中的素材通过：

```text
CreativeMaterialSelection
- libraryId
- materialId
- materialType
- status
- title
- summary
- sourceRef
- scope
- purpose
- inputObjectIds
- callWhen
- tags
- curationStage
- content
```

它保留两个关键事实：

1. 这张素材从哪个库、哪张原卡而来；
2. 本轮拿它去碰撞哪些 `StoryObjectField` 世界对象。

素材类型故意使用开放字符串，不把今天已有分类写死成永久 schema。

## 7. StoryCreativeContext 的当前结构

```text
StoryCreativeContext
├── frame
├── protagonistCamera
├── methodInvocations[]
└── materialSelections[]
```

其中：

- `methodInvocations[]` = 真正的创作算法；
- `materialSelections[]` = 第二模块召回的创意对象。

两条线都必须绑定当前世界对象，但它们不是同一种东西。

## 8. 长期创作状态

`StoryCreativeFrameState` 保存在现有 `outline_nodes.metadata.mmorpgCreativeState`。

每个区段可以携带：

```text
Upgrade Ledger
Active / Settled Stake Ledger
Expectation Threads
Retained Assets
Unresolved Questions
Reality Fingerprint
Story Unit provenance
```

下一 Frame 编译 Context 时：

```text
Parent Frames
+
Previous Same-Level Frames
        ↓
sourceStates 保留完整来源
        ↓
最近一份快照形成默认工作集
        ↓
settled Stake / settled Expectation
不进入 active working set
```

这是作者创作记忆，不是 Project Reality。

## 9. Protagonist Camera

`StoryProtagonistCamera` 包含：

```text
protagonistEntityId
currentLocation
currentState
currentGoal
upgradeNeed
activeMove
focusObjectIds
advantageRefs
assetRefs
```

注意：

- `UpgradeLedger.currentPosition` = 长期社会 / 实力 / 价格位置；
- `currentLocation` = 这一刻人具体在哪里；
- `currentState` = 当前身体、身份、资产、处境。

第三模块从“男主现在准备在这个世界干什么？”开始，而不是从“世界随机发生什么？”开始。

## 10. 男主装逼与配角反应的工程表达

“装逼”可以抽象为：

> 男主做出超出当前价格体系 / 固有认知的结果。

```text
男主行为
= 制造差值

配角下注
= 给差值定价

配角反应
= 情绪与现实结算
```

必须继续追到：

```text
因为他这样看男主
→ 他实际做了什么
→ 押了什么
→ 是否继续加注
→ 主角兑现后如何反应
→ Reality 中什么关系 / 权限 / 资源 / 身份改变
```

这与 23 的 Stake Ledger 一致。

## 11. 运行状态机

```text
[进入一个 Creative Frame]
        ↓
读取 Parent Frames
+
Previous Same-Level Frames
        ↓
恢复 Upgrade / Stake / Expectation
        ↓
定位 Protagonist Camera
        ↓
Module 2 查询 World Objects
        ↓
是否需要成熟创意对象？
   ┌────┴────┐
   是        否
   ↓         │
查询 Creative Materials
   └────┬────┘
        ↓
是否需要创作算法？
   ┌────┴────┐
   是        否
   ↓         │
调用 M Algorithm
   └────┬────┘
        ↓
Story Director
围绕男主行动编现成人物
        ↓
Stake / Information Gap / Node
        ↓
S06 Scene
        ↓
S07 Reader Time
        ↓
S08 Production
        ↓
Settlement
        ↓
Project Reality 更新
+
当前 Creative Frame 形成结果
        ↓
下一个同层 Frame 读取它
```

允许分叉、回返、重新查询素材、换算法，不要求每轮机械调用全部能力。

## 12. Guardrails

禁止：

- 把 S01～S08 当八台独立 LLM；
- 新建一套与 NarraLume outline 平行的 S 数据库；
- 让当前区段忘掉父层与同层前序区段；
- 让 Story Director 从“NPC今天自己干了什么”开始挑录像；
- 没有男主当前目标就自由生成剧情；
- 把 M03 素材卡当成 M 算法；
- 把 `CreativeMaterialSelection` 当世界实体或 Canon；
- 把素材库复制成一个固定阶段的静态 Prompt；
- 把当前 M03 卡数或分类全集写死进 Runtime；
- 让 M 算法自行确认世界事实；
- 把 `mmorpg-method-catalog.ts` 冒充第四代 M 系列；
- 为了调用算法或素材临时造功能 NPC；
- 让 Character Agent 因“理性 / 自主”取消已设计人物线。

## 13. 当前实现状态

已经落地：

- `StoryCreativeFrameContext`：从 NarraLume outline tree 编译当前 Frame、父层链和同层前序；
- `StoryCreativeFrameState`：Upgrade / Stake / Expectation / retained assets / unresolved questions 写入现有 outline metadata；
- `StoryProtagonistCamera`：Story Authoring 绑定男主当前状态、目标、行动与焦点世界对象；
- `CreativeMethodInvocation`：保留给真正的创作算法；
- `CreativeMaterialSelection`：单独承载素材对象；
- `CreativeMaterialRetrievalService`：按当前 Frame、男主目标和 World Objects 查询素材；
- `creative_material`：素材专用 retrieval source type；
- `import:creative-materials`：支持外部素材库重复 upsert；
- M03 当前索引可以作为第一个 Creative Material Library adapter；
- 旧 `creative-method-*` 名称只保留兼容壳，不再产生错误的 `creative_method` 数据语义。

## 14. 下一批工程缺口

当前主要剩余：

1. Module 2 People-centered Reality → Protagonist Camera 自动装配。
2. Settlement → Creative Frame State 自动结算。
3. 多 Node / 多 Frame 的升级、加注、期待转期与阵营变化连续推进。
4. Creative Material Library 的 UI / API 浏览、编辑、同步和更多素材库 adapter。
5. 按 [26](26-m-series-tr02-creative-method-catalog.md) 的方法目录，选择真实需要的方法逐个做 adapter / executor；不要先造万能 Algorithm Registry。
6. 当前先保持方法可独立、可回返、非线性调用；只有真实运行需求证明需要统一 Router 时再增加相应基础设施。

当前仍有意不自动化：

- `currentGoal / activeMove` 仍是作者侧创作输入；
- 素材召回是可调用能力，不要求每一步机械检索；
- M 算法调用也是按需，不按编号线性排队；
- Scene / Combat / Ability 等可以继续复用同一对象空间和算法端口，不再重复造方法系统。

最短记忆：

> **S 负责记住写到哪里；Module 2 负责提供世界对象和创意对象；M 负责怎么想；Director 负责把它们编成故事。**
