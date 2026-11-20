# MMORPG-PVE × NarraLume｜当前架构决策与讨论形成史

> 状态：**2026-11-20 Working / 已选择技术底座，世界生产架构尚未实现完成。**  
> 这是当前开发项目的工程认知入口，不是原作者原话逐字存档，不替代私有研究仓库的 v0.1/v0.7 原文。上一轮 PR #1 只是 World Builder 接口原型，不能据此宣布第一模块已完成。

## 1. 为什么不重新造小说系统

### 决策

- 直接在 [abligail/narralume](https://github.com/abligail/narralume) Apache-2.0 源码上二次开发，当前 Fork：[Penrix/MMORPG-PVE-dev](https://github.com/Penrix/MMORPG-PVE-dev)。
- **保留 NarraLume 的完整小说编写能力，而不是仿照它重新实现。** 既有项目提供建书、作者意图、长期 Story Compass、`book → volume → arc → chapter → scene → beat` 大纲树、滚动规划、正文版本、审阅、故事状态摘要、人物与读者知情、关系/时间线、章节结算、长期故事线复盘、运行恢复与 SQLite。
- 原先想重新开发的模块②“世界资料库”与模块③“小说创作系统”，大部分通用底层功能已经存在，因此**优先复用原版**；不把“已具备通用写作基础设施”误说成“已具备男频创作增益”。
- 既有的第四代中枢金字塔 S01～S08 提示词**暂不作为软件第一阶段的必经流程**。暂不采用不等于删除或判定无价值。以后确有创作收益时可作为增强的故事空间网络；不能粗暴地把 S 层等同于 NarraLume 的固定大纲树。

### 形成路线（纠正必须保留）

1. 起初按三个平级业务模块规划：① World Builder（创造世界）；② World Atlas（已确认世界与状态）；③ Creation Pyramid / S空间（创造故事）。
2. 对照 NarraLume 真实代码后发现：大纲节点本身是数据库记录；正文提交可存版本、章节摘要与 `stateDelta`，从章节提取 Canon 变化候选；关系、事实、时间线等经采纳可回写；长期故事线和卷/弧有复盘与候选更新机制。
3. 因此用户提出暂时放弃 S 提示词时，判断 NarraLume **几乎可以承担②与③的常规业务**；主要缺口转到①世界设计与游戏内容生产。
4. 用户已 Fork NarraLume 到 `Penrix/MMORPG-PVE-dev`。上一轮新增 W0/W1 页面及候选复用，后经代码检查承认：它借用 NarraLume 基础设施，**没有真正移植 Covel、WorldForge 等世界生成/运行架构**；应定性为原型。这一纠正优先于 PR 里任何含糊的“首版完成”表述。

## 2. 三模块是业务平级，但不要求三套数据库

```text
                     单一项目 / 统一身份、来源与版本
    ┌──────────────────────┼───────────────────────────┐
    │                      │                           │
① World Builder       ② World Atlas             ③ Novel Studio
世界设计 + 内容制作     已确认Reality的查阅修订       NarraLume原生小说创作
W0、W1、内容生态       实体/事实/权利/关系/事件       大纲/Story Compass/章节/正文
    │                      ▲                           ▲
    ├──世界候选→审阅采用─────┤                           │
    │                      └────已确认世界内容和历史─────┤
    │                                                  │
    ◀────新地图/世界内容缺口请求（也可作者独立启动）──────┤
    │                                                  │
    └──────────已确认世界增量供后续小说创作───────────────┘
                       ③正式正文的事实变化 → ②
```

- **① 决定“世界具体生产什么”**：有人的地方、机构、资源、高价对象、实际职业与生活、NPC当前行为；不限开书前调用，换地图、换圈层、剧情深化时都能继续生产。
- **② 决定“哪些世界事实已经成立、何时有效、谁知道、来源是什么”**：表现为独立世界资料工作台，可在 NarraLume Canon、关系、时间线等现有数据层上扩展。②不负责决定故事结构。
- **③ 决定“Reader看到怎样的具体故事”**：现阶段直接使用 NarraLume 作者意图、长期故事线、滚动大纲、正文、版本、结算、阶段复盘。不要为了形式上的三模块重新造小说引擎。
- 三者在操作入口上平级，底层可共用 SQLite、统一主键和同一套审阅事务；世界候选、已采用世界 Reality、未发生的故事计划、已定稿正文和可检索创意知识须保留不同**身份**。

## 3. 第一模块不是「生成世界设定简介」

世界生成以项目原有的 v0.1/v0.7 研究为创作思想基础，**不能被本文件的简写替换**。关键决定如下：

- W0 是整体世界战略底图：地理/社会区域、主要权力与力量体系、具体势力和高价人物、资源/宝物、实际进入路径、各层生活与行动。允许局部暂粗，但不能只有政经文教目录、宗门/家族标签。
- W1 是把某个真实区域、圈层、行业或地图进一步制作成**能进入和活动的世界内容**。`类型文 × 当前时间地点 × 稀缺性`用来选择投入分辨率的位置，优先给**已经选定的高价目标**塑造真正稀缺性，不能自动替换目标。
- 现实世界没有围绕男主等待：人物在上班、争权、做生意、修炼、恋爱、经营家庭，组织有职权、资源与正在执行的计划。男主的特殊能力只是进入这个现实后的不同可能性。
- 角色进入不同区域时，①必须先读②当下已确认的世界、既有正文和历史事件，再增量生产新人物、内容和生态；旧人旧物旧权利不能“换地图重置”。
- 单男主 PVE；不设计多玩家竞技 MMO，不把具体世界当唯一主线任务清单。
- 男频 Reader 要能在具体内容中感受到财富、能力、地位、自由、风流、事业和权力等值得消费的人生；“赢”应留下实际权益或可追踪的未来势能，而非空口夸奖。
- 成果至少要有社会力量与取得路径、人物独立目标、场所活动、资源归属、已经发生的事务及开放发展可能。程序保证引用、版本和审阅；真正的人物/组织/世界创意必须由 LLM 在完整材料支持下具体生产，而非只靠字段枚举。

## 4. 区分两种世界/故事生成（免得串线）

| 对象 | ①世界内容分辨率 | ③故事内容分辨率 |
|---|---|---|
| 目标 | 扩充世界实际存在的人/地/物/力量/生活与活动 | 具体故事目标、行动、事件、演出与 Reader 时间 |
| 提高精度 | W0 → 区域/圈层 W1 → POI、NPC、势力、资源、活动 | 当前采用 NarraLume 的 Book/Volume/Arc/Chapter/Scene/Beat |
| 关键回返 | ③需要新地图 / 高价对象 → ①生产并经②确认 | 章节/阶段复盘 → 后续滚动大纲与故事线 |
| 事实归属 | 世界对象与活动作为候选，经作者采用后进入② | 计划不是正文事实；定稿正文的世界结果经结算写入② |
| 重要区别 | ①不是按预写章节“补布景” | ③不是背着②随意把新世界设定认定为事实 |

### 参考工程源码（已核对）

- NarraLume [`packages/persistence/src/story-repository.ts`](https://github.com/abligail/narralume/blob/main/packages/persistence/src/story-repository.ts)：稳定大纲节点、修改与排序。
- [`packages/narrative/src/workers.ts`](https://github.com/abligail/narralume/blob/main/packages/narrative/src/workers.ts)：提交章节、保存 `narrative_summaries.stateDelta`、产生 Canon change set。
- [`packages/narrative/src/settlement-application-service.ts`](https://github.com/abligail/narralume/blob/main/packages/narrative/src/settlement-application-service.ts)：采纳后保存事实、关系、时间事件和知识记录。
- [`packages/narrative/src/automation-workers.ts`](https://github.com/abligail/narralume/blob/main/packages/narrative/src/automation-workers.ts)：初始设定、滚动大纲、弧/卷复盘。
- 用户项目知识母本（**私有，不直接复制至公开Fork**）：`Penrix/MMORPG-PVE/dist/knowledge/world-v01.md`、`world-v07.md` 及其持续协作文档。实际创作方法以最新原文和修正为准。

## 5. 本次实现与未实现的边界

- PR [#1](https://github.com/Penrix/MMORPG-PVE-dev/pull/1) 在分支 `feat/world-builder-w0-w1-mvp` 增加世界工作台和 NarraLume 候选接口调用。**这只是界面/生成指令接线原型**。
- 尚未完成：Covel 式世界包、独立 W0/W1 区域模型、WorldForge 式跨对象关系图与事件级联、NPC 目标行为调度、世界生成包的多类型事务采纳、第三模块的自动世界缺口请求、迁移旧 Atlas 数据。
- 没有对真实模型进行有代表性的 W0/W1 内容验收；没有证据表明这版内容生成质量达到小说实际使用要求。
- **Fork 当前为公开仓库**；禁止在未得到明确授权前将私有原创全文、M03原卡、私人备忘、样本内容、任何凭据或内部数据直接同步公开。上游许可和保留署名义务参见第三方复用清单。

## 后续阅读

1. [开源项目对标与复用 Crosswalk](01-reuse-crosswalk.md)：具体借谁的什么代码 / 什么架构，哪些禁止重复建。
2. [第一模块原型代码审查和目标架构](02-world-builder-audit-and-design.md)：当前真正写了什么、缺什么。
3. [实施纵切、验收与断点](03-build-order-and-acceptance.md)：按依赖推进，而不是为编清单停止创作。
