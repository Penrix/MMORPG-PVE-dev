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
