# 第一模块 WorldPack｜2026-11-20 实际代码交付记录

> 状态：**已提交源码和端到端模拟模型的测试用例；尚未通过 Node 24 构建、GitHub Actions 或真实模型内容验收。**  
> 前版“七轮单项 Canon 候选”是接口原型，不再是当前主流程。本文记录这次真正添加的内容与源码位置，避免将“设计计划”与“已实现功能”混为一谈。

## 一、真正新增的模块

| 代码                                                             | 作用                                                                                                     | 技术来源/差异                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/contracts/src/world-pack.ts`                           | 世界包 W0/W1 请求、人物/地点/组织/物品实体、关联边、独立活动、候选/采纳状态、跨包/Canon引用校验          | 参照 Covel 可携带世界包与 OnlyWorlds 关系型世界数据的思想；**不是照搬它们的原始 schema** |
| `packages/persistence/src/migrations/046-world-pack-drafts.ts`   | `world_pack_drafts` 表、项目外键、版本、请求与完整内容JSON、采纳后 Canon ID 映射                         | 新建 NarraLume SQLite 候选存储，正式世界 Reality 不存第二份                              |
| `packages/persistence/src/world-pack-repository.ts`              | 新包写入、列出、按run查找、乐观版本编辑、状态变更和映射                                                  | 复用 NarraLume 存储层与事务约束                                                          |
| `packages/harness/src/world-pack-recipe.ts`                      | `world.context → world.generate → world.stage` 三步任务                                                  | 复用 NarraLume Harness 的运行/暂停/失败恢复；**区别于旧 `canon-spread-candidate`**       |
| `packages/narrative/src/mmorpg-world-method.ts`                  | 保留旧版 v0.7 摘录作历史；当前使用 v0.1～v0.7 独立文档的版本化方法目录按对象选择原文                                                             | **实际来自用户原稿**，不再只调用模型自写简化摘要                                         |
| `packages/narrative/src/world-pack-context.ts`                   | 按当前区域、人物关系、区域隶属和社会邻接关系选择 W1 的上下文                                             | 借 WorldForge 多跳图检索思路做 TS/Canon 适配，无独立图库                                 |
| `packages/narrative/src/world-pack-workers.ts`                   | 从当前 Reality、按范围选取的 v0.1～v0.7 原文和实际 Covel 世界包构造上下文；严格输出完整连通世界包；可按需推进已存在NPC/组织      | ModelClient + Typed Graph + WorldPack；不要求先写章纲或机械重复七轮                      |
| `packages/services/src/world-pack-routes.ts`                     | 创建生成任务、列出世界包、读取、版本编辑、**整体原子性采纳**                                             | 复用 Canon 实体/事实/关系写入与锁定、事务；不新造 Canon 事实层                           |
| `packages/services/src/world-graph-routes.ts`                    | 从 Canon 事实/关系**实时投影**图，按中心实体两跳查询邻居及当前行动                                       | WorldForge graph 思路 + NarraLume 单一 Reality                                           |
| `apps/web/src/workspaces/world-builder.tsx`                      | World Builder 页面：W0/W1、生产/推进、旧区域导航、世界包内容/关系/活动审阅、JSON修订、作者确认后整体采纳 | 复用原 NarraLume React/Query/App Shell，不另接 Next.js/Tauri                             |
| `apps/web/src/lib/api.ts`                                        | WorldPack/Graph 5类API调用                                                                               | 复用 NarraLume 网络/浏览器内核                                                           |
| `apps/server/src/app.ts`、`apps/web/src/kernel/kernel-worker.ts` | 同时在 Node 服务端与浏览器本地内核注册 **WorldPack Worker、Routes 和 Graph**                             | 保留两种部署入口的同一行为                                                               |

### 底层生成闭环

```text
W0 整书世界概念 / W1具体已存在区域 / 世界自转 advance
    │
    ▼
已确认Canon Reality + 最近正文/故事状态 + v0.7原文设计方法
    │
    ▼
NarraLume原有模型运行器（新的world-pack-production配方）
    │
    ▼
一个 WorldPackDraft
    ├─ nodes: 具体人物 / 组织 / 地点 / 宝物 / 规则
    ├─ links: 所属、控制、雇佣、交易、师徒、社会进入路径
    ├─ activities: 现在ongoing / 可能potential / 已结束ended
    └─ localId / canon:<id>: 同包对象或已有Reality稳定引用
    │
    ▼
内部引用校验 → SQLite world_pack_drafts (不属于已确认世界)
    │
    ▼
作者审阅 / 编辑 / 版本校验
    │
    ▼
一次SQLite事务：
  新实体 + 每个对象的world.content事实 + 区域隶属 +
  当前关系/已结束关系 + 角色当前行动/行动结束
  └─ 当前实体版本、来源、已存在ID被继续使用
    │
    ▼
NarraLume唯一Canon Reality
    ├─ World Atlas 图查询/后续W1制作/世界自转
    └─ 原StoryStatePacketBuilder编译世界人物、价值与取得路径 → 正文
          │
          └─ 章节结算已确认的世界变化 → 原Canon → 下一轮①
