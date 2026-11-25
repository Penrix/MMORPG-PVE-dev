# 第二模块｜对象空间 + 算子空间：World Objects × Creative Materials × Creative Operators（2026-11-23）

> **STATUS: CURRENT AUTHORITY / MODULE 2 QUERYABLE OBJECT SUBSTRATE.**
>
> 本文记录 2026-11-23 的作者纠正，并覆盖任何把 M03 素材卡继续当成 M 算法、把第二模块只理解为 World Atlas / Project Reality、或把创作素材库理解为一次性静态 Prompt 的旧表述。

## 0. 当前裁决

第二模块不是只回答“现在什么是真的”。

第二模块还负责保存、编辑、增长、索引和查询**写作时可以拿来思考的对象**。

当前至少有两类对象空间，加一类与素材库同级、但性质不同的算子空间：

```text
Module 2｜Queryable Object Substrate

A. World Object Space
   Source World / World Atlas
   +
   Project Reality
   +
   People / Organization / Power / Asset / Activity ...

B. Creative Material Space
   M03 component/material library
   +
   future reusable creative-material libraries
   +
   BRG / MOVE / SIT / REV / SEQ / ARCH / REL / DLG / PLAY / CP / ...

C. Creative Operator Space
   M01A / M02 / M03历史算法 / M04 / M05 / M06 / M07 / M08 / M09 / M10
   + TR02仍有效的矩阵、开放联想、反惰性、热插拔、猎场、跳跃等算子

两类对象空间与算子空间都可以持续新增、修正、退役、重新索引和扩容。
对象给创作提供“拿什么想”，算子提供“怎么想”。它们同属第二模块可调用资源层，但真值和执行语义完全不同。
```

最短定义：

- **World Object**：这本书的世界里有什么、现在什么是真的、哪些母体 reference 可以查。
- **Creative Material**：成功创作中已经采到哪些可复用的桥段、人物母型、动作、关系、套路、反转、台词、玩法等创意对象。
- **Creative Operator / M Algorithm**：面对这些对象时，模型可以按需调用的搜索、迁移、组合、回返、变奏或压力测试算子。

对象与算法必须分开；素材库与算子库同级，但不是同一种东西。

**唯一特殊项是 M01B：它不是第二模块按需调用的算子，而是第三模块 Story Director 内嵌的常驻“三意识”运行状态。**

## 1. 为什么 M03 会同时留下“算法”和“素材库”的历史名称

第四代早期只有 M01 / M02 等创意算法。后来发现模型即使有“怎么想”的算法，如果没有足够厚的具体对象，仍会自由联想、套熟悉套路、产出空泛内容。

TR02 被引入时，本身同时包含：

1. 一套创意生成 / 检索 / 组合的算法思想；
2. 一套内置成熟组件数据库。

因此它进入第四代后曾被称为 M03 算法模块。

之后内置数据库持续扩大、拆书、提炼、精修，逐渐获得了独立基础设施地位。今天的 `database/m03` 已经主要承担**大型创作素材库**职责。

所以不能把演化史粗暴切成“从来没有 M03 算法”，也不能反过来把今天的每张 M03 卡都当成一种算法。

当前工程只做这个边界：

```text
TR02 / M03 的历史算法思想
→ 保留，未来与其他 M 系列一起重新研究
→ 当前不在本轮展开

M03 当前素材库
→ 进入 Module 2 Creative Material Space
→ 作为可持续增长、可查询的创意对象库
```

## 2. 本轮发现并修正的工程错误

错误链：

```text
database/m03/curated_index.jsonl
        ↓
creative-method-catalog.ts
source_type = creative_method
        ↓
CreativeMethodRetrievalService
        ↓
CreativeMethodInvocation
```

这等于把：

- 一张 MOVE 卡；
- 一张 BRG 卡；
- 一张 ARCH 卡；
- 一张 DLG 卡；

都解释成“一种创作算法”。

这是错误的。

正确链：

