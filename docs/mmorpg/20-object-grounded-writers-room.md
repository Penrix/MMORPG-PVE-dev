# 第三模块｜Object-Grounded Writers' Room（2026-11-22）

> **STATUS: CURRENT SUPPORT / SEARCH FRAMING PARTIALLY SUPERSEDED.** “故事不是监控录像”“想象必须先有 Module-2 世界对象”仍是硬规则；但旧的 S01/S02/S03 Opportunity 流水线不再是第三模块主发动机。当前固定：S01/S02/S03 只是同一 Upgrade Ledger 的长程 / 阶段 / 当前故事视角，真正故事发动机见 [23](23-module3-upgrade-stake-director.md)。

> 本文件记录 2026-11-22 的两次作者级纠正，并给出在 NarraLume 正式工程中的实现边界。它覆盖此前把“世界自转后挑精彩事件”当故事生成核心、以及把“自由脑洞”当创作起点的错误路径。

## AUTHOR VERBATIM 1｜故事不是纪录片

> 你终于理解了，我们写的是【故事】，是设计出来的剧情，不是纪录片，不然影视行业要编剧和导演干嘛，演员自己演vlog就行，何况vlog也是有剧本文案的。。不然你看监控视频呢？

## AUTHOR VERBATIM 2｜想象必须先有对象

> 你理解的不错，但是你少了一个前提，所有的想象和脑洞，必须有个想象的对象，没有目标的空想是想不出来东西的，这就是我让你先做第二模块的意义，你先把这个世界搭建起来，才能在有对象的基础上进行发散想象。

作者随后确认：

> 很好，你现在理解对了，把认知写入仓库，然后迭代第三模块

---

## 0. 当前裁决

第三模块不能再从这两个错误起点开始：

```text
错误 A
世界自己运行
→ 出现很多真实事件
→ 从里面挑一件“精彩的”
→ 当小说剧情

错误 B
给 LLM 一个抽象题目
→ 自由脑洞
→ 得到熟悉套路
→ 再去世界库找几个名字贴上去
```

正确结构是：

```text
Module 1 World Builder
持续生产真实可玩的世界内容
          ↓
Module 2 Project Reality / Source Atlas
提供当前可被思考的具体对象
          ↓
Object Field
          ↓
Reader Need / Target Emotion / P_A
          ↓
S01-S03 Object-grounded Story Search
          ↓
Story Seed / Opportunity
          ↓
S04 Writers' Room
主动把选中的对象设计成一出 Story Unit
          ↓
S05 Story Node
一个具体问题节点
  └─ Character Agent + World Arbiter
     只在节点内部做 Reality Rehearsal
          ↓
S06 Multi-Scene Expansion
          ↓
S07 Reader Time
          ↓
S08 Manuscript
          ↓
Settlement
          ↓
Project Reality
```

三个业务模块仍然平级、双向调用。上图描述一次具体创作动作的数据依赖，不把 Module 2 变成 Module 3 的上级。

---

## 1. 第二模块的新职责不是“素材库”，而是 Imagination Substrate

第二模块原有职责仍然成立：

- Project Reality：当前项目确认事实；
- Source Atlas：母体世界 reference；
- StoryState：关系、事件、知识与人物可见状态；
- Settlement：正文实际结果的单一确认写入口。

新增的理解是：

> **这些已存在对象本身就是第三模块想象的移动原点。**

因此第三模块不应该只接收一句：

```text
“火影三战，想个剧情”
```

而应该看到具体对象及其当前可作用面：

```text
秀信
- 当前地点
- 当前身份
- 已有能力
- 当前伤势/资源
- 已确认关系

医疗忍者
- 当前职责
- 已知事实
- 专业判断
- 复核权限

旗木朔茂
- 当前社会价格
- 可进入的任务圈
- 与当前对象的真实连接/距离

医院 / 任务体系 / 战争窗口
- 规则
- 入口
- 限制
- 当前活动
```

这才是 Object Field。

---

## 2. Object Field 的权威边界

Object Field 是**派生的作者侧投影**，不是新的真相库。

```text
Project Reality confirmed surfaces
+
Source Atlas reference identity / typed relations
+
当前 StoryState 可用结构
↓
StoryObjectField
authority = speculative
```

为什么 Field 自身仍是 speculative：

- 它是“本轮给创作看的对象切片”，不是世界事实本体；
- 它可以选择更宽或更窄的对象集合；
- 选择某个对象进入 Field 不代表剧情一定使用它；
- Source Atlas reference 仍不能覆盖 Project Reality。