```

## 二、避免把世界写坏的几个具体规则

- **不允许自动生成神秘新数据库ID**：模型生成 `localId`（如 `guild_master`），作者采纳时由程序真正分配 Canon UUID，或明确引用 `existingCanonId`。
- **不能重复创建同名实体**：新世界包同类同名会拒绝采纳，并提示重用旧ID；已存在ID的类型、名字或别名必须匹配。
- **不能把将来的可能事件写成历史事实**：`potential` 只保留在世界包；`ongoing` 写为 actor 的当前事实；`ended` 必须对应既有活动并继承旧版本。历史事件可由 NarraLume 正文结算添加。
- **不能因为另一人声称持有物品，就撤销男主或其他NPC原有产权**：新的 `owns` 关系与旧产权可以并存（比如争议/共有）；只有显式 `ended` 关系并提供新事件来源时，才终止同一主体的旧关系。
- **旧地图有归属与连续时间**：W1 可绑定现有父级地区；`world.area` 事实更新会引用旧事实版本，避免多个互相矛盾的当前地区。
- **模型不能直接修改 Canon**：只产出 `WorldPackDraft`；有作者确定采纳动作后才可事务写入，失败全部回滚。
- **已确认世界能够进入原版写作提示词**：每个被采用的对象都写入带来源的 `world.content` 事实；这是针对 NarraLume `canonContextSources` 以事实组织上下文的实际源码所作的补接，而非只生成孤立实体卡。
- **NPC 活动推进还不是完整 GOAP**：目前使用具有真实当前知识/关系的 **world.advance** 模型任务提出行动候选，经作者批准才变化；还未移植 WorldForge 每 NPC 独立 agent 调度与物理仲裁，也不能称为实时世界模拟器。

## 三、已落库的测试用例（并非已运行结果）

| 测试文件                                             | 验证设计                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/test/world-pack.test.ts`         | 包结构、局部ID、Canon引用、地图环与非地点归属、关系去重                                                                                                          |
| `packages/narrative/test/world-pack-context.test.ts` | W1根据区域/社会关系多跳检索上下文，避免只选最后几张卡                                                                                                            |
| `apps/server/test/world-pack-api.test.ts`            | W0模型模拟输出→保存候选→Canon仍为空→整体采用→Canon实体/关系/活动存在；正文StoryStatePacket读取高价物品；世界包修订冲突；W1继续沿用 W0 ID；世界自转和明确产权结束 |

**构建/测试状态**：此次未在有 Node 24、npm 11 与全部依赖的环境执行 `npm ci`、`npm run verify:ci`、Playwright 或真实LLM调用。以上都是已经提交的实际代码与测试**用例**，不得把“存在测试用例”描述为“测试通过”。

## 四、怎么实际试用

1. 切到 Draft PR #1 分支，在 Node >=24、npm >=11 环境安装依赖：`npm ci`，运行 `npm run dev`（需要本机/部署配置的 AI Provider 才能让生成任务真正运行）。
2. 新建作品，在左侧“世界生成”输入世界、当下世界时间，选择 W0，点击**AI生产完整世界包**。一包中应看到具体对象、关系、正在做的事与开放延伸。
3. 修改不合理内容（目前提供 JSON 编辑，仍需要更好的所见即所得修改），作者勾选确认后整体采纳，进入原故事百科检查同一批人物与资源、事实和关系。
4. 切 W1、选已存在的地区/圈层，再生产，应该复用相同 Canon ID。可以点击“推进已有NPC/组织的生活”，观察历史继承、旧事务结束和新社会机会。
5. 回原小说创作工作区使用这些实体写章节；从源码/运行回执验证 `world.content`、关系和相关事件进入 StoryState。真实内容价值还须用玄幻、1878法国、1392大明做模型生成实演。

## 五、第一模块没有被这次代码冒充为已经全部完成的部分

- **真实模型质量验收**：需要实际比较 v0.7 生成的完整世界样本，而非只用 Mock。
- **完全编辑体验**：当前世界包仍以 JSON 修订，缺多面板可视化世界制作UI、图形地图、源资料核对工具。
- **NPC GOAP多智能体**：已能基于既有世界提出跨时间的活动候选，但不是 WorldForge 原来的实体 per-agent 调度/仲裁、物理模拟。
- **世界内容缺口自动路由**：第③模块尚未按“进入尚不存在地图”自动向①提交请求并恢复原章节位置。作者目前可自己打开 World Builder。
- **广域长篇演化**：尚未做多世界时间分支与大量事件的成本控制；不能声称已经以百万字持续运行验收。
- **真实第三方源码移植（新进度）**：最初这部分确实是自行写的。随后已直接移植 Covel 的世界分段解析/依赖排序/缓存，WorldForge 的因果候选和维度注册，以及 CampaignRepo 的关系双向分类。已在世界生成工作流和 Canon 图中调用。**还未完整移植 Covel 世界生成主程序、WorldForge agent/arbiter/engine**。见 [移植记录](05-actual-upstream-ports.md)。

## 变更对标依据

[完整v0.1母本](research/world-v01-original.md) · [完整v0.7母本](research/world-v07-complete.md) · [世界生成章程](research/world-generation-charter.md) · [开放项目复用Crosswalk](01-reuse-crosswalk.md)
