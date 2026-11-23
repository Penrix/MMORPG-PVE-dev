# 第三模块｜M 系列 Runtime：方法目录 → 轻量路由 → Story Search（2026-11-23）

> **STATUS: CURRENT IMPLEMENTATION CONTRACT.**
>
> 认知来源：[26 M-series × TR-I-02 Creative Method Catalog](26-m-series-tr02-creative-method-catalog.md)。
>
> 本文记录本轮真正落地的代码：不是再发明一套创作理论，而是让现有 M / TR02 方法开始可以被程序选择和调用。

## 1. 现在代码怎样工作

```text
Story Director / 调用方
已经给出当前创作问题
        │
        ▼
CreativeMethodRoutingService
只诊断“该怎么想”
        │
        ├─ 1 primary
        └─ 最多 1 secondary
        │
        ▼
CreativeMethodInvocation[]
        │
        ▼
StoryCreativeContext
        │
        ▼
StoryAuthoringService.search
对 World Objects / Creative Materials 真正执行搜索
        │
        ▼
Story Seeds
        │
        ▼
S04 Story Director
决定人物线 / Stake / Payoff
```

**路由器没有“什么值得写”的权限。** 它只能从当前卡点选择搜索运动。

## 2. 两份代码职责

### `m-series-methods.ts`

保存可运行的方法说明书：

- M01A～M10；
- M03 SELECT / COMPOSE / VERIFY；
- TR02 中仍有独立价值的矩阵组合、开放联想、反惰性、热插拔、猎场、跳跃随机、连载压力测试等。

每个定义至少包含：

```text
methodFamily
methodId
title
sourceRef
scope
phases
useWhen
avoidWhen
instruction
```

这不是把历史文档压成一个超级 Prompt，而是让程序知道每种脑法的边界。

### `creative-method-routing.ts`

只做方法选择：

1. 当前 Creative Context 已经手动指定方法时，尊重原选择，不覆盖；
2. 未指定时，从当前任务真正可用的方法里选 1 个 primary；
3. 第二种方法只有在提供不同搜索运动时，才允许作为 secondary；
4. 方法所作用的对象必须来自当前 StoryObjectField；
5. 需要素材的方法在没有 `materialSelections` 时不会进入可选集合；
6. 需要已有长篇历史的方法在没有 inherited state 时不会进入可选集合。

## 3. 为什么不把所有方法都塞给 LLM

那会重新制造巨型 Prompt：

```text
M01A + M01B + M02 + M03 + ... + TR02全部历史版
→ 模型在一大坨文字里自由发挥
```

当前做法：

```text
代码先裁掉明显不适用的方法
→ 模型只在少量 eligibleMethods 中诊断当前卡点
→ 选1主1辅
→ 把具体 instruction 写入 CreativeContext
→ Story Search 真正执行
```

## 4. 自动 Story Search 与专项方法分权

当前普通 Story Search 可自动选择：

- M01A / M01B / M02；
- M03 COMPOSE，前提是已有素材；
- M04；
- M05 / M06，前提是已有前序Story状态；
- M09，前提是已有可用演奏素材；
- TR02矩阵组合，前提是已有素材；
- 开放联想、反惰性、热插拔、猎场、跳跃随机。

不会在普通 Story Search 里自动启动：

- M03 五锚点整书海选；
- M03 SELECT / VERIFY；
- M07 男主人格重建；
- M08 A→B整书迁移；
- M10 A/B历史选角；
- TR02题材五维深潜；
- TR02连载压力测试。

这些需要各自真正的上游任务和资料，后续做专用入口。

## 5. 新调用入口

原来的：

```ts
StoryAuthoringService.search(...)
```

仍保留，适合调用方已经明确指定方法。

新增：

```ts
StoryAuthoringService.searchWithCreativeMethods(...)
```

它会：

```text
routeStorySearch
→ 得到带 methodInvocations 的 CreativeContext
→ search
→ 同时返回 routing + enriched creativeContext + search result
```

下游进入 S04 时继续使用返回的 enriched `creativeContext`，这样本轮到底用了什么方法不会丢。

## 6. 当前没有做什么

本轮没有做万能 Algorithm Registry，没有让路由器决定故事，没有把 M03 素材卡变成方法，没有新建 Reality，也没有改掉 S04 / Stake / Payoff 的编剧权。

## 7. 下一步

最值得继续的是把 **M03 SELECT → CreativeMaterialRetrievalService → M03 COMPOSE** 接成真实链。其次再把 M02 六链拆成可直接指定的细模式，以及给 M07 / M08 / M09 / M10 做需要专门证据输入的独立入口。
