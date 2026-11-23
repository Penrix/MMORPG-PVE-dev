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

这里故意和 `StoryUpgradeLedger.currentPosition` 分开：

- `currentPosition` = 男主在长期升级路线上的社会 / 实力 / 价格位置；
- `currentLocation` = 这一刻人具体在哪里；
- `currentState` = 这一刻身体、身份、资产、处境等综合状态。

因此“人在木叶医院”不等于“升级位置仍是普通伤员”，地点和长期价格位置不能绑死。

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

## 11. 当前实现状态

### 第一批：S / Camera / Method Port

已落地：

1. NarraLume outline tree 可编译 `StoryCreativeFrameContext`；
2. Story Search / S04 强制绑定 `StoryCreativeContext`，不能用假 digest 绕过父层 / 前序状态；
3. `StoryProtagonistCamera` 作为 Story Director 推演起点；
4. `CreativeMethodInvocation` 是横切方法端口，不绑定某一个 S 步骤；
5. Camera 与 Method 的对象引用必须落在当前 Module-2 Object Field，且 Camera 必须包含男主对象。

### 第二批：Creative Frame 长期账

已落地 `StoryCreativeFrameState`，直接保存在现有 `outline_nodes.metadata.mmorpgCreativeState`，不新增平行数据库。

每个区段保存的是**截至该区段的创作工作快照**：

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

这层是作者创作记忆，不是 Project Reality。世界真相仍只有 Module 2。

### 第三批：M03 正式索引召回

已复用 NarraLume 现有 Retrieval：

```text
male-webnovel-cognition
database/m03/curated_index.jsonl
        ↓
按正式索引读取真实 Markdown 卡
        ↓
source_type = creative_method
        ↓
FTS / embedding / rerank
        ↓
CreativeMethodRetrievalService
        ↓
CreativeMethodInvocation
```

关键约束：

- 不复制 M03 源卡到 dev 仓；
- `curated_index.jsonl` 是 M03 导入白名单与状态来源；
- 默认只召回 Active；
- Candidate 必须显式开启；
- Merged / Retired 不参与普通召回；
- Retrieval 新增 `sourceTypes` 过滤，世界资料、正文记忆不能冒充 M 方法；
- `mmorpg-method-catalog.ts` 仍是 v0.1～v0.7 世界设计方法目录，不冒充 M 系列。

本地索引命令：

```bash
npm run import:creative-methods -- \
  --project PROJECT_ID \
  --source /path/to/male-webnovel-cognition/database/m03 \
  --family M03
```

源 Markdown 仍是唯一内容真相；SQLite `text_segments` 只是可重建索引。

## 12. 下一批真正剩余的工程缺口

现在不再缺 S 框架、长期创作账或 M03 召回底座。下一步主要是：

1. **Module 2 People-centered Reality → Protagonist Camera 自动装配**  
   现在 Camera 合同已经存在，但 host 仍需显式提供 currentLocation / currentState / currentGoal / focusObjectIds。下一步应让人物当前 Reality、Upgrade Ledger 与作者当前意图共同组装它，而不是让调用者重复手填。

2. **Settlement → Creative Frame State 自动结算**  
   当前 Frame State 可以写入/继承，但还需要把正文 Settlement 的真实收益、Stake 结算、Expectation 平仓自动更新到 Frame snapshot。

3. **多 Node / 多 Frame 长期推进**  
   一个 Story Unit 内的多 Node 已有基础；还需要把跨 Frame 的升级、加注、转期、阵营变化真正连续跑起来。

4. **其他 M 系列 adapter**  
   M03 已证明通用端口成立。M01/M02 等后续只应增加 source adapter / index importer，不再重做创作架构。


## 12. 当前实现状态

截至 2026-11-23，本合同已经不只是设计稿，以下部分已落地：

- `StoryCreativeFrameContext`：直接从 NarraLume `outline_nodes` 编译当前 Frame、父层链和同层前序区段；
- `StoryCreativeFrameState`：Upgrade Ledger、Stake Ledger、未结 Expectation、retained assets、unresolved questions 可以写入现有 outline metadata；
- 后续 Frame 会从父层 + 前序同层恢复上述创作状态，不新建第二套 S 数据库；
- `StoryProtagonistCamera`：Story Authoring 强制携带男主当前位置、当前状态、当前目标、upgradeNeed、activeMove 与 focus objects；
- `creativeContextDigest`：S01～S04 的搜索/编剧结果绑定当前 Creative Context，旧 Frame 结果不能静默混入新状态；
- `CreativeMethodInvocation`：M 方法作为横切调用记录进入 Story Authoring；
- `CreativeMethodRetrievalService`：可从 NarraLume Retrieval 中按当前 Frame、男主目标、世界对象与 scope 召回方法；
- `import:creative-methods`：支持从外部方法库导入可重建检索索引；
- M03 已按 `male-webnovel-cognition/database/m03/curated_index.jsonl` 的 Active / Candidate / Merged / Retired 状态设计适配；默认只召回 Active，可显式包含 Candidate，永不普通召回 Retired；
- 原始方法 Markdown 仍在 cognition 仓保持权威，dev 仓只保存可重建 retrieval segment，不复制 5,519 张卡作为新的真相库。

当前仍未强行自动化的部分：

- Protagonist Camera 的 `currentGoal / activeMove` 仍是作者侧创作输入，不由 Reality 自动替作者决定；
- M 方法召回是可调用能力，不要求每一步机械调用；
- Scene / Combat / Ability 等更细粒度入口可继续复用同一 `CreativeMethodInvocation` 合同，而不是再造新方法系统。

这三个“不自动化”是有意设计，不是缺口：**S 负责记忆位置，M 负责提供思考算法，Director 仍负责创作选择。**
