# 第三模块｜S08 Production Handoff：锁定 S06/S07 后只生产，不二次编剧（2026-11-22）

> **STATUS: CURRENT SUPPORT / PRODUCTION CONTRACT.** 本文定义 S06/S07 已锁定之后怎样进入 NarraLume 正文生产。它不拥有编剧权；故事方向服从 [23](23-module3-upgrade-stake-director.md)。

> 上游先读 [20 Object-Grounded Writers' Room](20-object-grounded-writers-room.md)、[21 S05 Story Node → S06 Scene Expansion](21-s05-story-node-s06-scene-expansion.md) 与 [19 Expectation / Narrative Runtime](19-expectation-narrative-runtime.md)。

## 1. 本层解决什么

S06 已经完成叙事场景设计，S07 已经完成 Reader Time 编排。

因此 S08 不再回答：

> “这一章应该发生什么？”

它只回答：

> **“怎样把已经锁定的 S06 / S07 设计交给 NarraLume 现有正文生产链，并保证生产层不重新夺回编剧权？”**

当前正式链：

```text
S04 Story Unit
↓
S05 Story Node
  └─ Character Agent + World Arbiter
     Reality Rehearsal
↓
S06 StorySceneExpansion
↓
S07 StoryReaderTimePlan
↓
S08 StoryChapterProductionHandoff
↓
NarraLume ChapterWorkerSuite
  ├─ scene.plan
  │  有 locked handoff 时：确定性采用，不调用模型
  ├─ draft.generate
  │  只把锁定设计演成正文
  ├─ deterministic / semantic review
  ├─ revision
  └─ settlement / commit
↓
Project Reality
```

## 2. 两种 Scene 必须区分

### S06 Story Scene

这是**叙事设计对象**。

它已经决定：

- 哪些人物在场；
- 当前局部问题；
- 场面压力；
- 可观察起点；
- 人物互动；
- 信息怎样移动；
- Reader期待怎样变化；
- 使用哪一条 S05 projected Reality；
- 场后状态；
- 下一场为什么自然发生。

### NarraLume ScenePlan

这是**正文生产清单**。

它不是第二次导演，也不是第二个 Writers' Room。

存在 S08 handoff 时，NarraLume 的 `scene.plan` 只负责接收已经转换好的生产字段；不得重新发明 Scene。

因此：

```text
S06 Scene Design
!=
NarraLume ScenePlan Production Checklist
```

## 3. StoryChapterProductionHandoff

实现：

`packages/narrative/src/story-production-handoff.ts`

当前 handoff 保存：

- `storySceneExpansionDigest`
- `storyReaderTimePlanDigest`
- `realityFingerprint`
- `chapterTitle`
- `chapterGoal`
- `povEntityId`
- `plannedEntityIds`
- `targetCharacters`
- `sourceSceneIds`
- `lockedScenePlan`
- 完整 `readerTimeDirectives`
- `digest`

它同时承担两个目标：

1. 给 NarraLume 一个现成的 `ScenePlan` 生产格式；
2. 不把 S07 的信息释放、期待接续和 Reader Time 决策压扁丢失。

## 4. 确定性转换，不再调用新 LLM

`buildStoryChapterProductionHandoff()` 是确定性适配器。

### Scene 选择

只进入正文生产的 Scene：

```text
action != skip
AND
readerTime != none
```

因此：

> **Reality 中真实发生但 S07 判定不值得占 Reader Time 的内容，不得被下游 scene.plan 偷偷写回正文。**

### 顺序

生产顺序使用：

`StoryReaderTimeSceneDecision.readerOrder`

而不是 S06 Reality 顺序。

这是 Reader Time 的正式主权。

### 篇幅

Reader Time 只转成**篇幅参考权重**：

```text
mention = 1
beat    = 2
scene   = 4
chapter = 8
```

每个可见 Scene 保留最低展开空间，再按权重分配 `targetCharacters`。

它控制的是“这一拍值得 Reader 停留多久”，不是重新创造剧情。

## 5. 信息与期待不能在适配时丢失

每个生产 Scene 仍携带：

- `informationReleased`
- `informationWithheld`
- `embodimentTargets`
- `payoffThreadIds`
- `reactionTargetEntityIds`
- `retainedGainOpportunity`
- `focusShiftThreadIds`
- `nextExpectationSeed`
- `chapterBoundary`

其中一部分映射进 NarraLume `ScenePlan` 的 goal/conflict/turn/outcome，完整版本同时留在 `readerTimeDirectives`。

禁止只保留：

```text
goal
conflict
outcome
```

然后把讲师原稿的期待经营全部蒸发。

## 6. ChapterWorkerSuite 接线

`packages/narrative/src/workers.ts`

### Context Compile

若目标 chapter metadata 中存在有效 `storyProductionHandoff`：

- 自动合并 handoff 的 `plannedEntityIds`；
- handoff 作为 priority 100 / locked / required 的上下文源进入 Chapter production；
- 正文模型能够看到完整 S06/S07 指令，而不只是压扁后的 ScenePlan。

### scene.plan

存在 handoff 时：

```text
model.structured("scene-plan")
= 0 次
```

直接返回：

`handoff.lockedScenePlan`

并标记：

- `source = story-reader-time-handoff`
- `generation.mode = locked-handoff`
- `attempts = 0`

这是本层最重要的回归锁。

### draft.generate

正文层收到硬约束：

- 不得重排 Scene；
- 不得替换 S05 已验证的人物选择；
- 不得提前释放 S07 withheld 信息；
- 不得恢复 skip / none 内容；
- 不得提前兑现 `nextExpectationSeed`。

它现在真正回到“演奏正文”的位置。

## 7. Staging

`stageStoryChapterProductionHandoff()`

负责把已经确认要生产的 handoff 挂到具体 chapter outline node：

`metadata.storyProductionHandoff`

并合并：

`metadata.plannedEntityIds`

这是显式 staging，不是 Settlement：

- 不写 Canon Reality；
- 不宣称正文已经发生；
- 只是告诉 ChapterWorkerSuite：这一章的叙事设计已经锁定。

## 8. 当前测试锁

### `story-production-handoff.test.ts`

验证：

- Reader 顺序可以不同于 Reality 顺序；
- skip / none Scene 不进入 production；
- Reader Time 篇幅权重保持总字数；
- 完整 information / expectation directive 不丢失；
- handoff 可以正确 stage 到 chapter metadata。

### `chapter-workers.test.ts`

验证：

> **存在 locked S07 handoff 时，ChapterWorkerSuite 的 scene.plan 不得调用模型。**

并验证：

- 正确采用 handoff digest；
- context 中包含 “S06/S07 锁定叙事生产交接”；
- 下一条期待等完整 Reader Time 信息进入正文上下文。

## 9. 当前还没解决什么

这次完成的是**第一条可执行 S07 → S08 → NarraLume production bridge**，不是整个第三模块完成。

仍需：

1. S04 Event → S05 Character Agent 多轮宿主编排；
2. Reality bent / broken 后的 Successor Writers' Room；
3. S06 / S07 的正式持久化、author adoption 与 UI；
4. 跨多个 S05 Node 的连续 S07 Reader Time 编排；
5. 自动把多个 chapter boundary 切成连续 ChapterProductionHandoff；
6. 完整端到端真实模型验收：
   `Object Field → Story → Node → Rehearsal → Scene → Reader Time → Manuscript → Settlement`。

## 10. 最短 Guardrail

```text
S06 = 叙事场景设计
S07 = Reader Time
S08 = Production Handoff
NarraLume scene.plan = 生产格式，不是第二个编剧室
draft.generate = 正文演奏
settlement = 真实写回
```

禁止再次恢复：

```text
S06/S07已经定完
→ scene.plan再让LLM自由规划
→ 把前面的编剧结果重新洗牌
```
