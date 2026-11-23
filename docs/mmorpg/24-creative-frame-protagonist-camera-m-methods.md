# 第三模块｜Creative Frame × Protagonist Camera × Cross-Cutting M Methods（2026-11-23）

> **STATUS: CURRENT AUTHORITY / MODULE 3 STRUCTURAL COMPLETION.**
>
> 本文补全 [23 Upgrade Ladder × Existing Cast × Stake Ledger](23-module3-upgrade-stake-director.md)。23 定义商业男频故事发动机；本文定义它怎样落进 NarraLume 的长期层级状态、怎样以男主驱动世界推演，以及 M 系列创作方法怎样横穿各层而不是被塞进某一个步骤。

## 1. 一句话

**S 系列是长篇创作状态框架，不是八台剧情生成器；男主是故事推演的主摄像机；M 系列是横穿世界、人物、能力、剧情、场景的可召回创作算法库。**

```text
NarraLume Outline Tree
父层状态 + 同层前序状态
        ↓
Creative Frame Context
        ↓
Protagonist Camera
男主现在在哪里 / 拥有什么 / 想得到什么 / 下一步要动什么
        ↓
Module 2 Existing World Objects / Reality
        ↓
Cross-cutting M Method Invocation
找好处 / 找入口 / 找关系 / 设计能力 / 技能进化 / 战斗解法 / 新点子……
        ↓
Lecturer Story Method
稀缺 → 固有认知 → 配角下注 → 信息差 → 主角行动 → 加注 → Payoff / 反应
        ↓
S05 Node → S06 Scene → S07 Reader Time → S08 NarraLume Production
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

因此 S 更接近 **Creative State Space / Creative Frame Tree**。

一个区段可以是：

```text
Book
→ Volume / Stage
→ Arc / Segment
→ Chapter
→ Scene
→ Beat
```

真正重要的不是名字，而是继承关系：

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

NarraLume 已经有：

- `outline_nodes.parent_id`
- `outline_nodes.ordinal`
- `book → volume → arc → chapter → scene → beat`
- 每个节点的 `goal / conflict / outcome / metadata`

所以 **不新建 S 专用数据库**。

新增的是一个派生投影：

```text
StoryCreativeFrameContext
=
current frame
+ parent chain
+ previous same-level frames
```

它是作者侧创作上下文，不是新真相库。

## 3. 男主是“摄像机”是什么意思

不是限制正文必须第一人称，也不是否定配角戏。

它表示：

> **Reader 通过男主的移动、目标、行动、冒险、升级与获得不断打开世界。**

第三模块开始一轮故事设计时，必须先明确：

```text
男主现在在哪里？
现在是什么位置 / 身份 / 实力 / 资产状态？
当前想要什么？
这一步要升级什么？
准备对哪个世界对象采取什么方向的行动？
```

然后才面对 Module 2：

```text
这里已经有哪些人？
谁控制目标？
谁掌握入口？
谁拥有资源？
谁能教？
谁能阻挡？
谁已经形成错误/正确认知？
谁会因男主行动受到利益影响？
```

剧情来自：

```text
男主行动
×
现成人物的认知
×
现成人物的利益
×
现成人物的关系
×
世界规则 / 资源 / 权限
```

而不是让 NPC 在摄影棚里自主走一天，再挑一段“最像故事”的录像。

## 4. 男主装逼与配角反应的工程表达

“装逼”不是只能写炫耀，它可以抽象为：

> **男主做出超出当前世界价格体系 / 固有认知的结果。**

```text
男主行为
= 制造差值

配角下注
= 给差值定价

