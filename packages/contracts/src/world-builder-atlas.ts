import type {
  WorldAtlasCardKind,
  WorldAtlasContentFamily,
} from "./world-atlas.js";
import {
  WISH_FULFILLMENT_SEARCH_AXES,
  type WishFulfillmentSearchAxisId,
} from "./wish-fulfillment.js";

export const WORLD_BUILDER_WISH_FULFILLMENT_AXES =
  WISH_FULFILLMENT_SEARCH_AXES;

export type WorldBuilderWishFulfillmentAxisId = WishFulfillmentSearchAxisId;

/**
 * Module-1 selection policy. This chooses which world content deserves
 * expensive production attention. It is separate from Atlas family coverage,
 * which only audits what an already-selected anchor/zone still lacks.
 */
export const WORLD_BUILDER_SELECTION_POLICY = {
  name: "男频意淫价值 / Wish-Fulfillment Selection",
  firstQuestion:
    "如果我是这个男主，这个候选到底有什么值得我意淫？它会让成为这个男主增加什么欲望？",
  expansionQuestion:
    "围绕同一个高价对象，不是选一种关系，而是展开多条可持续升价的线程：认可、师承、需要、私人准入、公开背书、权力、偏爱、拥有、命运改写等哪些都值得逐条发生？",
  bearingQuestion:
    "什么 Reality、人、关系、历史、价格、门槛、稀缺、竞争、资格和取得路径，能把这些幻想线程逐条托得更真、更贵、更馋？",
  objective:
    "优先生产高意淫价值且能继续打开更贵人生的世界对象；低价背景只在承重、入口、关系或当前 Reality 需要时精编。",
  bearingRule:
    "意淫承重的目标函数是提高幻想价格，不是降低幻想收益。承重不是平衡税。",
  selectionVsAudit:
    "Selection decides what deserves production; Atlas coverage audit only checks what the already-selected anchor or zone still lacks. Family scarcity is never creative value by itself.",
  candidateSignals: [
    "它本身是否让目标男性 Reader 真想拥有、成为、进入、征服、享受、改变或被认可",
    "它是否能让男主力量、身份、财富、圈层、信息、空间、关系或事业升级",
    "它是否能继续打开更高价人物、能力、资产、权限、地图或生活",
    "它是否拥有 Reader 预装价格、世界内部价格或能与男主形成高价关系",
  ],
  bearingSignals: [
    "谁拥有、控制、教授、授权、选择、评价、竞争或阻碍",
    "什么历史、规则、社会价格、稀缺、资格、共同经历或现实入口使它值钱",
    "男主真正取得后，哪些人和组织会重新给他定价",
  ],
  antiBalanceTax: [
    "不得因为能力太强就自动加冷却、反噬、寿命税或随机失控",
    "不得因为关系太爽就自动制造长期情感债务来抵消收益",
    "不得因为男主赢得太多就安排与当前 Reality 无关的净亏损",
    "真实限制只可来自 Source / Current Reality / 人物选择或明确产品增益，不能只来自太爽所以要平衡",
  ],
  axes: WORLD_BUILDER_WISH_FULFILLMENT_AXES,
} as const;

export type WorldBuilderStageId =
  | "root"
  | "skeleton"
  | "zone"
  | "humanize"
  | "connect"
  | "activate"
  | "price"
  | "audit";

export interface WorldBuilderStageDefinition {
  id: WorldBuilderStageId;
  label: string;
  purpose: string;
  next: readonly WorldBuilderStageId[];
}

