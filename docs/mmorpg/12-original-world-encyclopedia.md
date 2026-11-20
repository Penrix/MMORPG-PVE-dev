# 第二模块｜原生母体专业百科数据库 v0.1（2026-11-20）

> **工程范围**：独立保存原著、历史、都市年代、人物与世界内容，供多本男频长篇反复 Fork；**不是**第一模块世界生成，也**不是**小说项目 Canon。原生母体的全时代资料不受小说切入时间影响。
>
> 依据：《男频语义内核 v1.3》126～135、141 节；世界设计 v0.1～v0.7；[10 已确认错误与禁令](10-module2-cognition-and-error-guardrails.md)、[11 Project Fork/Diff](11-world-fork-diff-character-invariants.md)。

## 1. 当前真正使用的数据库结构

```text
NarraLume 同一个 SQLite
├─ ORIGINAL-WORLD REFERENCE｜原生母体完整知识（项目之前存在）
│  ├─ 049 source_corpora/source_records/source_relations
│  │     └─ 上游具体导入源：Dattebayo、Naruto Wiki、史料文本等
│  ├─ 053 原始来源专业资料层
│  │     ├─ lore_sections：人物传记/组织史/生活/力量完整文字
│  │     ├─ chronicle + subjects：全时期事件及多对象共用编年史
│  │     ├─ claims：有出处、时间范围的实际世界事实/争议/推断
│  │     ├─ organization_profiles：组织结构与职责/治理/内部生活
│  │     ├─ capability_profiles：现实及超凡力量的机制、成长、使用
│  │     ├─ map_edges：物理/控制/社会/信息地图
│  │     ├─ social_standings：不同评价者在各阶段的社会价格
│  │     ├─ resource_flows：生产/运输/训练/加工等真实资源流程
│  │     └─ value_appraisals：原著本来存在的高价人事物及稀缺性
│  └─ 054 source_worlds：统一的“火影世界”百科身份
│        ├─ 一个 canonical_corpus_id（如 wiki:naruto）
│        │    └─ 053 的详细世界内容和唯一原著人物身份
│        ├─ evidence_corpora（若干原始资料源）
│        └─ evidence_links（人工核实的来源对应，保留分歧）
│
├─ PROJECT REALITY｜小说项目特有的活历史
│  ├─ 原版 Canon/Lorebook/Timeline/Knowledge
│  ├─ 049 Project ↔ 多个已绑定原生母体参考
│  ├─ 050 项目源人物映射、项目时空与穿越事件
│  ├─ 051 人格锚点及选定来源字段的 Fork/Diff
│  └─ 052 同世界范围身份消歧
└─ STORY WRITEBACK｜项目实际故事写回 Project Canon
```

**原著数据库 = 独立专业维基。项目世界 = 其上连续发生的新 Reality。** 不因为写火影二战开局就删去三战、四战人物、后期能力与原著全时间线；这些是原著百科资料，而不是项目未来必然发生的事实。

## 2. 宇智波斑：为什么不是两个完整百科卡

- **统一原著百科身份**：`worldId=naruto`, `canonicalKey=character:madara`。人格原型、编年史、组织和历史关系、力量体系、社会价格与高价值内容，在这里详细记录。
- **上游证据**：`corpusId=naruto-dattebayo, sourceKey=character:<原始编号>`、`corpusId=naruto-wiki-scraper, sourceKey=wiki:<原始条目>`。这些 ID 必须从真实资料导入结果读取，**不得猜人物的原始编号**；各版本保留 raw、文字、出处及争议。
- **项目 A 中的斑**：`projectId=novel-A`、其真实人物 `canon_entity_id`，通过 `project_source_entity_links` 引用统一原著百科身份；项目的经历/关系/资产/状态变化写项目 Canon。
- **项目 B 中的斑**：同理，拥有不同的项目 Canon 人物 ID，仍共用同一份原生斑百科。
- **男主在项目 A 进入第二次忍界大战之后**：引用原著历史作切入基线；穿越后的事件只写 novel-A Reality。项目人物的 `project_character_anchors` 记录稳定性格/判断模式，不因普通剧情变化自动改人设。
- **原著后期未来**：资料库完整保留，项目没有实际发生就不是项目现实。想写斑在项目后期另有行动，可以查原著未来，不能当成绝对历史自动结算。

## 3. 完整原著知识，不等于直接相信所有来源

