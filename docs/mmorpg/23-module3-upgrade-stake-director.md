# 第三模块｜Upgrade Ladder × Existing Cast × Stake Ledger（2026-11-22）

> 本文是当前第三模块最高优先级工程认知。它纠正此前把 Character Agent 自主性、Opportunity 流水线和 Reality Rehearsal 抬到编剧权之上的路径。上游世界仍由 Module 1 / Module 2 提供，下游 S06-S08 继续复用现有实现。

## 1. 一句话

**第三模块就是：拿 Module 2 已经存在的人，围绕男主既定升级路线，用讲师的稀缺、固有认知、三阵营、信息差、配角下注、前中后和阵营转化，主动设计商业男频故事。**

```text
Upgrade Ladder
→ Current Stage Goal
→ Module 2 Reality / Existing Cast
→ Scarcity / Established Belief / Advantage Gap
→ Three Camps / Supporting-character Stakes
→ Story Node
→ Before / During / After Scenes
→ Payoff / Supporting-character Reaction
→ Settlement / Retained Upgrade Assets
→ Next Upgrade Step
↺
```

## 2. Module 2 是想象对象库

讲师原稿中的妹妹、老板、老板儿子、武馆、制度与资源，都默认作者脑中已经有一个世界。

NarraLume 的显式工程对应：

```text
Module 1
生产世界内容
↓
Module 2
保存并恢复 Project Reality
↓
Module 3
直接对着已有世界编故事
```

因此 Module 3 不负责用“剧情功能”反推功能 NPC。

默认顺序：

1. 先用 Source Atlas / Project Reality 已有的人、关系、组织、制度、资源和历史原型；
2. 同人、历史、都市年代等已有世界尤其如此；
3. 若真的缺对象，返回 `worldGaps`，交 World Builder 补；
4. `candidateNewObjects` 在 Story Search 正式链中必须为空。

## 3. 升级路线负责写长

长篇不等待 Reality 自己“自然涌现”下一段故事。

新增核心合同：

- `StoryUpgradeStep`
- `StoryUpgradeLedger`

它记录：

- protagonist；
- Road；
- 当前位置；
- current step；
- 当前 stage goal；
- settlement target；
- 后续 upgrade steps；
- 每一步的 gate / target gain / target circle。

S01 / S02 / S03 仍可保留为尺度，但只能是同一 Upgrade Ledger 的三个视角：

```text
S01 = 长程 Road / 价格阶梯视角
S02 = 当前 Upgrade Stage 视角
S03 = 当前 Story / 人物互动视角
```

禁止把三者继续实现成三台互不相干、各自从零“想一次故事”的生成器。

## 4. 配角下注负责写爽

新增核心合同：

- `StoryStakeLedgerEntry`
- `StoryStakeState`

关键配角不再只有 `belief` / `reaction`。

每一笔 Stake 至少表达：

```text
currentBelief
+ currentInterest
→ stakeAction
→ stakeAssets
→ commitmentCost
→ escalationPlan
→ payoffReaction
→ settlementChange
```

第三模块最关键的问题不是：

> 这个人怎么看男主？

而是：

> **因为他这么看男主，他做了什么？押了什么？有没有继续加注？**

下注越重，Payoff 越贵。

## 5. Three Camps 是人物互动展开器

三阵营只划分 Module 2 已经存在的人：

- 友方；
- 敌方；
- 中立；
- 其他利益位置。

每个非主角 camp member 必须有实际 Stake。Reaction Target 必须能追溯到 Stake。S05 Node 如果要收割某人的 Reaction，该 Node 必须通过 `stakeEntryIds` 指向正在推进 / 加注 / 结算的那笔 Stake。

这防止：

```text
没有前置行动
→ 高潮突然震惊
```

正确：

```text
固有认知
→ 人物下注
→ 继续加注
→ 主角兑现
→ 反应结算
→ 关系 / 阵营 / 权限变化
```

## 6. 作者权与人物演法

旧错误：

```text
Author 设计一个爽点
↓
Agent 认为人物“理性 / 自主”
↓
拒绝演
↓
故事被自治模拟取消
```

当前合同：

```text
Author / Director
= 决定 Story Goal、人物线、Stake、Payoff方向

Character Model
= 在既定人物线内，寻找最符合人设 / 利益 / 已知Reality的具体演法

World Arbiter
= 检查时间 / 地点 / 知识 / 资源 / 世界规则等硬冲突
```

新增 StoryUnit Authority：

- `directorAuthority = author-defined-story-line`
- `characterExecutionRule = characterization-constrained-performance`

Character Observation 现在携带：

- `authoredStoryFunction`
- `authoredStakeIds`
- `authoredDirection`

Agent 不再回答“这条人物线要不要发生”，而是回答“这个人会用什么最符合自己人设的方式完成这条线”。

震惊、投靠、误判、嘴硬、犯蠢、加注、后悔、破防都允许。约束不是“不要设计”，而是前置认知、利益、人物性格和 Reality 要支撑具体演法。

## 7. 当前 S04 / S05 合同

S04 `StoryUnitDesign` 当前核心：

```text
Upgrade Ledger
+ Object Anchors / Grounding
+ Camp Network
+ Stake Ledger
+ Reaction Targets
+ Camp Transitions
+ Information Release
+ S05 Story Nodes
```

S05 Node：

```text
problem
+ story pressure
+ cast pool / active seed
+ actor pressures
+ active stakeEntryIds
+ reaction targets
+ information steps
+ before / during / after
```

这使“编剧设计”和“人物具体演法”不再互相抢权限。

## 8. 与 S06-S08 的关系

下游不需要重造：

```text
S05 Story Node
↓
S06 StorySceneExpansion
↓
S07 StoryReaderTimePlan
↓
S08 StoryChapterProductionHandoff
↓
NarraLume draft / review / settlement
```

本轮改的是第三模块的**故事发动机和人物线定价**，不是推翻已经接好的 Scene / Reader Time / Production。

## 9. 不可回退 Guardrails

禁止：

- 为剧情功能临时捏 NPC；
- 让所有 Agent 自己跑，再从监控录像里挑故事；
- 用“人物自主 / 理性”否决作者已设计的人物线；
- 只有 belief，没有 stake；
- reaction 没有前置 stake；
- 一次 Story 只爽，不给男主留下升级资产；
- Story 结束后再问“下一故事自然长什么”，而没有 Upgrade Ladder；
- 让 S01 / S02 / S03 各自从零生成不同人生。

## 10. 两张核心账

```text
Upgrade Ledger
当前层 → 下一层 → 门槛 → 本次取得 → Settlement → 下一层

Stake Ledger
谁 → 相信什么 → 因此做什么 → 押什么 → 加注 → Payoff → 关系/阵营变化
```

**Upgrade Ledger 负责把书写长；Stake Ledger 负责把书写爽。**
