# 第一模块复盘：先前究竟写了什么，真正 World Builder 应该怎样改

> **审查结论（2026-11-20）**：上一轮第一模块不是“按 WorldForge/Covel 对标项目的世界生成架构开发完成”；它是**自己编写的世界生成提示词 + React 表单 + 复用 NarraLume Canon 修改候选任务**的接口原型。用户最关心的“真实活世界内容生产”尚未得到工程和实演证明。纠正要落实到实现方向，而不是往原提示词再加几句。

## A. 当前源码逐项定性

| 当前源码 | 真正实现了什么 | **没有实现什么** | 判定 |
|---|---|---|---|
| [`apps/web/src/lib/world-builder.ts`](../../apps/web/src/lib/world-builder.ts) | 自己写的 W0/W1、五轮内容生成 + 事实/关系补充指令；从已有 MMORPG 思想摘要提取世界内容要求 | 未接入 v0.1/v0.7 **完整内容生成方法**；未引用 Covel schema/世界包、WorldForge agent/graph；输出仍是 NarraLume 泛用 Canon 修改候选 | **自行编写的语义接线，不是对标架构移植** |
| [`apps/web/src/workspaces/world-builder.tsx`](../../apps/web/src/workspaces/world-builder.tsx) | W0/W1 界面、分轮选择、调用旧 AI 任务、展示旧候选采纳组件、显示 Canon 概况 | 不是分层世界地图生产器；没有 W0/W1 稳定对象ID、世界包浏览/版本/局部深入、图关联与可行动内容导航 | **页面原型** |
| [`apps/web/src/styles/world-builder.css`](../../apps/web/src/styles/world-builder.css) | 使用 NarraLume 主题设计令牌、响应式排版 | 没有地图/网络可视化 | UI接线 |
| [`apps/web/test/world-builder.test.ts`](../../apps/web/test/world-builder.test.ts) | 检查生成指令包含目标关键词、W0/W1校验 | **没有跑真实 LLM 世界创作，也没检验一包实体与关系从候选到Canon，再到正文的完整链** | 仅提示词装配测试 |
| NarraLume 原生 `canon-spread-candidate` | 多模型调用、单类 Canon 候选、逐条接受/拒绝、审阅差异、结果写入旧Canon | 不知道 MMORPG 新世界应有什么社会生态；每次生成局限一个 Canon spread；没有“先建世界包再多类关系协同提交”的事务 | **复用了基础设施，不能当世界引擎** |

## B. 当前模型会在哪里掉链子

1. **没有真实世界包**：W0 根图、区域W1、组织、人物、资源、行动只松散地成为实体/事实/时间线。单靠 description 很容易出现“人有卡，组织有卡，资源有卡，彼此没实际运行关系”的空壳世界。
2. **生成是散轮单一 spread**：先调用 entities 再调用 timeline/facts/relations。模型可能忘记把人、资源、组织结合成一个真实场域；新实体尚未采用时无法被后续轮真实ID引用。原 Canon 候选单次 max 20 条且模式是“小量可裁定修改”，不是跨类型完整世界包。
3. **W1 只有自由文本焦点**：没有 `parentAreaId`、地图ID、邻接社会通道、确定的当前地点/分支引用；同名地点可能被反复创建为新身份。
4. **缺少有价格的世界交互内容**：原有 prompt 说“高价对象”，但没生产一个完整的“谁持有 → 谁有准入权 → 谁在争 → 哪些实际行动可做 → 取得后怎样转化”的可操作网络。
5. **没有世界自动运行**：只要求 LLM“描述正在发生的事务”，不等于 NPC 有独立目标和连续状态。把未来可能行动写入 `timeline_events` 甚至可能误称为已发生事实。
6. **缺少可追溯证据身份**：历史/原著核查结果、模型推断、小说原创、作者已采纳 Reality、尚未兑现的剧情计划不能仅靠提示词提醒而混写一份描述。
7. **不是对标源码集成**：Covel 世界包、WorldForge 事件图与实体行动、CampaignRepo 地图双链、SNEQ 单次事件结算，**代码上都尚未移植**。
8. **没有可靠质量实演**：没有拿玄幻、1878法国、明朝或其他具体世界跑完“人物进入/世界自转/资源改变/回访”样本，更没有在 NarraLume 写出几十章证明长篇创作增益。