```text
Module 2 Creative Material Library
database/m03/...
        ↓
source_type = creative_material
        ↓
CreativeMaterialRetrievalService
        ↓
CreativeMaterialSelection[]
        │
        ├─ libraryId = M03
        ├─ materialId = MOVE-xxxx / BRG-xxxx / ...
        ├─ materialType = 开放字符串，不锁死现有分类
        ├─ sourceRef / status / summary / content
        └─ inputObjectIds = 本次拿它去碰撞哪些 World Objects

Module 3
        ↓
CreativeMethodInvocation[]
= 真正的 M 算法调用

CreativeMaterialSelection[]
= 从第二模块选中的创意对象
```

## 3. 两类对象空间为什么同属第二模块

共同点不是“数据长得一样”，而是它们都承担：

> **给写作提供可查询、可指认、可持续积累的想象对象。**

### World Object Space

提供：

- 人；
- 地点；
- 组织；
- 能力；
- 资源；
- 资产；
- 关系；
- 当前事务；
- 原著 / 历史 reference；
- Project Reality。

它回答：

> 这本书当前具体可以对谁、对什么东西编剧？

### Creative Material Space

提供：

- 桥段；
- 动作套路；
- 局面；
- 反转；
- 连环结构；
- 人物母型；
- 关系演法；
- 台词 / 声音；
- PLAY；
- Reader 情绪 / CP；
- 未来继续采集的新材料类型。

它回答：

> 面对这些世界对象，有哪些成熟创作形状可以拿来碰撞、迁移、变奏、组合或反推？

因此一次创作可以是：

```text
World Objects
木叶医院 / 秀信 / 医疗忍者 / 任务体系 / 基础忍术
          ×
Creative Materials
MOVE / BRG / ARCH / REV / PLAY / ...
          ×
Creative Methods
M01 / M02 / future M algorithms
          ↓
Story Director
          ↓
具体人物下注、行动、反应、关系变化与收益
```

## 4. 两类数据库都必须是活的

禁止把数据库理解为“项目初始化时导入一次，以后不动”。

### World Atlas / Reality 会变

- Source World 卡片可以继续补资料、修正、增关系、增来源；
- Project Reality 随正文 Settlement 持续产生新事实；
- 人物状态、关系、资产、地点、知识和事件不断变化。

### Creative Material Library 也会变

- 新书继续拆；
- 新作者继续采；
- 新类型继续出现；
- 旧卡继续精修；
- Candidate 可以 Active；
- Active 可以 Merged / Retired；
- 原卡内容可以在有新证据时修正；
- 索引可以随库增量重建。

所以 Runtime 合同不能：

- 写死 M03 当前卡数；
- 写死当前全部 material type；
- 把素材复制成一次性 system prompt；
- 假定导入后永久不更新；
- 把 SQLite retrieval index 当成素材内容唯一真相。

当前策略：

```text
外部权威 Markdown / index
        ↓ 可重复 import / upsert
NarraLume text_segments
source_type = creative_material
        ↓
FTS / embedding / rerank
        ↓
Module 2 material query
```

SQLite 索引可重建，外部素材正文仍可持续演化。

## 5. 与 Project Reality 的硬边界

“同属第二模块”不等于“同一种真值”。

```text
World Atlas Source Reference
= reference

Project Reality
= confirmed project truth

Creative Material
= reusable creative reference

Creative Method Result
= speculative candidate
```

一张 BRG 或 MOVE 卡永远不能因为被检索到就变成：

- 木叶真实发生过的历史；
- 当前人物真实拥有的关系；
- 当前角色已知信息；
- 已确认 Canon。

素材只能作为**创作联想对象**。

真正故事仍必须落回当前 World Objects，并由 Story Director 编剧，最后只有正文 Settlement 可以写回 Project Reality。

## 6. 第三模块的正确消费接口

```text
Creative Frame
+
Protagonist Camera
+
StoryObjectField                 ← Module 2 World Object Space
+
CreativeMaterialSelection[]      ← Module 2 Creative Material Space
+
CreativeMethodInvocation[]       ← Module 2 Creative Operator Space（显式按需调用）
+
M01B always-on fronts            ← Module 3 内嵌，不进入 Invocation
        ↓
Story Director
        ↓
Stake / Node / Scene / Reader Time
```

因此：

- `StoryObjectField` 不装素材卡；
- `CreativeMaterialSelection` 不冒充世界实体；
- `CreativeMethodInvocation` 不再拿 M03 卡片 ID 当 methodId；
- 素材召回必须记录本次 `inputObjectIds`，说明它是拿来碰撞哪些世界对象的；
- 无世界锚点时仍不能靠素材库自由拼贴出一套“看起来像小说”的东西。