export const WORLD_BUILDER_STAGES = [
  {
    id: "root",
    label: "世界根",
    purpose: "建立时代、世界根规则与大尺度空间。",
    next: ["skeleton", "zone"],
  },
  {
    id: "skeleton",
    label: "世界骨架",
    purpose: "建立关键地区、组织、力量与资源骨架。",
    next: ["zone", "humanize", "audit"],
  },
  {
    id: "zone",
    label: "可制作区域",
    purpose: "选择一个真实区域、行业或圈层向下制作。",
    next: ["humanize", "connect", "activate", "audit"],
  },
  {
    id: "humanize",
    label: "装入人",
    purpose: "让地点、组织、资产、能力接上具体人物与人口生态。",
    next: ["connect", "activate", "audit"],
  },
  {
    id: "connect",
    label: "连接世界",
    purpose: "建立 typed relations，消除孤立设定。",
    next: ["humanize", "activate", "price", "audit"],
  },
  {
    id: "activate",
    label: "让世界行动",
    purpose: "让人物与组织拥有正在推进的现实事务。",
    next: ["connect", "price", "audit"],
  },
  {
    id: "price",
    label: "建立价格",
    purpose: "明确稀缺性、社会价格、权限、入口与高价对象。",
    next: ["connect", "activate", "audit"],
  },
  {
    id: "audit",
    label: "世界缺口审计",
    purpose: "按 World Atlas 两条轴发现结构性缺口并决定下一轮生产。",
    next: [
      "root",
      "skeleton",
      "zone",
      "humanize",
      "connect",
      "activate",
      "price",
    ],
  },
] as const satisfies readonly WorldBuilderStageDefinition[];

export type WorldBuilderWorkshopId =
  | "geography"
  | "factions"
  | "people"
  | "economy"
  | "power"
  | "events"
  | "social"
  | "playability"
  | "living";

export interface WorldBuilderAtlasTarget {
  workshop: WorldBuilderWorkshopId;
  families: readonly WorldAtlasContentFamily[];
  cardKinds: readonly WorldAtlasCardKind[];
  peopleQuestions: readonly string[];
  completionRule: string;
}

export const WORLD_BUILDER_ATLAS_CROSSWALK = [
  {
    workshop: "geography",
    families: ["space", "playable"],
    cardKinds: ["location"],
    peopleQuestions: [
      "谁生活在这里？",
      "谁控制这里？",
      "谁能带人进入？",
      "谁正在这里行动？",
    ],
    completionRule:
      "地点不只被命名，还应有实际通路、控制/活动关系，并尽量接上真实人物或组织。",
  },
  {
    workshop: "factions",
    families: ["organization", "people", "value"],
    cardKinds: ["organization", "position", "institution", "population"],
    peopleQuestions: [
      "谁领导或真正掌权？",
      "谁负责执行？",
      "谁在争夺位置或资源？",
      "谁能代表这个组织对外行动？",
    ],
    completionRule:
      "组织必须能落到具体掌权者、岗位、成员、资源与对外关系，不能只留下阵营名称。",
  },
  {
    workshop: "people",
    families: ["people", "activity", "information"],
    cardKinds: ["character", "population", "creature"],
    peopleQuestions: [
      "他与谁有私人、职业或权力关系？",
      "他属于哪些组织或圈层？",
      "他现在正在做什么？",
      "他知道什么、误解什么、想得到什么？",
    ],
    completionRule:
      "人物必须进入关系网并拥有现实位置与当前行动，不能只是孤立人设卡。",
  },
  {
    workshop: "economy",
    families: ["asset", "economy", "value"],
    cardKinds: ["resource", "item", "work", "technology"],
    peopleQuestions: [
      "谁拥有或控制？",
      "谁生产、加工、运输、交易或消费？",
      "谁需要或正在争夺？",
      "谁能把别人带进这条资源链？",
    ],
    completionRule:
      "资产必须进入权属、生产、流通或争夺网络，并留下能继续利用的现实价值。",
  },
  {
    workshop: "power",
    families: ["power", "asset", "value"],
    cardKinds: ["ability", "rule", "technology", "resource"],
    peopleQuestions: [
      "谁掌握或使用？",
      "谁能教授、授权或垄断？",
      "谁能反制？",
      "这项力量改变了哪些人的社会价格或权限？",
    ],
    completionRule:
      "力量不能只写说明，必须连接掌握者、取得路径、实际动作、反制与社会影响。",
  },
  {
    workshop: "events",
    families: ["activity", "information", "people"],
    cardKinds: ["activity", "event"],
    peopleQuestions: [
      "谁发动？",
      "谁参与？",
      "谁受益或受损？",
      "谁知道、隐瞒或误判这件事？",
    ],
    completionRule:
      "事件/事务必须有真实 actor、资源、当前状态与后续影响，不能只当背景年表。",
  },
  {
    workshop: "social",
    families: ["people", "organization", "information", "value", "playable"],
    cardKinds: ["character", "position", "information", "institution"],
    peopleQuestions: [
      "谁能引荐？",
      "谁能批准或否决？",
      "谁在评价、保密或传播？",
      "不同入口分别能拿到什么实际权限？",
    ],
    completionRule:
      "社会通道应由具体人、职位、制度和信息关系组成，而不是抽象准入条件。",
  },
  {
    workshop: "playability",
    families: ["playable", "space", "asset", "value"],
    cardKinds: ["location", "resource", "item", "ability", "position"],
    peopleQuestions: [
      "谁提供入口？",
      "谁决定结果？",
      "谁会竞争或阻碍？",
      "取得后还能通过哪些人进入更昂贵的世界？",
    ],
    completionRule:
      "已有世界对象必须形成可进入、取得、经营、学习、争夺或享受的实际路径。",
  },
  {
    workshop: "living",
    families: ["activity", "people", "information", "value"],
    cardKinds: ["activity", "event", "character"],
    peopleQuestions: [
      "哪些既有人物会主动行动？",
      "他们凭现有资产和认知做什么？",
      "谁会因此回应？",
      "哪些关系、评价或信息状态会发生变化？",
    ],
    completionRule:
      "推进必须从既有人物的利益、资产、认知与关系出发，不为换地图重置 Reality。",
  },
] as const satisfies readonly WorldBuilderAtlasTarget[];

