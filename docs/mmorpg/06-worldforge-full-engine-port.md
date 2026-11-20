# WorldForge 真源码整体移植｜模拟引擎、Agent 与 NarraLume 桥接

> **2026-11-20 工作实况。** 之前仅移植 `causality.ts`、`registry.ts` 两个算法，现在已将 **WorldForge 的完整纯 TypeScript 模拟运行依赖链**按实际源码文件迁入；不把临时模拟结果写回用户的正式小说世界。当前 PR 仍属 Draft，须按最新 Actions 验证通过才可合并。

## 代码从哪里来

原项目：[Fange12306/worldforge](https://github.com/Fange12306/worldforge/tree/main/src/lib/simulation)，MIT License。每个移植源码文件头都标记上游真实仓库路径、Git blob SHA 和许可。

本仓库真实移植位置：[vendor/worldforge/full](../../packages/narrative/src/vendor/worldforge/full/)。

| 完整模块 | 真正移植的上游 TypeScript 文件 | 意义 |
|---|---|---|
| **顶层运行器** | `engine.ts`、`types.ts`、`index.ts` | `createSession`、`runTicks`、实体/地点/演化状态 |
| **自主决策** | `agent.ts`、`context.ts`、`llm.ts` | `runEntityAgent`、`runAllAgents`、独立知识与注意力等级 |
| **历史裁决** | `arbiter.ts`、`causality.ts`、`lore.ts` | 冲突检测、硬约束、历史锁定、前因候选 |
| **世界物理与地理** | `physics.ts`、`space.ts`、`measure.ts`、`scale.ts`、`geography.ts`、`subdivision.ts` | 资源、承载、空间邻接和分辨率细化 |
| **发展与演化** | `registry.ts`、`regime.ts`、`culture.ts`、`entity-pool.ts` | 发展维度、政体、文化、组织兴衰 |
| **其他运行能力** | `random.ts`、`black-swan.ts`、`decree.ts`、`branch.ts`、`import-entries.ts`、`init-customizer.ts` | 随机种子、稀有事件、干预、分支、初始化内容 |

以上是真正的上游**算法源码**，不是自己写同名函数。它们的内部 `.ts` 相对导入后缀仅适配为 NarraLume ESM 所需 `.js`；上游源使用 `@ts-nocheck` 暂时兼容不同的严格编译选项，新增的桥接/测试仍由本仓库 TypeScript 和 ESLint 检查。

**不移植两个 Tauri IO 文件**：`persistence.ts`、`bridge.ts` 属于上游独立文件数据库、Timeline 提交接口。NarraLume 已有 SQLite、Canon 和历史事件，它们在这里必须只有一个权威来源，不能为了整包复制而造第二套真相。

## 真正接进第一模块的调用

`packages/narrative/src/worldforge-faction-bridge.ts` 导入和执行上游原函数：

1. 从 **已确认 Canon** 选出当前相关组织和关系，用稳定 Canon ID 做模拟主体。
2. 构建**仅在内存存在**的 WorldForge 会话，将尚无客观依据的数值视作**技术占位符**，不当作社会现实、真实地形或价格。
3. 调用真实 `runAllAgents`，每个相关组织 Agent 根据已有关系生成独立行动候选。
4. 调用真实 `arbitrate` 处理互相冲突或违反当前已知条件的候选。
5. 将通过的行动作为“**未发生的提议**”传给原 WorldPack 的 `world.advance`，再由模型合成为可供作者检查的世界包；**不会因为模拟了便改变任何正式事实**。
6. `world.generate` 的辅助 Agent 调用消耗会和正式 WorldPack 调用一并统计，不隐藏模型成本。

当前这是**势力层**的第一个真实接线，不等于把 WorldForge 以文明人口为对象的宏观物理模型强行充作人物心理。NPC个人GOAP、信息延迟、社会传播仍须进一步接入，SNEQ已在 [当前源码](../../packages/narrative/src/vendor/sneq/) 提供独立知识投影。作者所锁定的特殊能力不得被 WorldForge 示例魔法/真气默认规则附加代价、失败率或禁止条款。

### 具体源代码及测试

- [原调度器](../../packages/narrative/src/vendor/worldforge/full/engine.ts)
- [原独立 Agent](../../packages/narrative/src/vendor/worldforge/full/agent.ts)
- [原仲裁器](../../packages/narrative/src/vendor/worldforge/full/arbiter.ts)
- [NarraLume 势力代理桥](../../packages/narrative/src/worldforge-faction-bridge.ts)
- [实测完整上游引擎](../../packages/narrative/test/worldforge-full-engine.test.ts)
- [实测势力桥](../../packages/narrative/test/worldforge-faction-bridge.test.ts)
- [实际 W1推进 API 测试](../../apps/server/test/world-pack-api.test.ts)

## 能力对照与下一步

| 对象 | 状态 | 尚缺 |
|---|---|---|
| WorldForge 源码调用链 | 已实际移植，受CI验证 | 严格 TS 兼容、运行性能追踪 |
| Engine tick /物理/历史 | 可独立调用，已写测试 | 结合**真实**世界法则与时间尺度，不自动代入示例规则 |
| 多势力 Agent/arbiter → WorldPack advance | 已真正接入代码 | 连续状态快照、按用户指定时钟迭代、真实LLM质量测试 |
| WorldForge 每个人物的GOAP | **没有**，原引擎的Entity Agent偏文明/组织 | 独立个人目标、前置条件、可用动作、行动收益和世界事件 |
| Covel完整 create-world 主程序 | **未移植**，当前是解析/排序/缓存模块 | 分段重试、段落校验、局部修订与源数据契约 |
| v0.2开放生成状态机 | 原文已进入范围选择 | 程序能自主从当前对象分叉、回返、持续生产 |
| v0.3～v0.7力量/玩法/社会/GM | 研究全稿已保存，局部进入提示词 | 逐模块调用成熟游戏设计方法，而非“一次生成JSON” |

**判断标准仍是实操**：用户给出一个玄幻宗门及坊市，系统应该能生成独立人物/势力/资源与玩法、连续推进多个组织与NPC且不重置已有权益，作者采用后这些事实能在后续章节中被调用。源文件数量、CI绿色都不能单独证明它做到了。