1. **源记录原样保存**：一个来源记录可混有漫画、动画、小说、游戏材料，不自动合并为“唯一原著事实”。
2. **统一身份必须人工确认**：数据导入后仍是多个证据记录；`source_world_evidence_links` 记录哪个源条目对应统一世界哪个人物、是否已核实、是否只是候选。不能只按同名自动归并。
3. **完整传记和结构化事实互相联动**：百科长文与同一世界 ID 的编年史、能力、组织职责、社会评价、地图及生产资源可以同时查询。具有来源的文本和源条目索引不能被精简成空四字段卡。
4. **不能反向改项目**：原著源文件更新、上游数据重导入、百科编辑不会自动覆盖项目 Canon；只有经过项目内部确认的真实 Story 事件才能写回项目。
5. **重新导入必须保留劳动成果**：`source_record_presence` 记录本次导入是否出现，旧 source ID 与已绑定的精修内容不删除。来源不再出现时从默认搜索隐藏，但仍可按原始 ID 查询，以保证项目旧关联和历史证据有效。
6. **同名来源版本身份不能漂移**：Wiki 爬取内容可能包含多个同名但不同传记的条目。后续导入即使改变行顺序，也必须以同一份原始内容继续使用原来的来源 Key；遇到有变化的内容，不能悄悄把旧版本的 Key 改指另一份传记，必须保留旧证据并建立新的待审核版本。
7. **不编造能力限制**：来源没写就未知。字段 `constraints`、`counters` 只是容器，绝不强制生成弱点、代价和普通套路。

## 4. 实际已存在的代码与接口

- 源内容：`packages/persistence/src/source-corpus-repository.ts` + `naruto-source-import.ts`
- 专业原生世界：`053-source-world-encyclopedia.ts` + `source-world-encyclopedia-repository.ts`
- 统一世界身份与多证据来源：`054-unified-source-world.ts` + `unified-source-world-repository.ts`
- Server/Browser 两端共同使用：`source-corpus-routes.ts`、`unified-source-world-routes.ts`
- 关键接口：
  - `GET /api/source-corpora/:corpusId/encyclopedia/:sourceKey` 查看原始来源的完整结构档案；
  - `POST .../sections`、`.../ability`、`.../organization` 补完整设定（要求资料说明）；
  - `POST /api/source-worlds` 创建独立原著世界及其整理版知识空间；
  - `POST /api/source-worlds/:worldId/evidence-corpora` 绑定原始来源；
  - `POST /api/source-worlds/:worldId/entities/from-evidence` 人工选定统一百科人物身份；
  - `POST /api/source-worlds/:worldId/entities/:entityKey/evidence` 核实并挂接另一来源；
  - `GET /api/source-worlds/:worldId/entities/:entityKey` 查看统一百科 + 所有原始证据版本的独立档案；
  - `POST /api/projects/:projectId/source-worlds/:worldId` 某小说引用这份百科；
  - `GET /api/projects/:projectId/source-worlds/:worldId/:entityKey` 项目内只读查母体百科。

> **这里的 053/054 是第一批专业知识库能力，不表示已经把整部《火影》所有原著事实、力量关系与组织历史实际录入并校验。** Dattebayo 的 jutsu[] 只有名称和角色关系列表，不能用它自动编出完整忍术效果；Wiki 文字源可以填传记区，但仍需要去重、出处核实、版本鉴别与后续整理。

## 5. 下一步尚未完成的数据库/百科工作

- 用实际原著材料逐步建立 **完整火影统一百科** 的可复用全量人物身份，不凭名字批量合并两个资料源。
- 建立更多成熟的 **原著来源对比、出处回查、来源可信度、跨章节史事**，尤其组织的实际职权、经济生产与社会网络。
- 将 v0.1～v0.7 的剩余世界内容专项继续关联，包括高阶的 Build、生态、NPC长期目标及世界时间；原生百科同样要有，不能只在项目层实现。
- **Reality Checkout** 仍不完整：按明确世界时间、地点、历史分支对项目有效事实、关系和资产的全量恢复，与原著百科持续存储是不同任务。
- 对历史或都市年代资料使用**同一套源世界结构**，力量体系应是资本、身份、制度、军政、专业资格，不应因无超凡就删掉力量和阶梯。
- 最后以真实材料覆盖率、可追溯质量、读写回访验收；结构单测通过不等于世界资料内容已经制作完成。