export function worldBuilderAtlasTarget(
  workshop: WorldBuilderWorkshopId,
): WorldBuilderAtlasTarget {
  return WORLD_BUILDER_ATLAS_CROSSWALK.find(
    (entry) => entry.workshop === workshop,
  )!;
}

export function worldBuilderWorkshopForAtlasKind(
  kind: WorldAtlasCardKind,
): WorldBuilderWorkshopId | null {
  switch (kind) {
    case "character":
    case "population":
    case "creature":
      return "people";
    case "organization":
    case "institution":
    case "position":
      return "factions";
    case "location":
      return "geography";
    case "ability":
    case "rule":
    case "technology":
      return "power";
    case "resource":
    case "item":
    case "work":
      return "economy";
    case "information":
      return "social";
    case "event":
    case "activity":
      return "events";
    case "other":
      return null;
  }
}

export const WORLD_BUILDER_ATLAS_CONTRACT = {
  output:
    "World Builder produces candidate World Atlas cards, typed relations and current activities; WorldPack is only a staging envelope.",
  contentAxis:
    "The ten World Families are parallel coverage lenses, not ten mandatory generators.",
  selection:
    "Wish-fulfillment selection chooses what deserves production before coverage repair. A missing Family is not, by itself, a reason to spend expensive production attention on a low-value object.",
  bearing:
    "Bearing raises fantasy price through Reality, people, relations, history, scarcity, access and social price; it must not silently become a balance tax that reduces protagonist gains.",
  auditBoundary:
    "Atlas audit asks what an already-selected anchor or zone still lacks. It must not be interpreted as creative-selection priority.",
  narrativeAxis:
    "People-centered changes production priority: non-person content should normally connect to concrete people or organizations when the world logic supports it.",
  completion:
    "Creating a node is not completion; the object should be connected into the world graph and made useful to world activity, value or access.",
  database:
    "Do not add a database hierarchy merely to express production concepts already representable as Card + Typed Edge.",
} as const;
