# 第三模块｜Story Runtime Core（2026-11-21）

> 本文件冻结第三模块新的核心方向。NarraLume 原生 Chapter Pipeline 继续负责正文生产、审阅、修订与 Settlement；本模块补上它原来薄弱的 Reality → Story → Outline 之间的故事运行时。

## 0. 一句话裁决

**第三模块的核心不再是“给 Chapter Goal 写正文”，而是：从 Project Reality 中恢复当前世界，让人物只依据自己可感知的 Reality 独立行动，由世界裁判结算多人行动，再由作者态 Narrative Director 按商业男频目标选择值得进入 Reader Time 的故事。**

NarraLume 原生下半段继续保留：

```text
Story Runtime
    ↓
Story / Plot / Chapter Target
    ↓
NarraLume
Scene Plan
    ↓
Draft
    ↓
Review / Revision
    ↓
Settlement
    ↓
Project Reality
```

## 1. 来源与边界

### 1.1 用户旧体系：不是提示词包，而是第三模块的创作哲学来源

AA 中三套历史研究保留为认知来源，不原样搬成运行 Prompt：

- **反应堆 v3.4**：State → Want → Action → Reaction → Mutation；角色卡/世界卡碰撞；Chain Reaction；结算后固化新盘面。
- **SOP V6.0**：世界、人物、剧情协同进化；计划必须服从真实 Reality；未来可以规划，但不能把规划冒充已经发生。
- **TRPG 单人跑团**：单主角 PVE；AI/系统承担 GM、规则裁判、NPC/世界反应；主动行动、世界主动、导演催化是不同故事动力来源。

这些文档里“只做最小世界种子、边写边补世界”的历史方案已经被当前 Module 1 + Module 2 推翻。现在是：

```text
完整而丰富的 World Atlas / Project Reality
              ↓
当前运行只加载相关 Slice
```

不是“世界只存在当前几张卡”。

### 1.2 novel-studio：允许实际移植的运行机制参考

上游：`Xiaoyangy/novel-studio`，Apache-2.0。

第三模块明确吸收并实际移植/改造以下核心机制：

1. Character Observation：人物不能直接看到全知世界。
2. Independent Decision Proposal：每个激活人物独立提出行动。
3. Observation-bound validation：人物决策引用的知识必须来自本人的 Observation。
4. World Arbitration：多人同时行动后统一处理时间、地点、资源、规则、知识和碰撞冲突。
5. Arbiter may block/partially resolve, but **must not rewrite character intent**.
6. Character action may invalidate soft future plans；Reality 优先于软大纲。
7. Arc Rehearsal：未来多章只做 conditional forecast，authority 必须保持 speculative，不写入 Canon。

本仓库已有稳定 Canon Entity ID，因此不重复建立一套按名字 hash 的 Character Agent identity；Agent 直接绑定 Project Canon Entity ID。

### 1.3 AI-Novel-Writing-Assistant：只借思想，不复制代码

上游当前许可证为 AGPL-3.0-only，并附服务式商业使用授权说明。

因此本仓库**不复制其源码**。只独立实现下列公开架构思想：

- Full World ≠ Prompt Context。
- World / Novel Project 分层。
- StoryWorldSlice / Context Projection：按当前任务只投影相关人物、地点、势力、规则、资产、压力与入口。
- Resource/Asset 需要事件化历史，而不是只保存一个静态数字。

任何未来实现都必须标记为 independent implementation / conceptual reference，不能写成 source port。

## 2. 新第三模块的七个核心协议

```text
World Atlas / Project Reality
          │
          ▼
① RealityProjection
          │
          ▼
② CharacterObservation
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
 Agent A Agent B Agent C
    │     │     │
③ CharacterActionProposal
    └─────┼─────┘
          ▼
④ WorldArbitration
          │
          ▼
⑤ SpeculativeRealityDelta
          │
          ├───────────────┐
          ▼               ▼
⑥ NarrativeDirector   ⑦ HorizonRehearsal
          │               │
          └───────┬───────┘
                  ▼
        Story / Chapter Target
                  │
                  ▼
          NarraLume Production
```

### ① RealityProjection

从第二模块读取世界，不建立第三套数据库。

输入：

- Project Reality current truth
- Source Atlas reference
- StoryState knowledge / timeline / relationship
- 当前时间、地点、任务范围

输出：

- Operational World Projection
- Character Slice
- Story/Author Slice

### ② CharacterObservation

人物只能获得“自己此刻能够知道/看到/拥有/记得”的数据。

硬规则：

```text
World knows X
≠ Character knows X
≠ Reader knows X
```

Character Agent 不得直接吃 author-level Project Reality 或 Source Atlas full card。

### ③ CharacterActionProposal

每个激活人物独立回答：

- 我现在要什么？
- 我承受什么压力？
- 我有哪些现实可行选项？
- 我放弃哪些选项？
- 我为什么选这个？
- 我准备实际做什么？
- 用到了哪些我确实知道的事实？
- 要占用哪些资源？
- 我预计会发生什么？

**Proposal 是人物意图，不是已发生 Reality。**

### ④ WorldArbitration

World Arbiter 只裁事实可实现性，不替人物改主意。

冲突类别：

- time
- location
- resource
- rule
- knowledge
- collision

