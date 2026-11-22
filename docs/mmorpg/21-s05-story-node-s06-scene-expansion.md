# 第三模块｜S05 Story Node → S06 Scene Expansion（2026-11-22）

> 本文纠正此前把 Character Agent / World Arbiter 误当成 S05 本体、并因此制造 S05 → S06 人工断口的设计错误。上游仍遵守 [20 Object-Grounded Writers' Room](20-object-grounded-writers-room.md)。

## 1. 错误记录

此前实现路径一度隐含：

```text
S04 Writers' Room
→ S05 Character Agent / World Arbiter
→ speculative Reality
→ ???
→ S06 Scene
```

这会产生一个错误问题：

> Agent 模拟结束后，怎么把模拟结果“变成”场景？

讲师原稿实际上已经给出场景生产方法：

> 主线化而为无数节点，每个节点都有一个问题，这个问题影响多个场景，场景中又给于压力让读者期待升级。

因此真正的层级是：

```text
S04 Story Unit
↓
S05 Story Node / Event Node
↓ 一个问题影响多个场景
S06 Scene Expansion
↓
S07 Reader Time
↓
S08 Manuscript
```

Character Agent + World Arbiter 只是 S05 内部的 Reality Rehearsal / Adjudication 子程序。

## 2. S05 的正式定义

S05 不等于 Agent Runtime。

S05 是**一个具体问题节点**。

当前 `StoryUnitEventDesign` 必须表达：

- `problem`：这个 Node 唯一、清楚的具体问题；
- `storyPressure`：这个问题如何继续给 Reader / 人物施压；
- `castPoolEntityIds`：整个 Node 可能卷入的人物；
- `activeSeedEntityIds`：Reality rehearsal 第一轮真正被激活的人；
- `actorPressures`：作者搭出的外部场面压力，不改写人物内心；
- `reactionTargetEntityIds`：本 Node 承接哪些 S04 反应目标；
- `informationReleaseSteps`：本 Node 承接哪些 S04 信息释放步骤；
- `phaseTargets`：before / during / after 哪些人物线需要展开；
- `realityQuestion`：Agent / Arbiter 真正要验证什么；
- `observableStart`；
- `expectedChange`；
- `readerExpectation`。

### Reality 子程序

```text
S05 Node
↓
Active Seed
↓
CharacterObservation
↓
CharacterActionProposal
↓
WorldArbitration
↓
feasible?
├─ yes → S06
└─ no  → 保留已经成立的 Reality，回 S05/S04 改 soft future
```

Agent 不决定“写什么故事”。

Arbiter 不决定“怎么写场景”。

它们只决定：

- 人物在当前 Reality 下实际会怎样选；
- 时间 / 地点 / 资源 / 知识 / 规则是否允许；
- 作者 soft route 是否仍成立。

## 3. S06 的正式定义

S06 是**Node → Multi-Scene Expansion**。

一个 S05 问题节点可以展开多个场景。每个 `StoryScenePlan` 至少包含：

- `phase`：before / during / after；
- `participantEntityIds`；
- `locationObjectId`：只能使用已锚定世界对象，缺失则 null；
- `localProblem`；
- `pressure`；
- `observableStart`；
- `interaction`；
- `informationMove`；
- `expectationMove`；
- `projectedRealityUse`；
- `endState`；
- `nextSceneCause`。

硬约束：

1. Scene 人物必须来自当前 Node Cast Pool；
2. Scene 不得重写 World Arbitration 已投影的人物行为；
3. Node 声明的 phaseTargets 必须在 S06 中被覆盖；
4. phaseTarget 中声明的人物必须在对应 phase 的场景实际出现；
5. 非最后一场必须说明 `nextSceneCause`，禁止纯剪辑拼接；
6. Scene 是叙事设计，不是 arbitration log 的自然语言转写。

## 4. 讲师原稿对应关系

### “一个问题影响多个场景”

直接对应：

```text
S05 problem
→ S06 scenes[]
```

### “反杀之前 / 之时 / 之后”

直接对应：

```text
phaseTargets:
- before
- during
- after
```

它不是强迫人物按剧本震惊，而是作者决定：

> 哪条人物线在什么阶段值得被写、值得承担什么情绪功能。

人物真正如何反应仍由 S05 Reality rehearsal 约束。

### “将人物出场顺序理一下”

对应 S04 的：

- `appearanceOrderEntityIds`；
- Event 顺序；
- 每个 Event 的 Cast Pool / Active Seed。

### “分层释放信息差 / 转移期待焦点”

S04 先设计 `informationRelease`。

S05 Node 通过 `informationReleaseSteps` 声明自己承接哪些信息移动。

S06 通过 `informationMove` 把它落进具体 Scene。

S07 再拥有最终 Reader Time 主权：

- 哪个 Scene 先给 Reader；
- 什么 withheld；
- 旧期待释放几成；
- 新期待何时提前种下；
- 章节在哪里切。

当前工程硬约束：

```text
WorldArbitrationReceipt
        ↓
S06 StorySceneExpansion
        ↓
S07 StoryReaderTimePlan
```

禁止：

```text
WorldArbitrationReceipt
→ 直接 allocate Reader Time
```

正式 S07 每个 Scene 都必须有一次 Reader Time 决策；若 `payoff` 完成旧期待，必须至少满足其一：

- `focusShiftThreadIds`：转移到已有下一条期待；
- `nextExpectationSeed`：在旧期待完全平仓前已经种下新期待；
- `terminalExpectationReason`：明确这是阶段/全书收束，允许暂时不接下一笔。

这直接落实讲师原稿：

```text
制造信息差
→ 分层释放
→ 旧期待未完全满足前提前种新信息差
→ 高潮兑现
→ 转移期待焦点
```

## 5. 当前工程实现

### Contracts

`packages/contracts/src/story-runtime.ts`

新增 / 修正：

- `StoryNodePhase`
- `StoryNodePhaseTarget`
- S05 `StoryUnitEventDesign` node fields
- `StoryScenePlan`
- `StorySceneExpansion`

### Runtime

`packages/narrative/src/story-authoring-runtime.ts`

- S05 Node phase / reaction / information reference validation；
- `finalizeStorySceneExpansion()`；
- S06 必须绑定已经 finalized + feasible 的 World Arbitration；
- participant / phase / location / causal-next validation。

### Model service

`packages/narrative/src/story-scene-runtime-workers.ts`

新增：

- `StorySceneExpansionService.expand()`

Prompt 固定：

- Node 一个问题影响多个场景；
- before / during / after；
- scene 继续提供压力与期待变化；
- arbitration 是 Reality constraint，不是 screenplay；
- S07 保留全局 Reader Time 主权。

## 6. 当前仍未完成

本次修的是 S05 / S06 层级和第一条可执行 Scene Expansion，不代表第三模块完成。

后续仍需：

1. 正式宿主把 S04 Event → S05 observation / agent activation 接通；
2. 多轮 Reality rehearsal 与 soft-route bent/broken 状态；
3. S06 expansion 持久化 / author adoption；
4. S07 已有 scene-based contract/service，下一步补跨Node连续编排与持久化；
5. S08 production handoff；
6. settlement 回写 Canon Reality。

## 7. 最短 Guardrail

```text
S05 = Story Node
Agent / Arbiter = S05内部Reality子程序
S06 = 一个Node展开多个Scene
S07 = Reader什么时候看到哪些Scene/信息
```

禁止再次写成：

```text
S05 = Agent Runtime
→ 模拟结果
→ S06再想办法补拍
```
