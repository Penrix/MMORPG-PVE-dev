/** 
 * MMORPG-PVE World Builder: a world-content producer, not a chapter-outline generator.
 *
 * This first vertical slice uses NarraLume's existing Canon candidate transaction.
 * A round only edits ONE Canon spread; accepted objects become available to all
 * future world rounds and to the original novel-writing context.
 *
 * Historical legacy implementation: the active production flow is now
 * packages/narrative/src/world-pack-workers.ts, which invokes actual ported
 * Covel/WorldForge code and the seven independent v0.1-v0.7 research editions.
 * The author has explicitly approved publishing the complete world research.
 */
export type WorldScale = "W0" | "W1";
export type WorldStage =
  | "world"
  | "factions"
  | "people"
  | "resources"
  | "activities"
  | "claims"
  | "relations";
export type WorldSpread = "entities" | "timeline" | "facts" | "relations";

export interface WorldBuilderInput {
  scale: WorldScale;
  stage: WorldStage;
  premise: string;
  worldTime: string;
  focus: string;
  genre: string;
  scarcity: string;
  instruction: string;
}

export const WORLD_STAGES: ReadonlyArray<{
  id: WorldStage;
  label: string;
  blurb: string;
  spread: WorldSpread;
}> = [
  { id: "world", label: "01 世界底图", blurb: "可进入区域、社会框架与实际力量", spread: "entities" },
  { id: "factions", label: "02 势力与入口", blurb: "组织、权力中介、地盘与资源控制", spread: "entities" },
  { id: "people", label: "03 人物生态", blurb: "真实的人、欲望、关系与独立生活", spread: "entities" },
  { id: "resources", label: "04 高价内容", blurb: "宝物、权利、事业与人生奖励", spread: "entities" },
  { id: "activities", label: "05 活世界", blurb: "男主尚未介入时正在发生的事务", spread: "timeline" },
  { id: "claims", label: "补充·权属和条件", blurb: "资源归属、通路、代价与生效事实", spread: "facts" },
  { id: "relations", label: "补充·关系网络", blurb: "势力、人物与地点间可追溯的联系", spread: "relations" },
] as const;

const STAGE_INSTRUCTIONS: Record<WorldStage, string> = {
  world: [
    "本轮生产 W0 全世界底图中的具体区域和世界规则，或 W1 指定区域的实际场所。",
    "优先创造/恢复有名称且可进入的地点、已存在的社会机构、真实可执行的规则与力量来源；解释内部日常活动、进入路径，以及如何连接外部区域。",
    "不要只写「商业区」「宗门」「贵族圈」等抽象类别。每个实体应提供有实际作用的具体人事物、经济或权力关系。W0 要有不同社会领域，不得把整个世界缩减成男主职业的主题公园。",
  ].join("\n"),
  factions: [
    "生产真实的组织与权力中介：正式名称、掌权者、成员结构、分支、地盘、收入、控制的具体资源、内部利益和对外关系。",
    "每个势力都需要现在独立推进的事务，以及别人想进入其圈层时真正面对的权限、人物和代价。",
    "不要仅以好坏、敌我或抽象阵营标签替代实际组织。",
  ].join("\n"),
  people: [
    "生产能独立生活、工作和追逐愿望的具体人物（不全是给男主提供任务的工具人）。",
    "写清个人能力、社会身价、职业和家人朋友、当下烦恼与意图、正在做的事、所掌握或接近的资源。",
    "同时考虑普通职业者、社会中介、不可忽视的高价人物；人物关系需要实际活动和利益内容。不能擅自替作者确定男主出身或金手指。",
  ].join("\n"),
  resources: [
    "生产可争取、享有、经营或改变的人生高价内容：实物、资格、地盘、版权、职位、特殊权利、产业、知识与享乐机会。",
    "每个对象都要说明：它的现实价值、谁在当前持有或控制、地点、取得或接触的真实路径、获得后会改变什么。",
    "不能只是稀有物品列表；让财富、身份、能力、私人生活和事业资源之间存在可以转化的实际中介。",
  ].join("\n"),
  activities: [
    "记录当前世界时间点已经存在或正在发生的具体事务，不能提前把未来剧情写成既成事实。",
    "每件事务指出行动者、为何行动、涉及哪些真实人物/组织/资源、已经进行到哪里、可能引发谁的反应。",
    "这些行动即使拿掉男主仍会继续。此轮生成的是世界事件，不是章节摘要、男主必接的任务或者尚未发生的未来历史。",
    "本轮写入 timeline 时必须填写唯一的 sequence（在已记录的最大序号之后续排），事件的 participants 与 causes 只引用 supportingIndex 已存在的ID。",
  ].join("\n"),
  claims: [
    "围绕已建立的实体补充实际可核对的世界事实：所有权、使用权、社会准入、价格、权力、限制、资源流动和状态。",
    "必须以 supportingIndex 中真实存在的实体ID为 subjectId 或 objectEntityId，不能发明ID；找不到对象时先返回实体轮去创建。",
    "严格区分已经生效的Reality、未兑现的承诺、人物猜测和待核实的信息，不把未来计划当成当前事实。",
  ].join("\n"),
  relations: [
    "围绕 supportingIndex 中已建立的实体建立有实际作用的关系：控制、雇佣、师友、贸易、婚恋、竞争、准入或利益依赖。",
    "必须引用已存在的实体ID，并写清关系当前状态、现实条件以及谁能据此做什么；不要造同名新实体。",
    "关系可以打开新区域、新交易和新生活，不要把它们压成单一好感数值。",
  ].join("\n"),
};