## 7. 当前代码 Crosswalk

已纠正：

- `creative_material` 成为素材 retrieval 的 source type；
- 新增 `CreativeMaterialSelection`；
- 新增 `CreativeMaterialRetrievalService`；
- `StoryCreativeContext` 分成 `methodInvocations[]` 与 `materialSelections[]`；
- M03 导入命令改为 `import:creative-materials`；
- 旧 `creative-method-*` 仅留兼容壳，不再产生 `creative_method` 语义；
- 素材类型使用开放字符串，未来新增类型不要求 Story schema 升级；
- 导入采用可重复 upsert，库可以持续增长和修改。

本轮没有做：

- 不重新裁决 TR02 各历史版本算法；
- 不决定未来完整 M01～M10 Runtime Router；
- 不把 M03 的 5,519 张底稿复制进公开 dev 仓；
- 不让第三模块直接修改素材库；
- 不把 Creative Material 与 Source World Card 强行塞进同一 Card schema。

## 8. 防重犯

看到“素材库”时，不要自动理解成静态 prompt。

看到“M03”时，先区分：

```text
是在说 TR02 / M03 历史算法思想？
还是在说今天已经长成大型数据库的 M03 素材库？
```

看到“第二模块”时，不要只想到：

```text
World Atlas + Project Reality
```

当前应恢复为：

```text
Module 2
= World Object Space
+ Creative Material Space
+ Creative Operator Space
+ Project Reality truth boundary
+ Query / Retrieval / Invocation infrastructure
```

最终目标不是让模型记住更多名词，而是让创作时真正能拿到足够厚的**世界对象**和**创意对象**，再由算法和 Story Director 对它们进行推演。

### 8.1 防止把“内容缺口”误判成“架构缺口”

2026-11-25 在增厚 One Piece / Hunter x Hunter 时暴露了一条新的错误路径：

```text
某个 Family 的内容还很薄
→ 发现现有导入器只拿到了人物 / ability / 若干关系
→ 误以为第二模块缺少一个新的专用子系统
→ 条件反射提出 Power System Graph / Character Build Database
→ 实际上重复发明已有 World Atlas 能力
```

这不是“忘了某个名词”，而是**没有先恢复第二模块的既有结构，就从局部任务重新发明架构**。

今后遇到力量、经济、职业、装备、组织、信息、社会权限等任何局部内容不足时，必须先按下面顺序判断：

```text
1. 这是新的世界对象类型，还是现有 Ten Families 里的内容还没填厚？
        ↓
2. 现有 WorldAtlasCardKind 能不能表达？
        ↓
3. 现有 Card + Typed Relation 能不能把它与人物、组织、地点、事件等连接？
        ↓
4. People-centered Query 能不能从人物中心把这些对象重新组装出来？
        ↓
5. 只有上述结构确实无法表达时，才讨论扩 schema / 新 subsystem。
```

默认裁决：

> **先补内容与关系，后谈扩架构。局部资料薄，不能自动推出底座缺一层。**

以力量体系为例，正确理解不是再建一套独立 Power Database，而是把现有 World Object Graph 中的 POWER Family 填厚：

- `rule`：力量的公共规则、原理、阶段、成立条件；
- `ability`：具体能力、技能、招式、境界表现；
- `technology`：研究、制造、工程与技术路线；
- `item/resource`：恶魔果实、斩魄刀、秘卷、特殊资源等载体；
- `character`：具体人物实际掌握、使用、发展到什么状态；
- `organization`：谁教授、控制、垄断、研究这些力量；
- `event/activity`：何时学会、觉醒、突破、训练、研究或失去；
- Typed Relations：`掌握 / 使用 / 传授 / 前置 / 组合 / 克制 / 依赖 / 来源 ...`。

所谓“人物 Build”也不是新的数据库实体，而是 **People-centered View**：

```text
Character
  + POWER
  + ASSET
  + ORGANIZATION
  + ACTIVITY
  + INFORMATION
  + 当前 time-slice / Project Reality
→ 查询时动态组装出的具体人物状态
```

