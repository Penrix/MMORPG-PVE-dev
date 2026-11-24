# 火影原作母体｜Raw Evidence 导入 + Unified Source World Atlas 安装

> **STATUS: LIVE IMPLEMENTATION / NARUTO VERTICAL.** 本文记录火影 Raw Source Corpus 导入、统一 `naruto` Source World Atlas 安装与局部 Zone 审计。语义与权限边界服从 28，Atlas 存储服从 13～15，World Builder 生产服从 16。

> 当前工作分支：`feat/module3-world-atlas-integration`。**Raw 数据量不等于 World Design 完成度。**
>
> `npm run import:naruto` 现在执行两层动作：先导入 Dattebayo / Wiki Raw Evidence，再建立统一 `naruto` Source World（canonical corpus=`wiki:naruto`）。首次安装会把 Dattebayo 的稳定记录投影成可编辑 Atlas Card + typed relations + evidence mapping，并写入世界级 Cognitive Mother；以后重跑只补新缺口，**不会覆盖作者已经人工深化的卡片或 Cognitive Mother**。Wiki 长传记仍作为 supporting evidence 单独保留，不按同名自动合并。
>
> GitHub 仓库不会自动改变作者电脑上的 `narralume.sqlite`；需在安装 NarraLume 的本地环境执行一次导入命令。原作资料本体不随公开仓库提交。

## 为什么这样放

```text
               同一份 NarraLume SQLite
                           │
   ┌───────────────────────┼──────────────────────┐
   │                       │                      │
 原生母体资料            Project Canon        Novel Studio
 source_corpora           单书 Reality         大纲/正文/结算
 source_records           现有原生表
 source_relations          世界档案专项表
 project_source_bindings    │
   │                       ▲
   └─只读参考/可查询───────┘
      **不会自动写入**
```

- 火影原著全时期资料（包含某角色将来的命运）属于 **Source Reference**。人物存在于资料库不等于开书时已出生，更不等于项目事实。
- 一个项目可以绑定多个原生母体。未来由同一男主从火影前往海贼、返回火影、楼兰龙脉前往过去，仍然由同一项目 Canon 和同一个男主 ID 管理。
- 源档案的全文 `raw_json` 原样保留，人物、村子、组织、能力等则按 `source_relations` 建立来源关系；这些不是自动给角色的能力、身份和资产。
- 不另建 SQLite 文件，不把全部原作资料误塞进 `canon_entities`，不创造“某时点自动拥有未来忍术”的错误。

## 实际导入的来源（GitHub 运行时下载）