export function worldStage(stage: WorldStage) {
  return WORLD_STAGES.find((item) => item.id === stage)!;
}

export function worldBuilderValidation(input: WorldBuilderInput): string | null {
  if (!input.premise.trim()) return "先说明要构建什么世界。";
  if (input.scale === "W1" && !input.focus.trim())
    return "W1 需要明确要展开的具体区域、时间或圈层。";
  if (input.scale === "W1" && !input.genre.trim())
    return "W1 需要明确题材/Reader期待，才能选择提高分辨率的方向。";
  return null;
}

export function buildWorldBuilderInstruction(input: WorldBuilderInput): string {
  const error = worldBuilderValidation(input);
  if (error) throw new Error(error);
  const stage = worldStage(input.stage);
  const scaleGuidance =
    input.scale === "W0"
      ? "W0 世界战略底图：覆盖不同重要社会系统、地区、资源和连接。现在不必详写每栋建筑，但必须制造真实可进入、可活动、有权力和利益的世界对象。"
      : "W1 现有世界局部深化：沿已确认W0、既有正文/世界事件，给本次地图或圈层提高内容分辨率。类型 × 时间地点 × 稀缺性共同决定深化对象。已有高价目标优先塑造其稀缺性；目标尚未确定时创造不同的高价值候选，不自行宣称作者已决定。";

  return [
    `【WORLD_BUILDER/${input.scale}/${input.stage}】`,
    "你是单主角开放世界 PVE 的世界设计师与游戏内容制作人，不是章节编剧。生产一个在男主进入之前就有真实人物、资产、活动和历史的世界。",
    `生产层次：${scaleGuidance}`,
    `世界根设想：${input.premise.trim()}`,
    `当前世界时期：${input.worldTime.trim() || "按已确认世界设定与现有故事时间判定，尚无根据的时间保持开放"}`,
    input.scale === "W1"
      ? `正在展开的地点/圈层：${input.focus.trim()}\n题材与Reader情绪：${input.genre.trim()}\n当前高价目标及稀缺性：${input.scarcity.trim() || "目标未锁定；从既有世界内容中发现可争取的高价对象"}`
      : "W0 不预设必须为某一个男主目标铺路；金融、政治、军队、文化、职业、生活等与题材有关的不同世界内容均可真实存在。",
    `本轮工作：${stage.label}（只更新 Canon 的 ${stage.spread} 板块）\n${STAGE_INSTRUCTIONS[input.stage]}`,
    "具体生产：建议3至6条彼此可连接、可单独采纳的具体对象/状态，优先发展支持当前范围的已有实体；重要对象的 description、attributes/state 或事件 description 要给出足够的真实内容，不以一句功能标签代替。现有资料已充分时可少于这个数量。",
    "现行世界与已提交正文是现实基础；先看 currentSpread 与 supportingIndex，复用旧人物、组织、规则和稳定ID，不能换地图后重置人物和资产。生成新实体时由系统分配ID，不要自行虚构数据库ID。",
    "恢复历史或原著时分清已核对资料、推断、待查与原创改编；只凭模型记忆的具体史实不能伪装已经核验。原创世界要主动创造真实内容，不必等待史料。",
    "保留Reader可以获得的地位、能力、女人、经营事业、财富、自由等不同生活可能，但不能把世界缩成固定章纲。这里生产的是世界现有内容，不把男主的未来胜利、未发生的事件或AI候选宣称为正典。",
    "每项只按当前 Canon Spread 接口输出 create/update 候选，不输出纯散文报告；字段遵守系统 afterJson 约束，记录具体来源和必要条件。建议尚未采纳，作者可以逐项接受或拒绝。",
    input.instruction.trim() ? `本轮作者补充指示：${input.instruction.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