每个 Proposal 最终只能得到：

- success
- partial
- blocked

Arbiter 可以说明“你做不到/只做成一半”，但禁止把人物原本“去偷卷轴”偷偷改成“决定回家”。

### ⑤ SpeculativeRealityDelta

Agent + Arbiter 的运行结果首先是**模拟未来**：

```text
authority = speculative
```

不能直接写 Canon / Project Reality。

真正发生什么，仍由正文写出后经过 NarraLume Settlement：

```text
Manuscript
    ↓
Settlement
    ↓
accepted Canon / Relationship / Timeline / Knowledge
    ↓
Project Reality
```

因此 Story Runtime 与现有单写入口不冲突。

### ⑥ NarrativeDirector

Director 是作者态，不是全知 NPC。

它负责：

- 目标情绪 / 情绪指向
- 商业男频价值
- 哪些人物/压力/机会值得激活
- 信息释放顺序
- 高价对象与进入门槛
- “赢麻了”资产结算目标
- Reader Time 中值得演出的事件
- 主动 / 世界 / 催化剂三种 Story Event Source 的调度

它**不能**为了爽感强迫人物 OOC。正确做法是改变舞台、压力、相遇、机会与信息，而不是重写人物决策。

### ⑦ HorizonRehearsal

未来 3～N 个章节/Story Move 做条件性推演：

```text
Current Reality
    ↓
conditional forecasts
    ↓
causality / time / resource / contract checks
    ↓
speculative rehearsal
```

未来预测永远不是 Canon。下一次真实 Reality 改变后，旧预测允许整体失效并重新推演。

## 3. 三种故事动力来源

TRPG 历史“三路径”升级为正式 runtime 语义：

| Event Source      | 含义                                  | 例子                                 |
| ----------------- | ------------------------------------- | ------------------------------------ |
| Actor Initiative  | 人物自己发动                          | 男主主动研究、敌人主动夺权           |
| World Initiative  | 其他人物/组织/事件主动撞来            | 战争命令、竞争者行动、市场变化       |
| Director Catalyst | 作者态为目标情绪/长期产品投放高价变量 | 新人物进入、门槛暴露、隐藏机会被看见 |

三者是**动力来源**，不是“给下一章列三个备选答案”。

## 4. 与第二模块的关系

第二模块负责：

> 让世界中的人、组织、地点、能力、资产、信息真实存在并可查询。

第三模块 Runtime 负责：

> 让这些人从自己的 Reality 出发真实行动。

People-centered 因此获得真正执行含义：

```text
Atlas 中的 Person
   ↓
关系 / 能力 / 资产 / 所属 / 知识 / 当前事件
   ↓
Character Observation
   ↓
Character Action
   ↓
人与人、人与组织、人与资源发生碰撞
   ↓
Story
```

## 5. 与 NarraLume 原生系统的关系

保留 NarraLume 强项，不重写：

- Context Compiler
- Scene Plan
- Draft
- deterministic check
- semantic review
- revision
- settlement
- commit/version
- Canon / Relationship / Timeline / Knowledge

第三模块新核心只补它原来最薄的部分：

```text
Reality
  ↓
Story Runtime
  ↓
Story / Plot / Chapter Target
  ↓
NarraLume Production
```

## 6. 实施顺序

### 第一批：Agent Runtime 最小闭环

1. runtime contracts
2. CharacterObservationBuilder
3. observation-bound Action Proposal validation
4. World Arbitration receipt validation
5. SpeculativeRealityDelta，明确不可自动写 Canon
6. regression tests：知识隔离、意图不被 Arbiter 重写、模拟不污染 Reality

### 第二批：真实模型调用

- Character Agent worker
- activation / sleeping 分层
- World Arbiter worker
- conflict feedback → revision round
- 角色数量按 Zone / active cast 裁剪

### 第三批：Director + Horizon

- NarrativeDirector
- Actor / World / Catalyst source scheduling
- 男频情绪目标 / 赢麻了裁决层
- 3～N 步 HorizonRehearsal
- soft plan 被 Reality 撞坏后的 successor planning

### 第四批：接回 NarraLume

把 Runtime 产出的 Story Candidate / Protagonist Projection 转成：

- Story Move
- Plot Event
- Chapter Target
- Scene Plan input

正文后仍只走 Settlement。

## 7. 禁止回退

后续第三模块开发禁止重新退回以下模型：

```text
世界资料
→ LLM 一次性“想一个剧情”
→ Chapter Goal
→ 写正文
```

也禁止：

- 一个全知 Agent 同时替所有角色做决定。
- Character Agent 读取 author_secret 或 Source World future。
- Arbiter 重写人物原意以维护大纲。
- Rehearsal / Story Candidate 自动进入 Canon。
- 把完整 Atlas 全塞进每次 Prompt。
- 新建与 Canon / Project Reality 平行的 Runtime Truth Store。
- 为了真实模拟牺牲商业男频的 Reader 价值。
- 为了 Reader 价值扭曲已经成立的人物 Reality。

最终裁决：

> **Reality 决定“人物实际上会怎样行动”；Narrative Director 决定“哪些真实可能性值得被激活和演给 Reader 看”；Settlement 决定“正文最终真正发生了什么”。**