硬边界：

1. Project Reality 与 Source Atlas authority 必须保留。
2. 完整 Source Card prose 不能默认进入当前 Object Field，因为其中可能包含母体世界未来。
3. Object Field 不能把未来 reference 冒充当前 Reality。
4. 新生人物/组织/用途必须是 CANDIDATE，不能因为模型想到了就直接变成 Reality。

---

## 3. M01 / M02 / M03 / M04 的正确身份

```text
Search Object = Object Field 中的具体世界对象
Search Operator = M01 / M02 / M03 / M04
```

M 方法回答“怎么移动”，不回答“从什么东西上移动”。

例如：

- 星型：从一个真实对象向关系、用途、欲望、规则、价格展开；
- 网状：两个已有高价对象寻找接口；
- 树型：沿一条已出现的有价值分支深入；
- 对立：反转已有默认利益、用途、身份或权力关系；
- 维度交叉：已有能力/机制 × 另一个真实世界对象；
- 链式：从一个人物真实行动继续追下一手。

成熟故事先验也一样：

> 它提供成熟关系结构和因果先验，但必须重新落到当前 Object Field，不能直接当本书 Reality。

---

## 4. S01-S03 不是同一个“脑洞按钮”

### S01｜Story Concept × Story Engine

S01 的问题不是“想几个大剧情”。

它必须回答：

> 这个特定男人，在这张世界里，长期过什么值得 Reader 追一生的高价生活？

同时必须回答：

> 哪些具体世界对象、关系、职业/能力玩法和取得机制会持续生产这种生活？

因此当前合同：

```text
Story Concepts
+
Story Engines
+
Concept × Engine Links
```

没有 Engine 的 Concept 只是愿景。

没有 Concept 的 Engine 只是玩法清单。

### S02｜Current S0 → Stage Opportunity → Candidate S1

S02 不把 S01 目标拆成：

```text
筹钱 → 报名 → 考核 → 升级
```

它先确认真实 Current S0，再看当前可达对象：

- 新地图；
- 新人物圈；
- 新权限；
- 新资源；
- 新力量/职业入口；
- 旧资产的新用途；
- 历史/社会窗口。

然后问：

> 现在终于有资格进入什么以前没有的新生活？

### S03｜Story Opportunity Field

S03 负责“眼下这一阵子到底有什么值得持续玩”。

它不是 S04 标题列表，而是：

```text
period focus
+
opportunity field
+
active / preheat / rest / afterglow story movements
+
Story Seeds
```

Story Seed 至少需要：

```text
真实 anchor objects
+
这些对象当前已经存在的可作用面
+
一次明确的搜索运动
+
由关系真正长出的新机会
+
男主切入
+
Reader value
+
可能改变的关系/用途/下一步行动
```

---

## 5. S04 是 Writers' Room，不是 Agent Simulation

S04 主动设计：

- 这一出故事具体要解决的正事；
- 从哪些 Object Anchors 出发；
- Reader 期待交易；
- 稀缺性；
- 固有认知；
- 主角优势；
- 三阵营人物网；
- 未来反应目标；
- 阵营转化与深入；
- 人物出场顺序；
- 信息释放顺序；
- S05 Events。

### 三阵营是作者工具，并且要落到配角下注

2026-11-22 最新纠正：此前“不能写死震惊/投靠，Character Agent 决定人物实际怎么做”的表述把人物自主权抬得过高，已经被 [23 Upgrade Ladder × Existing Cast × Stake Ledger](23-module3-upgrade-stake-director.md) supersede。

作者可以主动设计：

> 这个人承担压力，这个人承担社会定价，这个人继续误判并加注，这个人在Payoff后震惊/后悔/投靠/改判，这个人形成长期阵营转化线。

关键不是回避设计反应，而是让反应有价格：

```text
固有认知
→ 人物利益
→ stakeAction
→ stakeAssets / commitmentCost
→ escalation
→ 主角兑现
→ payoffReaction
→ settlementChange
```

Character Model 的职责不是决定“这条人物线要不要发生”，而是在作者已经定下的戏剧方向里寻找最符合人设和可见 Reality 的具体演法。

### Cast Pool ≠ Active Seed

每个 S05 Event 必须区分：

```text
Cast Pool
= 这件事可能卷入的人物

Active Seed
= 第一轮真正进入/行动/被触发的人物
```

第一轮全员开机，会直接摧毁：

- 出场顺序；
- 信息差；
- 传播链；
- 期待分层；
- 人物进入的现实原因。

