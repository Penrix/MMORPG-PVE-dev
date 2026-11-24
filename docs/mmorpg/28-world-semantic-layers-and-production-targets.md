# 世界语义总入口｜原生母体 × 认知母体 × Project Reality × World Builder 双目标（2026-11-24）

> **STATUS: CURRENT AUTHORITY / WORLD SEMANTICS + MODULE 1↔2 BOUNDARY.**
>
> **无上下文窗口在阅读 13～17 之前先读本文。** 本文回答“我们到底在保存和生产什么世界”；13 回答 Source World **怎样存**，14 回答世界内容**应该有什么**，15 回答小说检索为何 **People-centered**，16 回答第一模块**怎样生产**，17 回答第三模块**怎样读取与写回**。
>
> 来源：2026-11-24 Author Correction；Library《男频语义内核 v1.3》126～135、139 及相关形成史；当前 10～17 已确认工程边界。若后续 Author Correction 改变这里，以更新裁决为准。

---

## 0. 一句话裁决

项目的世界系统不能只用“Source World + Project Reality”两个数据库名来理解。

必须先恢复三种**语义身份**：

```text
【原生母体 Original Mother】
世界本来怎样成立
= 主角介入前的 Reality / 反事实基线 / 因果惯性

【认知母体 Cognitive Mother】
目标 Reader 在打开作品以前
已经怎样理解、期待、定价这类世界
= Reader-side 预装价格 / 搜索权重 / 熟悉关系语法

【Project Reality】
这一本小说到当前时点
已经真正发生并被确认的事实
= 唯一 Current Authority
```

男主介入以后，并不是“原作世界”和“改造世界”两套 Current 同时运行。

```text
Original Mother baseline
+ Cognitive Mother prior
+ 主角 / 人物真实行动
+ Reality Writeback
        ↓
同一个 Project Reality 持续长出新历史
```

**一个项目只有一个真正被活出来的当前世界。**

---

## 1. 原生母体｜“本来是什么”

原生母体保存介入前世界怎样成立，可以包括：

- 原作完整 Canon / 客观历史；
- 现实规则、制度与物质条件；
- 人物原始身份、关系、经历；
- 组织结构、权力和资源归属；
- 力量体系、技术、资产和生产流通；
- 全时代事件与原作未来资料；
- 原作自身的因果惯性。

它的主要权限：

```text
initial baseline
counterfactual baseline
causal inertia
source reference
```

它**不是未来剧情硬轨**。

项目一旦真实改变人物、关系、资源、组织、信息、权力或时间条件，原作未来只能继续作为参考、惯性、反事实或 Reader 期待，不能覆盖 Project Reality。

---

## 2. 认知母体｜“Reader 早就把这块地当成什么”

认知母体不是 Source Canon 的另一种名字，也不是“有名人物清单”。

它回答：

> **目标 Reader 在进入正文以前，对这个 IP / 年代 / 行业 / 类型世界已经预装了什么价格、期待和关系语法？**

例如火影 Reader 通常无需重新教学就能对“木叶、宇智波、写轮眼、三忍、尾兽、晓、火影”等对象形成不同的价格和期待。

认知母体应当实际影响：

- 谁出现就天然有价；
- 什么身份一眼能懂；
- 什么能力天然带幻想；
- 谁更容易与谁发生关系；
- 哪些门槛和入口看起来自然；
- 什么资源、位置、人物当前昂贵或便宜；
- 哪些异常最容易被世界和 Reader 注意；
- 哪些历史、悲剧、名场面已经形成预期；
- 新 Reality 写回以后，旧对象怎样被重新定价。

因此：

```text
Cognitive Mother
!= 背景 Warehouse
!= 专名皮肤
!= Source objective fact
!= Cognitive Hook
```

**认知钩子**只是低成本叫醒共同记忆的触发柄；**认知母体**是 Reader 对整个世界的预装理解与价格底盘。