**结论：这个 PR 可以留下作为最早的 UI 纵切，但不能继续沿“扩写七类提示词就算完成第一模块”的路推进。**

## C. 正确的模块结构：独立世界内容生产，使用现有 Canon 当唯一 Reality

### 拟议的数据与运行边界（尚未实现，名称仅是设计建议）

```text
WorldProductionRequest
  projectId / author intent / worldTime / W0 or W1 scope / targetAreaId?
  └─ 附世界当前快照与既有图的可见范围
       │
       ▼
WorldContentProducer (LLM + 具体游戏内容设计方法)
  ├─ WorldRoot (大地图、力量、社会与高价资源分布)
  ├─ Zone/Hub/POI (地理 + 社会入口，何处能去、能做什么)
  ├─ Faction (组织职权、内部人物、地盘、利益、事务)
  ├─ NPC (真实生活、目标、能力、关系与行动)
  ├─ Resource/Right (持有者、控制者、价格、准入、资产变换)
  ├─ Activity/Storylet (当前事务、触发条件、可能后果)
  └─ Relation/AccessEdge (谁能通过谁到达什么高价内容)
       │
       ▼
WorldPackDraft / Typed Graph / 来源引用
    │     ▲
    ├─ 可修改、可分叉回返、继续深化
    ├─ 跨文件/跨实体 ID 校验（Covel）
    ├─ 关系投影与多跳查询（WorldForge）
    └─ 世界可活动/可争取性实演（不是只数对象个数）
       │
       ▼
作者审阅：整体阅读世界包，逐实体/关系/事件修改和采纳
       │
       ▼
映射到 NarraLume 现有 Canon（事务性落库，唯一Reality）
       │
       ├── World Atlas：可查世界区域、关系、历史、状态
       └── Novel Studio：直接查当前世界，正常生成/复盘/结算正文
                                       │
                        新地区或世界内容缺口
                                       └──────↺ WorldProductionRequest
```

### 最少应有的逻辑记录（不是要求额外建七张数据库）

| 建议逻辑记录 | 不可缺少的内容和作用 | 借鉴来源 |
|---|---|---|
| `WorldRoot` | 世界身份、时间和宏观区域/社会力量/高价资源、来源与现状；下挂多个局部区域 | MMORPG原始v0.1/v0.7，OnlyWorlds `world` |
| `Zone` / `Hub` / `POI` | W0/W1层级、区域ID/父ID、真实地点、地理与社会通道、入口条件、可进入场所和主要活动 | Covel世界包、OnlyWorlds `zone/location/map`、WorldForge图 |
| `Faction` | 具体领导和组织结构、职责/权力、地盘、资源、经济来源、内部派系及正在行动的人 | 原研究的 Factions，WorldForge entity agent |
| `NPC` | 具体身份、独立愿望、社会角色/价格、关系、日常活动、当前目标与知识边界 | 原研究 NPC Ecology、WorldForge agent |
| `Resource/Right` | 高价物品/资格/产权/使用权、当前持有人与控制者、接近/夺取/享受通路与社会价值 | 原研究 Resources，OnlyWorlds Object/Relation |
| `Activity` / `WorldOpportunity` | 独立行动者、现在正在做的事、参与者、资源、原因、变化可能性；**计划/趋势不能直接登记成已发生事件** | 原研究 Living World / Storylets、WorldForge agent/event |
| `WorldSource` / `WorldChange` | 历史/原著/推断/原创身份、证据位置、作者采纳/修订、故事时间与可见范围 | Covel校验，SNEQ投影，NarraLume原Canon与变更事务 |

**关键工程决策**：上表是“生成内容如何具有稳定身份和关系”的逻辑层；可使用 NarraLume 既有 `canon_entities` / `canon_facts` / `timeline_events` / `relationship_events` + 少量新表/索引完成。不要未验证就搬进另一整个世界数据库或复制事实到多个 Canon。

## D. 借 Covel 先解决“内容是一整套，而不是七张卡”

目标的世界包过程：