配角反应
= 情绪结算
```

所以第三模块必须从“人物怎么看男主”继续追到：

```text
因为他这样看男主
→ 他实际做了什么
→ 押了什么
→ 是否继续加注
→ 主角兑现后如何反应
→ Reality 中什么关系 / 权限 / 资源 / 身份发生变化
```

这与 23 的 Stake Ledger 完全一致。

## 5. M 系列不是 Module 4，也不是某一步 Prompt

M 系列属于 **Cross-Cutting Creative Method Library**。

它可以在任何创作对象上被调用：

| 当前问题    | M 方法可以帮助做什么                                     |
| ----------- | -------------------------------------------------------- |
| 世界        | 哪个区域值得深挖、哪里有高价内容、哪些对象能组合出新玩法 |
| 男主 Build  | 金手指、职业路线、能力结构、个人构筑                     |
| 能力 / 技能 | 招式怎么打、怎么解说、怎样反制、怎样进化                 |
| 资源 / 矿场 | 男主应该去哪里捞好处、谁控制、怎样取得                   |
| 人物关系    | 哪两个人 / 哪几个人之间还能产生什么昂贵互动              |
| Story       | 新点子、变奏、迁移、组合、反转、升级玩法                 |
| Scene       | 这一场具体怎么演、谁先动作、怎样加价、怎样兑现           |
| Combat      | 动作、策略、克制、反制、能力联动                         |

因此代码上只提供通用调用端口：

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

**方法不拥有世界对象。**

M 方法只能作用于：

- Module 2 已有对象；
- 当前 Creative Frame；
- 男主当前目标；
- 当前 Story / Scene 的明确问题。

M 返回的是候选、连接、玩法或推演，不自动成为 Canon。

## 6. 三种东西不能再混在一起

| 系统                    | 回答的问题                                         | 是否生成剧情                 |
| ----------------------- | -------------------------------------------------- | ---------------------------- |
| S / Creative Frame      | 我现在写到哪里？父层和前面已经决定了什么？         | 否，主要是状态/记忆框架      |
| M Method                | 面对当前对象和问题，还有什么可想、可变奏、可组合？ | 可提供候选，但不是最终编剧权 |
| Story Director + 讲师法 | 这批现成人物围绕男主当前升级到底怎样演成故事？     | **是**                       |

## 7. 与现有代码 Crosswalk

| 现有代码                   | 当前解释                          | 动作                                                                  |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| NarraLume `outline_nodes`  | S Framework 的物理底座            | 保留；新增 Creative Frame 投影                                        |
| `StoryUpgradeLedger`       | 男主长期 Road / 升级账            | 保留                                                                  |
| `StoryStakeLedgerEntry`    | 配角认知→下注→加注→反应账         | 保留                                                                  |
| `StoryObjectField`         | Module 2 世界对象切片             | 保留，但不再把“对象召回”神秘化成故事生成                              |
| S01/S02/S03 search         | 旧工程形成的三个尺度搜索器        | 降级为可选 lens；不是 S Framework 本体                                |
| S04 `StoryUnitDesign`      | 当前一段主动编剧                  | 保留，并绑定 Creative Frame + Protagonist Camera + Method Invocations |
| Character Agent            | 人物具体演法                      | 保留，不能否决 Author Story Line                                      |
| World Arbiter              | 硬 Reality 可行性                 | 保留                                                                  |
| S05→S08                    | Node→Scene→Reader Time→Production | 保留                                                                  |
| `mmorpg-method-catalog.ts` | v0.1～v0.7 世界设计方法目录       | 保留；**不是 M 系列**                                                 |

## 8. 新增合同

### StoryCreativeFrameContext

从现有 outline tree 派生：

```text
currentFrame
parentFrames[]
previousSiblingFrames[]
digest
```

其中 `metadata` 允许继续承载 Upgrade / Stake / Expectation 等长期创作状态指针，而不要求新建平行 S 表。

### StoryProtagonistCamera

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

它保证第三模块不是从“世界随机发生什么”开始，而是从：

> **男主现在准备在这个世界干什么？**

开始。

### CreativeMethodInvocation

M 系列和未来其他创作算法统一走这个横切端口，不硬编码某一套方法内容。

## 9. 运行状态机

```text
[进入一个 Creative Frame]
        │
        ▼
读取 Parent Frames
+
读取 Previous Same-Level Frames
        │
        ▼
恢复 Upgrade / Stake / Expectation 状态
        │
        ▼
定位 Protagonist Camera
        │
        ▼
读取 Module 2 当前 Reality / Existing Cast
        │
        ▼
需要创意搜索？
   │             │
  是             否
   │             │
调用 M Methods   │
   └──────┬──────┘
          ▼
Story Director
围绕男主行动编现成人物
          ▼
Stake / Information Gap / Node
          ▼
S06 Scene
          ▼
S07 Reader Time
          ▼
S08 Production
          ▼
Settlement
          ▼
Project Reality 更新
+
当前 Creative Frame 形成结果
          ▼
下一个同层 Frame 读取它
          ↺
```

## 10. Guardrails

禁止：

- 把 S01～S08 当八台独立 LLM；
- 新建一套与 NarraLume outline 平行的 S 数据库；
- 让当前区段忘掉父层与同层前序区段；
- 让 Story Director 从“NPC今天自己干了什么”开始挑录像；
- 没有男主当前目标就让模型自由生成剧情；
- 把 M03 / M系列卡片复制成某个固定阶段 prompt；
- 让 M 方法自行创造并确认世界事实；
- 把 `mmorpg-method-catalog.ts` 冒充 M 系列；
- 为了调用 M 方法先造功能 NPC；
- 让 Character Agent 因“理性/自主”取消已设计的人物线。

## 11. 当前工程顺序

第一批只做三件事：

1. 用 NarraLume outline tree 编译 `StoryCreativeFrameContext`；
2. Story Authoring / S04 强制带 `StoryProtagonistCamera`；
3. 新增通用 `CreativeMethodInvocation` 端口，让 M 系列可在任意明确创作问题上进入。

后续再做：

- Upgrade / Stake / Expectation 状态怎样写入 Frame metadata 并随区段继承；
- M03 / 其他 M 系列的真实检索 adapter；
- Module 2 person-centered Reality → Protagonist Camera 的自动上下文装配；
- 多 Node / 多 Frame 的长期 settlement 与推进。

这样先把根架构改对，不用一次性重写整个 NarraLume。