一个很硬的诊断：

> 把 IP / 年代 / 行业专名全部替换以后，人物遇见、价值价格、准入路径、合法行动方式和高价关系是否几乎原样不变？

如果是，说明母体很可能只提供了皮，没有真正进入生成。

---

## 3. Project Reality｜“这本书现在真正是什么”

Project Reality 是当前项目唯一确认真值。

它可以引用一个或多个原生母体，也可以跨世界、跨时代、跨地图旅行，但这些都不创建第二个 Project。

```text
Naruto Source World ─┐
One Piece Source World ─┼→ one novel Project Reality
Historical Source ──────┘
```

项目中的男主、人物、关系、能力、资产、知识和历史持续继承。

权威顺序：

```text
Project Reality Current
        >
Original Mother reference
```

同时继续区分：

```text
世界客观事实
!= 某角色知道的事实
!= Reader 已知
!= Reader 对对象的预装价格
```

---

## 4. 三层语义怎样落到当前第二模块

当前数据库物理结构**不要求为了本文立刻重构**。

### 4.1 Original Mother 的当前主要载体

```text
Source Corpus / evidence
        ↓
Source World / World Atlas
        ↓
完整 Card + Typed Relations + derived index
```

Source Atlas 是原生母体资料的主要工程载体。

### 4.2 Cognitive Mother 的当前身份

认知母体是 **Reader-side semantic layer / view**。

它可以围绕 Source World 对象保存或计算 Reader 预装价格、共同认知、熟悉入口和关系语法，但：

- 不能冒充原作客观事实；
- 不能写入 Project Canon；
- 不能把“Reader 很熟”改写成“角色知道”；
- 不要求本文立即新增独立 SQL 表。

**当前代码尚未把认知母体做成一等 Runtime 对象。** 在代码完成前，文档和数据设计必须至少保留这条语义边界，不得把它重新吞回 `value`、Source Fact 或普通标签。

### 4.3 Project Reality 的当前载体

继续使用 NarraLume 已有 Canon / Relationship / Timeline / Knowledge / Settlement 等确认链。

不要为了 World Atlas 再建立第二份项目真相。

---

## 5. 第一模块有两个合法生产目标，不是只生产 Project World

同一套 World Builder 世界设计认知，有两个不同的 **production target**。

### A｜Source World Production

用于：

- 火影、海贼、死神、咒术等已有 IP；
- 历史年代；
- 可被多本小说重复引用的公共母体；
- 原创但希望先独立建设、以后被多个项目引用的参考世界。

```text
Source evidence / existing Atlas
        ↓
World Builder
ZONE / HUMANIZE / CONNECT / ACTIVATE / PRICE / AUDIT
        ↓
candidate Source Cards / Relations / semantic annotations
        ↓
核验 / 作者采纳
        ↓
Source World Atlas
```

已有成熟母体不需要从 ROOT 重造。

导入资料可以直接成为生产输入；LLM 负责整理、补关系、补世界分辨率和发现 Gap。LLM 推断与原创补充必须显式保持 Candidate / inference 身份，不能无来源升级成 Source Canon。

### B｜Project Reality Expansion

用于具体小说已经运行以后：

- 新地图；
- 新圈层；
- 新组织；
- 世界对象分辨率不足；
- 第三模块发现 world gap。

```text
Project Reality Current
        ↓
World Builder
        ↓
candidate WorldPack / world delta
        ↓
作者采纳
        ↓
Project Reality
```

两者使用同一套十 Family、People-centered、连接/活动/价格/入口等世界生产认知。

**不同的是 Authority 与写入目标，不是另造两套世界设计理论。**

---

## 6. Source World 的正确填充流程｜导入和生成不是二选一

成熟 IP 的推荐流程：