1. [viniciusschuelter/dattebayo-api](https://github.com/viniciusschuelter/dattebayo-api)，固定上游提交 `a3871a6c931cd1f503af0bc16c80007c3a9ecda9`。导入其 `src/data/` 下：`characters`、`clans`、`villages`、`teams`、`kekkei-genkai`、`tailed-beasts`、`akatsuki`、`kara` 八个 JSON，另从角色资料中的 `jutsu[]` 建立忍术检索实体及来源边。
2. [simon8800/naruto-wiki-scraper](https://github.com/simon8800/naruto-wiki-scraper)，固定上游提交 `99ee5a0ff082e7c79540e0ad17b8f308ea965803`。导入 `cleanCharacters.json` 的完整人物文本。保留不同来源之间的资料，不擅自合并矛盾身份。

**不是官方《火影忍者》资料书的完整数字化版本。** 这些开源仓库的原作内容可能混有漫画/动画/小说/游戏来源、旧设定、网页采集错误和重复氏族，使用时应保留 `sourceUrl` 与原始字段。上游源码许可证不自动授权重新发布动漫设定内容。公开仓库仅包含数据读取代码和极小的虚构测试数据。

## 一次性导入命令

在 MMORPG-PVE-dev 本地目录执行：

```bash
npm install
npm run build
npm run import:naruto -- --project <已经存在的小说projectId>
```

数据库默认路径为 `./data/narralume.sqlite`，也可指定：

```bash
npm run import:naruto -- --db "D:/NarraLume/data/narralume.sqlite" --project <projectId>
```

若先只建立共享素材、不指定小说，也可以直接：

```bash
npm run import:naruto
```

导入后，调用绑定 API 将某本小说与原作母体关联；不会复制原作事实进入这本小说 Canon。下载前程序解析数据，数据写入采用 SQLite 事务；重复执行幂等更新，不会修改已有小说事实。

离线模式：将八个 Dattebayo JSON 放到同一目录，另放 `cleanCharacters.json`：

```bash
npm run import:naruto -- --offline ./downloads/naruto --project <projectId>
```

不需要 Wiki 补充档案时可加 `--skip-wiki`。

## 统一 Naruto Source World 的实际形状

```text
Dattebayo structured records ─┐
                              ├─ Raw Evidence（永远保留 provenance）
Naruto Wiki long biographies ─┘
              │
              ▼
        installNarutoSourceWorld
              │
              ├─ Source World: naruto
              ├─ canonical corpus: wiki:naruto
              ├─ Card Markdown = 可编辑内容真相
              ├─ typed source_relations = 可重建索引
              ├─ evidence mapping = 原料取证链
              └─ Cognitive Mother = Reader-side 预装世界语法
```

首次自动铺底解决的是“**让原料成为一个可查询的母体世界**”，不是凭空补齐全部世界运行内容。Dattebayo 能稳定提供大量 People / Village / Clan / Team / Kekkei / Jutsu 关系，但经济、当前事务、社会价格、准入权限、信息流、可玩取得路径等 Family 仍可能为空或很薄。它们应由 Module 1 在具体 Zone 内发现缺口并继续生产，不能从百科数量反推“世界已完成”。

对具体局部做只读验收：

```bash
npm run audit:naruto -- --focus Konohagakure
npm run audit:naruto -- --focus Sharingan
```

审计输出当前局部图的对象/关系数量、十 World Family 覆盖、People-centered 连通度以及下一项建议 Workshop。**focus 足够厚时只沿局部关系展开，不再用全库随机卡补满上下文。**

## 2026-11-24 Naruto Vertical｜真实母体 + 木叶 Zone 验收

真实 Actions 纵向运行已完成一轮可复现验收：Raw Evidence → Unified Source World → Konoha 局部图 → 十 Family Audit。代表性成功运行：[`45432452445`](https://github.com/Penrix/MMORPG-PVE-dev/actions/runs/45432452445)。

统一母体的真实落库结果：

| 层                                     |  实际结果 |
| -------------------------------------- | --------: |
| Dattebayo Raw Source records           |     3,371 |
| Wiki 唯一长档案                        |     1,255 |
| `wiki:naruto` canonical Atlas cards    | **3,371** |
| canonical typed relations              | **4,779** |
| exact evidence mappings                | **3,371** |
| Project Canon 自动写入                 |     **0** |
| 首次安装后再次导入新增 canonical cards |     **0** |

Reader-side 语义不再靠全文搜索猜身份。对象级种子通过 **exact name/key + card kind** 解析，真实数据已命中：

- `village:16` / Konohagakure
- `clan:45` / Uchiha
- `kekkei:29` / Sharingan
- `org:akatsuki` / Akatsuki
- `beast:711` / Kurama

这次真实数据还撞出并修复了一个 Module 2 底座 Bug：typed-link parser 原先会把 relation identifier 中的 `_` 当 Markdown 强调符删除，例如 `village_affiliation_recorded` 会变成 `villageaffiliationrecorded`。现在机器关系标识保留原样，并有回归测试。

### Konohagakure 第一轮局部图

精确锁定 `Konohagakure` 后，从该 Source 对象沿人物中心关系展开一跳/二跳，而不是拿全文命中或全库随机卡填上下文。真实审计得到：

- 65 个局部对象
- 75 条局部 typed relations
- 34 个 character
- 12 个 organization
- 17 个 ability
- 2 个 location
- 31 个非人物世界对象已经连接到具体人物
- orphan world objects = 0
- current activities = 0
- playable interactions = 0

十 Family 当前结果：

| Family       | 状态        | 当前含义                                       |
| ------------ | ----------- | ---------------------------------------------- |
| PEOPLE       | present     | 已有人物并进入关系网                           |
| SPACE        | present     | 木叶及相邻地点已接到人物关系                   |
| ORGANIZATION | present     | 组织已通过人物/地区运行                        |
| POWER        | present     | 忍术/血继等力量已连接人物                      |
| ASSET        | **missing** | 没有可占有、交换、争夺的具体资产               |
| ECONOMY      | **missing** | 没有生产、运输、交易、消费网络                 |
| ACTIVITY     | **missing** | 没有指定时点正在推进的真实事务                 |
| INFORMATION  | **missing** | 缺谁知道、隐瞒、传播、误判什么                 |
| VALUE        | **missing** | 缺世界内部社会价格，不是 Reader price          |
| PLAYABLE     | **thin**    | 有关系图，但缺明确进入/取得/学习/经营/争夺动作 |

当前审计给出的第一项 `nextWorkshop` 是 **`events`**，原因是“世界中没有当前正在推进的事务”。

这不是让系统立刻凭空造一堆“当前事件”。现有 Raw Source 是**全时代混合参考**，因此下一轮生产必须先给具体时间切片，例如“三战时期木叶”；不能把不同年代人物同时当作 Current。全时代母体负责保留可追溯对象与历史惯性，具体时点的 Activity / Value / Access / Information / Economy 再由 Module 1 在该时间切片内生产并经过 Source draft → review → adopt。

## 2026-11-24 Third War Konoha｜第一个时间切片可运行 Zone

在全时代 Konohagakure 审计暴露 `ACTIVITY / ASSET / ECONOMY / INFORMATION / VALUE / PLAYABLE` 缺口后，没有继续向全时代木叶硬填内容，而是建立第一个显式时间切片：

```text
slice:konoha-third-war-kannabi
= 第三次忍界大战｜木叶·神无毗桥任务窗口
worldTime = 第三次忍界大战｜神无毗桥作战阶段
```

显式安装：

```bash
npm run seed:naruto-third-war-konoha -- --db ./data/narralume.sqlite
npm run audit:naruto -- \
  --focus "第三次忍界大战｜木叶·神无毗桥任务窗口" \
  --world-time "第三次忍界大战｜神无毗桥作战阶段"
```

### 时间切片不是第二个火影世界

`slice:*` 是 Original Mother 内部的**指定时点局部视图锚点**：

```text
Naruto Original Mother（全时代资料）
                │
                ├─ Konohagakure / all-era reference
                │
                └─ slice:konoha-third-war-kannabi
                         │
                         ├─ 只显式纳入本时点对象
                         ├─ 只读取本时点确认/整理出的关系
                         └─ 不沿木叶全时代关系做通用二跳
```

因此即使母体数据库里同时存在后世人物、后期忍术或未来组织状态，三战 slice 也不会因为“都和木叶有关”而自动拉进当前视图。这个隔离已经有回归测试：全时代木叶存在未来人物时，三战 slice 未显式纳入该人物，就不会进入切片投影。

### Source-backed fact 与 World Builder inference 分权

这一批没有把所有补充都冒充 Source Canon。

| 内容 | Authority | 处理 |
| --- | --- | --- |
| Team Minato / Minato / Kakashi / Obito / Rin 等既有身份 | Source reference | 复用原 canonical Source key，不复制身份 |
| 木叶 / 岩隐 / 草隐 | Source reference | 复用既有地点 |
| 神无毗桥、岩隐补给线、Team Minato 破坏补给线任务 | source-backed curated view | 将既有事实结构化为 location / resource / activity / information |
| Minato 交给 Kakashi 的特殊苦无 | source-backed curated view | 结构化为本时点具体 asset，并接入持有人 |
| Kakashi 在该窗口可用的 Chidori | source-backed current slice | 只显式纳入该时点已确认能力，不继承人物全生命周期 `jutsu[]` |
| `Konoha Third-War Mission Assignment` | **inference** | 只把“木叶确实向 Team Minato 下达了这一任务”抽象成最低限度任务分派接口；不编薪酬、任务等级、完整审批制度 |
| `Kannabi Bridge Mission Assignment` | **inference** | 将“被正式纳入本任务”结构化成临时 permission；明确不声称原作存在同名行政职位 |

这里的原则是：

> **原作已发生的事实可以被结构化；为了让世界可查询、可进入而补出的机制只能保持 inference，除非以后找到直接证据。**

### 从静态资料到可运行 Zone 的三次 AUDIT 回路

真实全量数据不是一次“补齐十格”。它实际按缺口推进：

```text
第一轮
ACTIVITY / ASSET / ECONOMY / INFORMATION / VALUE 缺失
PLAYABLE thin
        ↓
建立神无毗桥时间切片
        ↓
Activity / Economy / Information / Value 出现
Asset 因未进入 slice view 仍 thin
        ↓
把 Kakashi 当期特殊苦无显式纳入
        ↓
Asset present
Power missing
        ↓
只纳入当期 Chidori
        ↓
Power present
Playable thin
        ↓
把已存在的“任务被下达”事实抽象为 inference 级任务分派入口
        ↓
Playable present
        ↓
nextWorkshop = null
```

最终真实 Actions 运行 `45440341412` 在固定上游数据上 **success**。最终切片投影为：

| 项目 | 实际结果 |
| --- | ---: |
| nodes | **17** |
| typed links | **53** |
| ongoing activities | **1** |
| executable interactions | **1** |
| character | 4 |
| location | 4 |
| organization | 1 |
| ability | 1 |
| item | 1 |
| resource | 1 |
| information | 1 |
| event | 1 |
| institution | 1 |
| position | 1 |

十个 World Family 最终全部为 `present`：

```text
PEOPLE        present
SPACE         present
ORGANIZATION  present
POWER         present
ASSET         present
ECONOMY       present
ACTIVITY      present
INFORMATION   present
VALUE         present
PLAYABLE      present

nextWorkshop = null
nextReason   = null
```

这只表示**“神无毗桥任务窗口”这一块局部世界已经达到当前 World Builder 的最小可运行标准**，绝不表示“火影世界设计完成”或“三战木叶全部完成”。

这个切片第一次证明了当前 Module 1 → Module 2 链路可以把：

```text
全时代母体百科
   ↓
指定时间位置
   ↓
当前人物 / 地点 / 力量
   ↓
正在发生的事务
   ↓
真实资产与物流
   ↓
知情关系与世界价格
   ↓
权限与进入路径
   ↓
一个可供小说进入的局部 World Zone
```

连续落进同一个 Source World，而不污染 Project Reality，也不借未来资料偷渡当前状态。

## 读取与检索

- `GET /api/source-corpora`：全部已安装原生母体与数量。
- `GET /api/projects/:projectId/source-corpora`：本小说已绑定的母体 corpus。CLI 使用 `--project` 时绑定统一 `wiki:naruto`，Raw Dattebayo/Wiki 通过 Atlas evidence dossier 追溯，不再重复挂给小说。
- `POST /api/projects/:projectId/source-corpora/:corpusId`：`{"enabled":true}`，绑定已有来源。
- `GET /api/projects/:projectId/source-reference?q=Itachi&kind=character`：跨本项目已绑定母体检索。
- `GET /api/projects/:projectId/source-reference/naruto-dattebayo/character%3A1293`：人物完整原始字段及关联组织、能力、村子、队伍的来源边。
- 浏览器内核与 Server 端注册同一组原生 RouteApp API。

## 2026-11-20 真实 GitHub Actions 全量导入验收

[真实导入 smoke 运行记录](https://github.com/Penrix/MMORPG-PVE-dev/actions/runs/44756997606) **success**。此流程确实下载上游指定提交的全部 JSON，运行本仓库安装脚本，创建临时 NarraLume SQLite，并再次完整导入检查幂等性，不是 Mock。

| 已落库原著素材                          |                    条数 |
| --------------------------------------- | ----------------------: |
| Dattebayo 原始人物                      |                   1,431 |
| 忍族 / 忍村 / 队伍 / 血继 / 尾兽        | 58 / 39 / 191 / 39 / 10 |
| 从原始角色资料提取的可检索忍术名        |                   1,601 |
| Dattebayo 原著母体总实体                |               **3,371** |
| Wiki 人物档案源行                       |                   1,347 |
| Wiki 唯一人物档案                       |               **1,255** |
| Wiki 精确重复源行（原始上游就有）       |                  **92** |
| 可查询的不同来源关系边                  |               **4,779** |
| 被自动写入某本小说 Project Canon 的实体 |                   **0** |

重复人物源行中目前确认 92 条为完全相同的重复抓取，导入器对其只保留一份；**同名但内容不同的资料绝不静默丢弃**，用 `#2` 等稳定键分别保留。原著完整来源和小说 Reality 是两件事，以上数据只显示 _Source Reference 已入本地样本数据库_，不是说某个用户 PC 的实际 SQLite 文件已被远程修改。

## 已知边界

- 这个导入器**不会**自动推断人物出生年份、忍术习得时期、真实派系、忍族资产或当期社会关系；这些内容在上游数据里也不完整。
- `akatsuki.json` 和 `kara.json` 是特殊角色列表，存在并非真正成员的记录。故仅写 `listed_in_specialty_dataset`，**不冒充“晓组织成员”**。
- 人物 `jutsu[]` 中明显网页污染条目会跳过建立实体，但原始字段完整保留。能力检索边是来源声明，不是能力在任何时期都可用的确认事实。
- 新小说的 Project Reality 仍依靠 NarraLume 原有第二模块及未来 World Builder 处理，不以加载一份资料推定所有现实已经存在。
- 统一 Atlas 的首次铺底仍主要继承上游能明确提供的身份和关系。**时间切片、经济/资源流、当前 Activity、社会价格、准入权限、信息网络与 Playable Content 不能因数据库里已有 3,000+ 卡就假定完成**；这些正是具体 Zone 的 World Builder 后续工作。
- Raw Wiki 同名人物不会自动并入 canonical identity。当前自动映射只使用 Dattebayo 稳定 source key 的一对一 projection；其他证据必须显式核验/映射。
- Source World 是可复用母体，Project Reality 仍是单书当前唯一事实。任何 Source 安装/深化都不得自动写入 Project Canon。

## 验收动作

```bash
npm run typecheck
npm test -- naruto-source-import
```

测试验证：关系与全文不丢、同一个项目可引用多个来源、第二个小说不串资料、重复导入不增重复人物、源事实不会无审核自动成为本书 Canon，以及“晓组织人物列表”不被误当成员关系。