因此 One Piece / Hunter x Hunter 当前真正的问题是 **Adapter / Normalizer 仍偏百科导入，尚未充分投影原著中的力量规则、力量内容与人物实例之间的关系**，不是 Module 2 缺少 Power subsystem。

这条规则适用于所有 World Family，防止以后把“经济内容薄”误判成需要 Economy Database、把“职业内容薄”误判成需要 Career Database、把“装备内容薄”误判成需要 Equipment Database。

## 9. 算子不是流程

Creative Operator Space 更像工具架，不是流水线。第三模块遇到局部发散、迁移、变奏、检验问题时，点名调用一个算子，得到候选后立即回到讲师 Story Director 主线。

```text
Story Director 当前卡点
→ invoke(M02 / M04 / TR02 / ...)
→ 候选
→ 回 Story Director
```

禁止自动把所有算子排成固定顺序，也禁止让“方法路由”取得故事裁决权。

## 10. 2026-11-25｜多母体 Source World 数据库已经动态化

第二模块的 World Object Space 不再以“火影有一套专用导入器”作为默认形状。

当前正式结构是：

```text
SourceWorldCatalog
        │
        ├─ naruto
        ├─ one-piece
        ├─ bleach
        ├─ hunter-x-hunter
        └─ future worlds...
                 │
                 ▼
        Source Adapter
  上游 JSON / CSV / API / Wiki scrape
                 │
                 ▼
        Normalized Source Seed
  records + typed relations + provenance
                 │
                 ▼
        Generic Source Installer
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
Raw Evidence          Canonical Source World
source_corpora        Card + Typed Relations
source_records        Evidence Mapping
source_relations      Cognitive Mother
       │                   │
       └─────────┬─────────┘
                 ▼
          ONE NarraLume SQLite
                 │
      Project 可绑定 N 个母体
                 │
                 ▼
      Project Reality 仍完全独立
```

### 10.1 不为每个作品复制一套数据库

当前第一批 Catalog：

| Source World | Canonical Corpus       | 主导 Adapter                     |
| ------------ | ---------------------- | -------------------------------- |
| 火影忍者     | `wiki:naruto`          | 现有 specialized Naruto importer |
| 海贼王       | `wiki:one-piece`       | `one-piece-dataset-v1`           |
| 死神         | `wiki:bleach`          | `bleach-database-v1`             |
| 全职猎人     | `wiki:hunter-x-hunter` | `hxh-static-v1`                  |

新增第五、第六个母体时，默认动作应该是：

```text
找到可追溯上游
→ 固定版本 / commit
→ 写 Adapter / Normalizer
→ 输出统一 SourceWorldSeed
→ 交给 Generic Installer
```

而不是：

```text
复制 Naruto importer
→ 再造一套 OnePieceRepository
→ 再造 Bleach SQL 表
→ 每个作品各长一套孤立基础设施
```

### 10.2 Generic Installer 的 Authority 规则

`installSourceWorldSeed()` 当前执行：

1. 保存原始 Evidence corpus / record / relation；
2. 只有 Adapter 显式给出 `canonicalKey` 的记录才能投影为统一 Source World identity；
3. 同名不自动合并；
4. Evidence → Canonical identity 的映射保存 provenance；
5. 第三方社区数据即使被投影成可查询 Source card，也不升级成“官方已核实 Canon”；
6. 已被作者人工深化的 canonical Markdown card，重复导入不得覆盖；
7. 重导入采用 snapshot/upsert，不能越导越胖；
8. Source 导入绝不创建 `canon_entities`，因此不会污染任何 Project Reality。

所以：

```text
canonical Source identity
≠ 官方事实认证
≠ Project Canon
```

它只是：

> **这个 Source World 内，我们用哪个稳定对象承接一条或多条有 provenance 的外部证据。**

### 10.3 第一批真实同库验收

真实 GitHub Actions 使用固定上游版本，把四个母体安装进**同一个临时 NarraLume SQLite**，得到：

| Source World    | Canonical cards | Typed relations |
| --------------- | --------------: | --------------: |
| Naruto          |       **3,371** |       **4,779** |
| One Piece       |          **63** |          **83** |
| Bleach          |         **358** |         **899** |
| Hunter x Hunter |         **183** |         **227** |

