# M01B 内嵌 × Creative Operator 按需调用（2026-11-23）

> **STATUS: CURRENT IMPLEMENTATION CONTRACT.**
>
> 本文覆盖旧的“当前问题 → Router 自动选1主1辅 → Story Search”实现合同。

## 1. 当前裁决

M 系列不是固定流程。

```text
Module 3｜Story Director
讲师编剧主干
+
M01B always-on
├── Upgrade Front
├── Actor Front
└── Reader Front
        │
        │ 局部需要额外发散/迁移/变奏/检验
        ▼
Module 2｜Creative Operator Space
M01A / M02 / M03历史算法 / M04...M10 / TR02 operators
        │
        │ 显式点名调用
        ▼
CreativeMethodInvocation
        │
        ▼
候选 / 观察 / 新连接
        │
        └──────────────→ 回 Story Director
```

**流程属于第三模块，算子不拥有流程。**

## 2. M01B 怎样嵌入第三模块

M01B 不是“运行一次三问”，而是每次 Story Search / S04 编剧都存在的三份连续前线：

```text
Upgrade Front
当前位置 / 当前Step / Stage Goal / Gate / Settlement Target / 已留资产

Actor Front
当前Existing Cast / 活跃Stake / 谁已经押了什么 / 下一手会自己干什么

Reader Front
Open Expectation / Reader已知 / 未结问题 / 哪笔势能正在盯市
```

当前代码由 `StoryAuthoringService` 在 S01-S03 `search(...)` 与 S04 `designStoryUnit(...)` 都注入 `m01bContinuity`。它不是额外生成器，也不创建新 Reality。

## 3. Creative Operator Space 怎样调用

其他 M / TR02 方法是第二模块工具架。

`CreativeOperatorInvocationService.invoke(...)` 接收 `methodId + purpose + inputObjectIds` 与当前 Story Context，检查真实前提后生成一条 `CreativeMethodInvocation`。

没有自动“主方法 / 辅方法”选择。

```text
Director 当前卡点
→ 点名 M02
→ invoke(M02, 当前对象)
→ 得到候选
→ 回 Director

需要时再点名 M04 / TR02 / M05 ...
```

可以重复、切换、回返，但不存在固定 M01→M02→M03 流水线。

## 4. 与 M03 素材库的关系

```text
Creative Material Space
= 拿什么想
= MOVE / PLAY / REL / ARCH / ...

Creative Operator Space
= 怎么想
= M02 / M04 / TR02 anti-inertia / ...

M01B
= 第三模块一直怎样继续往深处听
```

素材不会自动选择算子，算子也不会自动把素材变成 Reality。需要 M03 COMPOSE、M05 PLAY 等算子时，调用方先有合格 `materialSelections`，再显式 invoke 对应算子。

## 5. 兼容壳

旧 `CreativeMethodRoutingService` 与 `StoryAuthoringService.searchWithCreativeMethods(...)` 暂时保留，避免已有调用面立刻断裂，但语义已经改变：

- 不再调用模型自动选方法；
- 不再自动召回 M03 素材；
- 已有显式 operator invocation 就原样带入；
- 没有就直接让讲师 Director + M01B 继续运行。

## 6. Guardrails

禁止恢复自动 Router、1主1辅、M01B 可选化、M03 素材算法化、巨型 Prompt 化，以及算子候选直接升级为 Reality。

> **讲师负责编故事，M01B负责一直往深处挖，第二模块算子负责局部换脑法。**