---

## 6. S05 是 Story Node；Reality Runtime 是节点内部子程序

此前本文件把“Character Agent + World Arbiter”直接等同于 S05，本次已被讲师原稿复核推翻。

正确：

```text
S05 Story Node
= 一个具体问题
+ 人物线交叉
+ story pressure
+ before / during / after targets
+ information-release links
+ Reader expectation
        ↓
Reality Rehearsal
CharacterObservation
→ CharacterActionProposal
→ WorldArbitration
→ speculative Reality
        ↓
feasible → S06
broken   → 回 S05/S04 改尚未发生的未来
```

讲师原稿给出的“主线化而为无数节点，每个节点都有一个问题，这个问题影响多个场景”直接定义了 S05 → S06：

```text
S05 一个问题节点
↓
S06 多个具体场景
↓
每场继续施加压力、移动信息、改变期待
```

Character execution 保留人设与主观认知约束，World Arbiter保留硬 Reality 可行性裁决；二者都没有上位编剧权，也不是细纲生成算法。

详细见：

`docs/mmorpg/21-s05-story-node-s06-scene-expansion.md`

---

## 7. 正式工程实现（MMORPG-PVE-dev）

本认知已经按 NarraLume 结构开始实现，不迁移旧仓 `dist/app.js` 原型。

### Module 2 adapter

`packages/persistence/src/project-reality-context.ts`

新增：

- `WorldAtlasStoryObject`
- `WorldAtlasStoryObjectSurface`
- `WorldAtlasStoryContext.objects`

Object surfaces 来自：

- Project Reality confirmed slots；
- Source Atlas lightweight reference identity / typed relation slots。

完整 Source Card prose 保留在 author reference detail，但不自动进入 Object Field。

### Contracts

`packages/contracts/src/story-runtime.ts`

新增：

- `StoryObjectField`
- `StoryOpportunitySeed`
- S01 Story Concept / Engine contracts
- S02 Stage Opportunity contracts
- S03 Opportunity Field / Story Movement contracts
- `StoryAuthoringSearch`
- `StoryUnitDesign`
- `StoryUnitEventDesign` with Cast Pool / Active Seed

### Author-side runtime

`packages/narrative/src/story-authoring-runtime.ts`

新增：

- `storyObjectFieldFromWorldContext()`
- `finalizeStoryObjectField()`
- `finalizeStoryAuthoringSearch()`
- `finalizeStoryUnitDesign()`
- `realityFocusFromStoryUnitDesign()`

硬校验：

- Story Seed anchor 必须来自当前 Object Field；
- S01/S02/S03 保留不同尺度合同；
- S04 Object Anchors 必须来自 Field；
- 三阵营/反应/出场人物必须是真实 Field entity；
- Active Seed 必须属于 Event Cast Pool；
- 所有输出仍为 speculative。

### Model service

`packages/narrative/src/story-authoring-runtime-workers.ts`

新增 `StoryAuthoringService`：

- `search()`：S01-S03 object-grounded search；
- `designStoryUnit()`：S04 Writers' Room。

---

## 8. 当前仍未完成

1. Object Field 的**自动召回**仍需要继续接入：
   - S01：项目/母体世界大范围对象检索；
   - S02：Current S0 可达性；
   - S03：当前位置、人物 Agenda、旧债、Reader active threads。
2. `worldGaps → World Builder` 尚未形成正式增量生成任务。
3. S03 Story Seed → S04 Story Unit 的持久化/作者采用状态还没接 UI/API。
4. `StoryUnitDesign → Active Cast / Character Agent Runtime` 目前有纯合同桥，尚未接宿主调度。
5. Reality 撞坏 Story Unit 后的 successor writers' room 还需接入。
6. S06 / S07 / S08 与当前 NarraLume Chapter Production 的正式交接仍需继续。

---

## 9. 仓库身份 Guardrail

真正的 NarraLume 工程仓：

```text
Penrix/MMORPG-PVE-dev
```

历史原型仓：

```text
Penrix/MMORPG-PVE
```

2026-11-22 曾发生一次错误仓库漂移：第三模块原型在历史仓创建了 Draft PR #1。该 PR 已明确标记 `[ARCHIVED · WRONG REPO]` 并关闭。

以后：

> **第三模块任何代码任务先确认仓库为 `MMORPG-PVE-dev`，再确认当前主开发 PR/branch。旧仓只能作为历史原型参考，禁止继续作为正式工程开发线。**