同时确认：

- 四个 Source World 均存在各自 Cognitive Mother；
- 四个 world 使用不同 canonical corpus，但共用同一 SQLite / repository infrastructure；
- `canon_entities = 0`，没有任何 Source import 偷写 Project Canon；
- One Piece / Bleach / Hunter x Hunter 二次完整导入后，各 evidence/canonical corpus 数量不增长；
- Generic Adapter 的所有关系端点均解析成功，当前真实 smoke 的 `unresolvedRelations = 0`。

这组数字只表示**当前已安装的第一层可靠种子厚度**，不是“世界完成度”。

尤其 One Piece 当前 63 张卡只是第一批人物 / 海贼团 / 船 / listed abilities。Catalog 已登记覆盖漫画 1–1085 话的 interaction dataset 作为后续 relation enrichment 来源；应继续向同一个 `one-piece` Source World 增厚，而不是再建第二个海贼数据库。

### 10.4 上游允许异构，落库必须统一

四个世界已经证明上游可以完全不同：

```text
Naruto
→ 多组结构化 JSON + Wiki biography

One Piece
→ character / crew JSON
→ 后续可追加大规模 chapter interaction CSV

Bleach
→ Shinigami / Arrancar / Quincy / Humans 四组大型 JSON
→ Professional Status / Primary Skills

Hunter x Hunter
→ Hunters / Phantom Troupe / Chimera Ants 三组固定 JSON
→ Nen Type / Ability / Profession / Family
```

第二模块不要求这些来源先长成同一种 schema。

Adapter 的责任是把它们翻译成：

```text
World Atlas Card Kind
+
Typed Relation
+
Stable Source Key
+
Explicit Canonical Key
+
Provenance
```

然后所有世界共享同一查询、证据、关系、World Builder、time-slice 和 Project binding 能力。

### 10.5 在线 API 只能做 enrichment，不能做唯一地基

这轮真实 smoke 曾经首先把 Hunter x Hunter 建在 Jikan 在线 API 上。

结果 GitHub Actions 中 Jikan 连接超时，虽然因为 CLI 使用“**全部下载成功后才打开 SQLite**”而没有留下半安装数据库，但它暴露了一个底层原则：

> **可复用母体的 mandatory seed 必须尽量可固定版本、可重复获取；在线 SaaS/API 默认只能做 optional enrichment。**

因此 Hunter x Hunter 已改为固定 commit 的静态 GitHub 数据作为 primary seed；Jikan 保留 supporting 角色，不参与默认 `--all` 安装。

### 10.6 当前操作入口

```bash
# 查看可安装母体
npm run import:source-world -- --list

# 单独安装
npm run import:source-world -- --world one-piece
npm run import:source-world -- --world bleach
npm run import:source-world -- --world hunter-x-hunter

# 三个 generic world 一次安装
npm run import:source-world -- --all

# 安装并绑定到某个已经存在的 Project
npm run import:source-world -- --all --project <project-id>

# Naruto 继续使用更成熟的专用路径
npm run import:naruto
```

Server / Browser Kernel 的查询面同时提供：

```text
GET /api/source-worlds
= 本地已经安装的母体

GET /api/source-worlds/catalog
= 当前可安装 / 可继续富化的母体目录
  + installed
  + installedCardCount
```

因此“数据库是活的”现在不再只指单个世界内部能增加卡片，也包括：

```text
安装新母体
→ 为旧母体追加新 Evidence Corpus
→ Adapter 增强
→ 重新 import / upsert
→ 现有人工 Card 不被覆盖
→ 关系与 Evidence 索引增量更新
→ Project 随时绑定多个母体
```

这才是当前第二模块 World Object Space 的长期扩容方式。

### 10.7 2026-11-25｜POWER Family 从“能力名单”增厚为“规则 × 内容 × 人物实例”

多母体第一层种子跑通后，One Piece / Hunter x Hunter 暴露了一个内容层缺口：上游已经包含大量超凡力量资料，但早期 Adapter 主要把它们投影成 `ability` 卡，尚未充分恢复“力量基础规则 → 分支/技能 → 具体人物实例”的世界关系。

本轮**没有新增 Power subsystem、Character Build 表或任何数据库迁移**。仍然使用现有：