```text
定义当前世界生产范围
  ↓
读取原有世界 Reality、相关人物与权利、区域位置及历史
  ↓
提供可查询的当前世界对象 schema（不是把字段焊死进Prompt）
  ↓
生成一整组互有实际引用的人、场所、势力、资产、活动
  ↓
校验区域父子/邻接、ID引用、权属、时间、生效身份
  ↓
内容质量的主动扩展：谁还与这群人有关？哪条产业/师徒/情爱/权力路线打开新地图？
  ↓
作者看整个世界包，不只看一排孤立卡；可编辑后逐项或成套采纳
  ↓
写入唯一 Canon + 保留世界包来源与修订映射
  ↺ 任意区域继续打开或重新深化
```

参考 Covel `.claude/skills/create-world/SKILL.md` 的 `describe:authoring → world.yaml/WORLD.md/data/characters → validate:world`；需迁移的是**可发现的作者协议和世界包生产/校验机制**，而不是游戏玩法插件或那份 Skill 的字面提示词。

## E. 借 WorldForge 解决“世界如何继续活着”

目标不是强制每秒运行所有 NPC，也不是把小说变成 Civilization 数值模拟。按需：

- 当前活跃 NPC / 组织，从 Canon 中取得他们实际可知的世界、目标、当前资源和关系；当男主不介入时，能基于自身利益提出具体可演出的行动。
- 形成**事件候选及增量**（谁行动、对谁、动用什么资源、影响谁的实际权益），不要将 LLM 散文直接变成新世界事实。
- 经仲裁/作者采纳的事件才映射到 NarraLume 的 Canon/Timeline；正文写出/确认的事件仍用原版章节结算。
- 世界扩展后图上出现新人物、交易对象、权力中介、资源流通、仇怨与爱情关系；旧区域持续保留并可回访。
- WorldForge `agent.ts`、`arbiter.ts`、`event_cascade.rs` 和 `graph_traverse.rs` 的机制可复用，但数值 tick 默认范围、预算和伪历史时间尺度不能直接照搬到单主角长篇 Reader Time。

## F. 三项具体实演才算第一模块具有创作增益

1. **玄幻**：宗门已存在职位/内外门/功法/丹药/坊市与经营生计；男主选择进入某一社会通道，得到真实权利或宝物；进入坊市时能发现商人和家族已经在行动；回访旧宗门时旧关系与资产仍然生效。
2. **1878法国**：先有法国社会 W0 的金融/军政/文化多领域。W1打开巴黎出版、银行或沙龙时，不是生成名人名单，而是有具体出版社、交易/版权中介、作家与女性的当前处境、社会价格、正在发生的利益关系；主角可沿多条既有路线行动。
3. **1392明朝**：W0存在朝廷、军队、地方士绅、经济生活与皇权关系；W1可以按真实时间与既有目标打开东宫/勋贵/地方社会。**不因为作者未指定而自行绑定“男主必为医生、必须救朱标”**；历史事实与小说原创在来源字段中可辨。

每个样本真正检查：生成的世界是否能让不同的人**自己发起有意义的行动**；有没有具体资源、社会门槛和高价奖赏；男主取得一件东西之后能否把它作为下一段故事的本金；若改走另一条路线世界是否仍有内容；从该世界直接进入 NarraLume 小说创作是否能产生非模板化的连续故事。

## G. 本审查给当前代码和项目的操作结论

- **保留 PR #1 作为可替换的低层接线/交互原型，不将 `world-builder.ts` 的固定七轮或文字字段认定为最终数据协议。**
- 下一次真正的世界生成架构施工，先研究/选用 Covel 世界包和 OnlyWorlds 类型的可引用对象形式，与 NarraLume Canon 绑定，再接 WorldForge 关系/活动，而不是先忙于 UI 漂亮或 prompt 词句打磨。
- 原始 MMORPG v0.1、v0.7 负责定义什么样的**人、世界、资产和活动**才有创作价值；对标开源负责让这些成果能生成、定位、检索、修改、复用、持续更新。
- 在未完成真实模型测试、跨类型采纳和回访前，页面存在、单元测试通过，都不能替代“第一模块完成”判断。
