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


## 9. 算子不是流程

Creative Operator Space 更像工具架，不是流水线。第三模块遇到局部发散、迁移、变奏、检验问题时，点名调用一个算子，得到候选后立即回到讲师 Story Director 主线。

```text
Story Director 当前卡点
→ invoke(M02 / M04 / TR02 / ...)
→ 候选
→ 回 Story Director
```

禁止自动把所有算子排成固定顺序，也禁止让“方法路由”取得故事裁决权。