```text
World Atlas
├─ POWER: rule / ability / technology
├─ PEOPLE: character
├─ ASSET: item / resource
├─ ORGANIZATION
├─ ACTIVITY: event / activity
└─ Typed Relations
        ↓
People-centered Query / View
```

工程裁决：

> **力量体系是现有 World Object Graph 的内容，不是与人物分离的第二套数据库。所谓人物 Build，是从人物中心动态组装 POWER / ASSET / ORGANIZATION / ACTIVITY / time-slice / Project Reality 的查询视图。**

#### One Piece

固定上游 `7IBO/onepiece-wiki` 已提供 Devil Fruit classification 与 Haki vocabulary；Supporting `25thNight0901/OnePiece-dataset` 的核心人物 `abilities[]` 还提供了明确 Haki 人物实例。

真实导入结果：

| POWER 投影 | 数量 |
| --- | ---: |
| POWER rule objects | **16** |
| Haki branches | **6** |
| Devil Fruit classes | **8** |
| Devil Fruit → class relations | **211** |
| Character → Haki branch relations | **22** |
| shared Haki ability → branch relations | **3** |

当前关系形状已经能够表达：

```text
Monkey D. Luffy
├─ ability_listed → Armament Haki
├─ ability_listed → Observation Haki
├─ ability_listed → Conqueror's Haki
└─ haki_type_recorded
       ├─ Armament Haki ─┐
       ├─ Observation ───┼→ Haki System
       └─ Conqueror ─────┘

Gomu Gomu no Mi
├─ part_of_power_system_recorded → Devil Fruit System
└─ devil_fruit_class_recorded → classification rule
```

注意：Primary rich source 的 schema **支持** `character.haki_types`、`awakened` / `awakening_outcome`，但当前安装的真实实体数据中，这两类字段没有产生可用人物 Haki / Awakening 关系。因此：

- 人物 Haki 当前来自 pinned supporting character abilities evidence，并与 rich Haki rule identity 汇聚；
- `awakeningRelations = 0` 被保留为真实数据状态；
- 禁止因为 schema 存在就伪造“已填充”的事实。

当前 fresh real import：
- canonical cards: **4,099**
- canonical typed relations: **5,365**
- evidence relations: **5,368**
- Luffy evidence sources: **2**
- Luffy canonical outgoing relations: **14**

#### Hunter x Hunter

Pinned MindMapsAnime 的 `nen.ts + nenBatch1..3` 本身已经给出 Nen 根规则、基础四大行、高级应用、六系和人物专属 Hatsu。此前只是 Adapter 没有把这些语义恢复出来。

现在投影为：

```text
Nen System
├─ Enhancement
├─ Transmutation
├─ Emission
├─ Conjuration
├─ Manipulation
└─ Specialization
      ↑
      │ nen_category_recorded
individual Hatsu
      ↑
      │ used_by_recorded
Character

Ten / Zetsu / Ren / Hatsu
      └─ fundamental_of_recorded → Nen System

Gyo / In / En / Shu / Ko / Ken / Ryu
      └─ advanced_application_of_recorded → Nen System
```

真实导入：

| POWER 投影 | 数量 |
| --- | ---: |
| POWER rule objects | **7** |
| Nen categories | **6** |
| Hatsu → Nen category | **59** |
| fundamental → Nen system | **7** |
| advanced application → Nen system | **7** |
| ability → Nen system | **73** |

当前 fresh real import：
- canonical cards: **756**
- canonical typed relations: **2,650**
- evidence relations: **2,814**
- Gon evidence sources: **3**
- Gon canonical outgoing relations: **33**

#### 验收

真实 GitHub Actions 已验证：

- One Piece / HxH rich import 成功；
- POWER rule / branch / character-instance 关系真实存在；
- 二次完整导入 `createdCards = 0`，计数不增生；
- `Project Canon = 0`；
- Source import 继续只增厚 reusable Original Mother，不污染单书 Project Reality。

永久 CI 现在同时守住 POWER 语义，而不只检查卡片总数：如果未来 Adapter 把超凡世界重新压扁成一堆 `ability` 标签，Haki / Nen 系统节点或人物连接消失，multi-world smoke 会失败。