```text
① 导入可追溯资料
   Wiki / API / GitHub dataset / 官方或可靠资料
        ↓
② 建立原始 Evidence / identity
        ↓
③ 组织为 Atlas Card + Typed Relation
        ↓
④ Module 1 按十 Family 与 People-centered 检查结构性缺口
        ↓
⑤ 对薄弱区域生产候选
   人 / 组织 / 力量 / 资产 / 活动 / 价格 / 入口
        ↓
⑥ 外部资料核验
   已证实 / 推断 / 原创扩展继续分权
        ↓
⑦ Source Atlas 缺口审计
        ├─ 仍薄 → 回 Module 1
        └─ 当前区域足够可用 → 下一 Zone
```

目标不是“百科条目数量”，而是：

> **能否从真实人物出发，沿组织、地点、能力、资产、信息、事件、价格与准入，走进一个已经存在并能持续产生故事的世界。**

---

## 7. 十个 World Family、People-centered、认知母体三者不能互相吞掉

```text
World Content Axis
= 世界有什么
= 10 World Families

People-centered Narrative Axis
= 小说检索与关系展开优先从谁发动
= 人 ↔ 人 / 人 ↔ 世界对象

Cognitive Mother
= Reader 对这块世界预装的理解、价格与期待
= Reader-side semantic layer
```

因此：

- `VALUE` 主要回答**世界内部怎样定价**，不等于 Reader 预装价格；
- People-centered 是世界对象的叙事展开优先级，不等于 Reader-side prior；
- Cognitive Mother 不取代十 Family，也不要求把数据库改成人物层级树。

---

## 8. 当前代码状态｜理论已确定，运行时尚未完全显影

截至本文建立时：

### 已经存在

- Source World / World Atlas 独立存储；
- Project Reality 独立确认链；
- World Builder 十 Family / People-centered 生产认知；
- Existing IP / history / original 共用同一世界设计框架；
- World Builder 从已有对象继续生产的内部能力；
- Project Reality → World Builder → WorldPack → Project Reality 的项目增量链。

### 尚未成为一等运行路径

- `Source World → World Builder → Source World` 的正式 production target / API；
- Cognitive Mother 的一等查询 / 表达合同；
- Source objective fact 与 Reader-side price 的显式 Runtime 分权。

**因此后续修改代码时，不得把“文档已确定”误报成“实现已完成”。**

---

## 9. 无上下文强制阅读顺序

理解世界与三模块：

```text
CURRENT.md
→ 28 本文：先恢复世界语义与 Authority
→ 13：Source World 怎样存
→ 14：一个世界应该有什么
→ 15：People-centered 怎样展开
→ 16：World Builder 怎样生产
→ 17：Module 3 怎样读取 / 写回
→ 25：Module 2 还包含 Creative Materials / Operators
→ 23 / 24 / 26 / 27：Story Director 与创作方法
```

修改 Module 1：

```text
CURRENT
→ 28
→ 14 / 15
→ 16
→ 13 / 17（确认写入边界）
→ 01 / 04 / 05 / 06 / 07（仅查实现）
```

修改 Module 2：

```text
CURRENT
→ 28
→ 13 / 14 / 15
→ 25
→ 10 / 11
→ 12（仅查历史实现）
```

---

## 10. 防重犯

以下理解一律视为走偏：

```text
Source World = 百科名词仓库
Source World = Project Reality 的只读副本
认知母体 = 原作事实
认知母体 = 有名人物清单
VALUE = Reader认知母体
已有 IP 不需要 Module 1
Module 1 只能给具体小说补世界
Module 1 生成出的 Source 候选自动成为原作事实
原作未来在 Project Reality 改变后仍自动发生
一个项目跨两个母体 = 两个 Project
```

最短恢复：

> **原生母体负责“本来是什么”，认知母体负责“Reader 早已怎样定价”，Project Reality 负责“这本书现在真正是什么”；World Builder 既能建设可复用母体，也能扩张具体项目，但二者写入 Authority 绝不能混。**
