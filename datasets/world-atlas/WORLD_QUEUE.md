# 模块二 · 源世界母体库（World Atlas）持续填充总账

基于 `datasets/newbook-rankings/newbooks.jsonl`（272 本真实新书：番茄 190 + 起点 73 + 刺猬猫 9）的热门底盘统计，采用**「ChatGPT Web `@GitHub` 双窗口并行直写独立分支 → 本地拉取验收入库」**方式，已完成第一阶段「先广度打底」目标。

## 当前本地 SQLite 实测总览（2026-11-25）

- **完整母体世界总数**：**14 个**
- **高密度世界对象卡总数**：**243 张**
- **双向语义关系总数**：**1,177 条**
- **配套全局 M03 创意素材库**：**5,519 张**（已建中文 trigram FTS5 索引）

| # | worldId | 世界名称 | 类型 | GitHub 分支 | 卡片数 | 双向关系 | 状态 |
| :--- | :--- | :--- | :--- | :--- | ---: | ---: | :--- |
| 1 | `naruto` | 火影忍者（完整母体世界） | `fictional` | `feat/inspiration-chain-packs` | 75 | 416 | ✅ 基础已厚，可继续深挖至 150+ |
| 2 | `one-piece` | 海贼王（完整母体世界） | `fictional` | `data/atlas-one-piece` | 24 | 106 | ✅ B01+B02 已入库，待 B03 力量/科技 |
| 3 | `era-1980s-1990s` | 中国八九十年代（改革开放母体世界） | `historical` | `data/atlas-1980s-1990s` | 12 | 47 | ✅ B01 底盘已打好 |
| 4 | `ming-dynasty` | 大明王朝（完整母体世界） | `historical` | `data/atlas-ming-dynasty` | 12 | 37 | ✅ B01 底盘已打好 |
| 5 | `tang-dynasty` | 大唐王朝（完整母体世界） | `historical` | `data/atlas-tang-dynasty` | 12 | 40 | ✅ B01 底盘已打好 |
| 6 | `hongkong-1980s-1990s` | 八九十年代港综与港诡（完整母体世界） | `era` | `data/atlas-hongkong-80s-90s` | 12 | 40 | ✅ B01 底盘已打好 |
| 7 | `era-1950s-1960s` | 建国初期与四合院年代（1948-1965母体世界） | `era` | `data/atlas-1950s-1960s` | 12 | 60 | ✅ B01 底盘已打好（0 悬空） |
| 8 | `three-kingdoms` | 汉末三国（完整母体世界） | `historical` | `data/atlas-three-kingdoms` | 12 | 60 | ✅ B01 底盘已打好（0 悬空） |
| 9 | `journey-to-the-west` | 西游神话（完整母体世界） | `fictional` | `data/atlas-journey-west` | 12 | 60 | ✅ B01 底盘已打好（0 悬空） |
| 10 | `marvel-universe` | 美漫漫威与变种人（完整母体世界） | `fictional` | `data/atlas-marvel` | 12 | 60 | ✅ B01 底盘已打好（0 悬空） |
| 11 | `cyberpunk-2077` | 赛博朋克2077·夜之城（完整母体世界） | `fictional` | `data/atlas-cyberpunk-2077` | 12 | 63 | ✅ B01 底盘已打好（0 悬空） |
| 12 | `dayong-martial-arts` | 大雍武道王朝（高武极道母体世界） | `fictional` | `data/atlas-dayong-martial` | 12 | 60 | ✅ B01 底盘已打好（0 悬空 · 讲师案例靶子） |
| 13 | `republic-china-war` | 民国与抗战时代（1924-1945母体世界） | `historical` | `data/atlas-republic-war` | 12 | 68 | ✅ B01 底盘已打好（0 悬空） |
| 14 | `mortal-cultivation` | 凡人修仙传（人界完整母体世界） | `fictional` | `data/atlas-mortal-cultivation` | 12 | 60 | ✅ B01 底盘已打好（0 悬空） |

---

## 下一阶段候选队列（继续扩广度 or 选世界做厚）

### 可继续扩充广度的常见世界（每世界 12 张基础骨架）
- **历史朝代**：`song-dynasty`（大宋仁宗/徽宗朝）、`qin-han-dynasty`（大秦/西汉）、`qing-honglou`（清中叶与红楼世家底盘）
- **热门同人**：`bleach`（死神尸魂界/虚圈，补齐死火海）、`harry-potter`（哈利波特魔法界）、`douluo`（斗罗大陆）、`lord-of-mysteries`（诡秘之主）、`star-rail`（崩坏：星穹铁道）、`peoples-name`（人民的名义·汉东官场）
- **现代/都市通用**：`modern-urban-china`（当代中国都市/职场/资本/娱乐圈底盘）

### 生产与入库命令
```bash
npx tsx scripts/import-world-atlas.ts --dir datasets/world-atlas/<worldId>
```
