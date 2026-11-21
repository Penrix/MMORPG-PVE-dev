import { z } from "zod";

/**
 * World Atlas content language.
 *
 * v0.1-v0.7 define what a world contains (Content Schema), not a SQL schema.
 * Cards remain free-form Markdown; these registries only provide stable kinds,
 * author hints, relation vocabulary, filtering and inverse display labels.
 */
export const WorldAtlasCardKindSchema = z.enum([
  "character",
  "population",
  "organization",
  "institution",
  "position",
  "location",
  "ability",
  "rule",
  "technology",
  "resource",
  "item",
  "work",
  "information",
  "event",
  "activity",
  "creature",
  "other",
]);

export type WorldAtlasCardKind = z.infer<typeof WorldAtlasCardKindSchema>;

export type WorldAtlasContentFamily =
  | "space"
  | "people"
  | "organization"
  | "power"
  | "asset"
  | "economy"
  | "activity"
  | "information"
  | "value"
  | "playable";

export const WORLD_ATLAS_CONTENT_FAMILIES = [
  {
    id: "space",
    label: "空间",
    description: "世界、国家、区域、Zone、Hub、POI、道路与社会入口",
  },
  {
    id: "people",
    label: "人",
    description: "人物、人口/职业群体、种族与生物",
  },
  {
    id: "organization",
    label: "组织与社会",
    description: "组织、派系、联盟、家族网络、制度、职位与权限",
  },
  {
    id: "power",
    label: "力量与规则",
    description: "公共规则、能力、技能、境界、专业能力、技术与研究",
  },
  {
    id: "asset",
    label: "资源与资产",
    description: "资源、物品、财产、作品、权利、知识、秘密与高价对象",
  },
  {
    id: "economy",
    label: "生产与流通",
    description: "产地、生产、加工、运输、交易、消费与分配形成的网络",
  },
  {
    id: "activity",
    label: "世界活动",
    description: "历史事件、当前事务、战争、商业、政治、研究与日常生活",
  },
  {
    id: "information",
    label: "信息世界",
    description: "事实、情报、传播渠道、秘密、认知与误判",
  },
  {
    id: "value",
    label: "社会定价",
    description: "公众名望、专业评价、组织立场、私人信任与威胁判断",
  },
  {
    id: "playable",
    label: "可玩内容",
    description: "对既有世界对象的可探索、可学习、可争夺、可经营与可享受视图",
  },
] as const satisfies ReadonlyArray<{
  id: WorldAtlasContentFamily;
  label: string;
  description: string;
}>;

export interface WorldAtlasNarrativeAxisDefinition {
  id: "people-centered";
  label: string;
  centerKind: "character";
  principle: string;
  databaseRule: string;
  expansionPriority: readonly WorldAtlasCardKind[];
}

export const WORLD_ATLAS_NARRATIVE_AXIS = {
  id: "people-centered",
  label: "人物叙事轴",
  centerKind: "character",
  principle:
    "十个 World Family 保持并排；人物作为小说关系展开、检索与上下文组装的默认中心。",
  databaseRule:
    "People-centered 是 View / Query / Priority，不是新的 Database Schema；仍使用同一批 Card + Typed Edge。",
  expansionPriority: [
    "character",
    "organization",
    "position",
    "population",
    "location",
    "resource",
    "item",
    "ability",
    "information",
    "event",
    "activity",
    "technology",
    "institution",
    "work",
    "rule",
    "creature",
    "other",
  ],
} as const satisfies WorldAtlasNarrativeAxisDefinition;

export function worldAtlasNarrativePriority(kind: WorldAtlasCardKind): number {
  const index = WORLD_ATLAS_NARRATIVE_AXIS.expansionPriority.indexOf(kind);
  return index < 0
    ? WORLD_ATLAS_NARRATIVE_AXIS.expansionPriority.length
    : index;
}

export interface WorldAtlasCardTypeDefinition {
  kind: WorldAtlasCardKind;
  label: string;
  family: WorldAtlasContentFamily;
  description: string;
  templateSections: readonly string[];
}

export const WORLD_ATLAS_CARD_TYPES = [
  {
    kind: "character",
    label: "人物",
    family: "people",
    description: "具名人物及其人生、能力、关系、经历与社会位置",
    templateSections: [
      "身份与人生",
      "所在与组织",
      "人物关系",
      "力量与资源",
      "性格与行动方式",
      "重要经历",
      "社会评价与私人生活",
    ],
  },
  {
    kind: "population",
    label: "人口/职业群体",
    family: "people",
    description: "普通人口、职业群体、阶层或稳定社会群体",
    templateSections: [
      "分布与生计",
      "职业与组织",
      "资源与需求",
      "社会关系",
      "当前变化",
    ],
  },
  {
    kind: "organization",
    label: "组织",
    family: "organization",
    description: "正式组织、派系、联盟、家族网络及其运转机器",
    templateSections: [
      "组织形态与区域",
      "领导与成员",
      "资产与资源",
      "决策与权限",
      "当前目标与事务",
      "对外关系",
    ],
  },
  {
    kind: "institution",
    label: "制度",
    family: "organization",
    description: "法律、组织制度、资格体系、继承或任命规则",
    templateSections: [
      "制度内容",
      "适用范围",
      "执行者",
      "资格与程序",
      "实际影响",
      "相关组织与人物",
    ],
  },
  {
    kind: "position",
    label: "职位/身份位",
    family: "organization",
    description: "能够被具体人物占据并产生真实权限的职位或社会身份位",
    templateSections: [
      "职位性质",
      "任命/取得方式",
      "实际权限",
      "限制与监督",
      "历任/现任",
      "相关组织",
    ],
  },
  {
    kind: "location",
    label: "地点/区域",
    family: "space",
    description: "世界、国家、Zone、Hub、POI及可反复进入的空间",
    templateSections: [
      "范围与地理",
      "交通与通路",
      "组织与人物",
      "资源与活动",
      "准入与控制",
      "日常运行",
      "相邻世界内容",
    ],
  },
  {
    kind: "ability",
    label: "能力/技能",
    family: "power",
    description: "忍术、功法、技能、专业能力及其实际动作",
    templateSections: [
      "能力本体",
      "取得与学习",
      "实际动作",
      "作用范围",
      "前置与反制",
      "组合与传承",
      "社会价格",
    ],
  },
  {
    kind: "rule",
    label: "世界规则",
    family: "power",
    description: "物理、超凡、制度或交互中稳定成立的公共规则",
    templateSections: [
      "规则内容",
      "适用对象",
      "成立条件",
      "可观察结果",
      "例外与边界",
      "关联能力与社会影响",
    ],
  },
  {
    kind: "technology",
    label: "技术/工艺",
    family: "power",
    description: "研究、制造、工艺、工程或组织技术",
    templateSections: [
      "技术原理",
      "掌握者",
      "材料与条件",
      "生产/研究过程",
      "实际用途",
      "传播与垄断",
      "产业影响",
    ],
  },
  {
    kind: "resource",
    label: "资源",
    family: "asset",
    description: "可采集、生产、交换、积累或争夺的世界资源",
    templateSections: [
      "分布与产地",
      "控制者",
      "价值",
      "取得方式",
      "加工与流通",
      "用途",
      "再生/耗尽与替代",
    ],
  },
  {
    kind: "item",
    label: "物品/资产",
    family: "asset",
    description: "具体物件、房产、契约、秘卷、装备与可持有资产",
    templateSections: [
      "本体与权属",
      "来源",
      "用途",
      "取得/转让",
      "限制",
      "当前持有人",
      "相关事件",
    ],
  },
  {
    kind: "work",
    label: "作品/文化产品",
    family: "asset",
    description: "小说、剧本、歌曲、报刊栏目及其他可传播作品",
    templateSections: [
      "作品内容",
      "创作者",
      "权属",
      "发表/发行",
      "受众与评价",
      "经济价值",
      "改编与衍生",
    ],
  },
  {
    kind: "information",
    label: "信息/秘密",
    family: "information",
    description: "情报、秘密、传闻、线索与可传播知识",
    templateSections: [
      "信息内容",
      "真实性",
      "来源",
      "知情者",
      "传播渠道",
      "保密/误判",
      "实际用途",
    ],
  },
  {
    kind: "event",
    label: "事件",
    family: "activity",
    description: "已经发生或母体历史中明确存在的世界事件",
    templateSections: [
      "时间与地点",
      "参与者",
      "起因",
      "实际经过",
      "结果",
      "长期影响",
      "关联资料",
    ],
  },
  {
    kind: "activity",
    label: "持续事务/活动",
    family: "activity",
    description: "战争、研究、训练、连载、调查、经营等持续中的世界事务",
    templateSections: [
      "活动主体",
      "目标",
      "地点与时间",
      "已有行动",
      "资源与条件",
      "当前状态",
      "相关人物与组织",
    ],
  },
  {
    kind: "creature",
    label: "生物/种族对象",
    family: "people",
    description: "尾兽、魔兽、特殊种群及具有稳定世界身份的生物对象",
    templateSections: [
      "形态与分布",
      "生态",
      "能力",
      "资源价值",
      "与人物/组织关系",
      "历史与社会影响",
    ],
  },
  {
    kind: "other",
    label: "其他",
    family: "asset",
    description: "尚未稳定归类但值得拥有独立身份、长资料和关系网络的对象",
    templateSections: ["说明", "相关对象", "历史与关系"],
  },
] as const satisfies readonly WorldAtlasCardTypeDefinition[];

export function worldAtlasCardType(
  kind: WorldAtlasCardKind,
): WorldAtlasCardTypeDefinition {
  return (
    WORLD_ATLAS_CARD_TYPES.find((entry) => entry.kind === kind) ??
    WORLD_ATLAS_CARD_TYPES[WORLD_ATLAS_CARD_TYPES.length - 1]!
  );
}

export function worldAtlasCardTemplate(
  kind: WorldAtlasCardKind,
  name = "新卡片",
): string {
  const definition = worldAtlasCardType(kind);
  return [
    `# ${name}`,
    "",
    ...definition.templateSections.flatMap((section) => [`## ${section}`, ""]),
  ].join("\n");
}

export type WorldAtlasRelationGroup =
  "space" | "social" | "power" | "asset" | "activity" | "information";

export interface WorldAtlasRelationDefinition {
  relation: string;
  inverse: string;
  group: WorldAtlasRelationGroup;
}

export const WORLD_ATLAS_RELATIONS = [
  { relation: "位于", inverse: "包含", group: "space" },
  { relation: "属于", inverse: "包含", group: "space" },
  { relation: "通往", inverse: "通往", group: "space" },
  { relation: "邻接", inverse: "邻接", group: "space" },
  { relation: "控制", inverse: "被控制", group: "space" },
  { relation: "活动于", inverse: "活动者", group: "space" },

  { relation: "所属", inverse: "成员", group: "social" },
  { relation: "所属组织", inverse: "成员", group: "social" },
  { relation: "所属家族", inverse: "成员", group: "social" },
  { relation: "隶属", inverse: "成员", group: "social" },
  { relation: "任职", inverse: "任职者", group: "social" },
  { relation: "领导", inverse: "下属", group: "social" },
  { relation: "上级", inverse: "下级", group: "social" },
  { relation: "老师", inverse: "学生", group: "social" },
  { relation: "师父", inverse: "徒弟", group: "social" },
  { relation: "师傅", inverse: "徒弟", group: "social" },
  { relation: "父亲", inverse: "子女", group: "social" },
  { relation: "母亲", inverse: "子女", group: "social" },
  { relation: "父母", inverse: "子女", group: "social" },
  { relation: "兄弟", inverse: "兄弟", group: "social" },
  { relation: "姐妹", inverse: "姐妹", group: "social" },
  { relation: "兄弟姐妹", inverse: "兄弟姐妹", group: "social" },
  { relation: "配偶", inverse: "配偶", group: "social" },
  { relation: "夫妻", inverse: "夫妻", group: "social" },
  { relation: "伴侣", inverse: "伴侣", group: "social" },
  { relation: "朋友", inverse: "朋友", group: "social" },
  { relation: "好友", inverse: "好友", group: "social" },
  { relation: "盟友", inverse: "盟友", group: "social" },
  { relation: "同盟", inverse: "同盟", group: "social" },
  { relation: "敌对", inverse: "敌对", group: "social" },
  { relation: "敌人", inverse: "敌人", group: "social" },
  { relation: "对手", inverse: "对手", group: "social" },
  { relation: "竞争", inverse: "竞争", group: "social" },
  { relation: "竞争者", inverse: "竞争者", group: "social" },
  { relation: "搭档", inverse: "搭档", group: "social" },
  { relation: "同伴", inverse: "同伴", group: "social" },
  { relation: "效忠", inverse: "效忠者", group: "social" },
  { relation: "监管", inverse: "被监管", group: "social" },
  { relation: "出身", inverse: "出身者", group: "social" },
  { relation: "创建", inverse: "创建者", group: "social" },

  { relation: "掌握", inverse: "掌握者", group: "power" },
  { relation: "拥有能力", inverse: "掌握者", group: "power" },
  { relation: "使用", inverse: "使用者", group: "power" },
  { relation: "传授", inverse: "受传者", group: "power" },
  { relation: "前置", inverse: "后续", group: "power" },
  { relation: "克制", inverse: "被克制", group: "power" },
  { relation: "反制", inverse: "被反制", group: "power" },
  { relation: "组合", inverse: "组合", group: "power" },

  { relation: "拥有", inverse: "拥有者", group: "asset" },
  { relation: "生产", inverse: "生产者", group: "asset" },
  { relation: "加工", inverse: "加工者", group: "asset" },
  { relation: "运输", inverse: "运输者", group: "asset" },
  { relation: "交易", inverse: "交易方", group: "asset" },
  { relation: "消费", inverse: "消费者", group: "asset" },
  { relation: "依赖", inverse: "支撑", group: "asset" },
  { relation: "产于", inverse: "产出", group: "asset" },
  { relation: "来源", inverse: "产出", group: "asset" },

  { relation: "参与", inverse: "参与者", group: "activity" },
  { relation: "发生于", inverse: "发生事件", group: "activity" },
  { relation: "导致", inverse: "结果来自", group: "activity" },
  { relation: "涉及", inverse: "涉及", group: "activity" },

  { relation: "知道", inverse: "被知晓", group: "information" },
  { relation: "来自", inverse: "信息来源", group: "information" },
  { relation: "传播到", inverse: "接收自", group: "information" },
  { relation: "评价", inverse: "被评价", group: "information" },

  // English compatibility for imported Markdown.
  { relation: "teacher", inverse: "student", group: "social" },
  { relation: "student", inverse: "teacher", group: "social" },
  { relation: "parent", inverse: "child", group: "social" },
  { relation: "child", inverse: "parent", group: "social" },
  { relation: "member_of", inverse: "member", group: "social" },
  { relation: "member", inverse: "member_of", group: "social" },
  { relation: "owns", inverse: "owned_by", group: "asset" },
  { relation: "owned_by", inverse: "owns", group: "asset" },
  { relation: "located_in", inverse: "contains", group: "space" },
  { relation: "contains", inverse: "located_in", group: "space" },
  { relation: "spouse", inverse: "spouse", group: "social" },
  { relation: "partner", inverse: "partner", group: "social" },
  { relation: "friend", inverse: "friend", group: "social" },
  { relation: "ally", inverse: "ally", group: "social" },
  { relation: "enemy", inverse: "enemy", group: "social" },
  { relation: "rival", inverse: "rival", group: "social" },
] as const satisfies readonly WorldAtlasRelationDefinition[];

const WORLD_ATLAS_INVERSE_RELATIONS = new Map<string, string>(
  WORLD_ATLAS_RELATIONS.map((entry): [string, string] => [
    entry.relation,
    entry.inverse,
  ]),
);

/**
 * Preferred author-facing inverse labels for the reverse side of a relation.
 * Some forward labels intentionally converge on one reverse label (for
 * example 所属组织 / 所属家族 / 隶属 → 成员), so the reverse direction needs
 * one simple canonical display choice rather than a relationship rule engine.
 */
const WORLD_ATLAS_REVERSE_INPUTS: Readonly<Record<string, string>> = {
  包含: "属于",
  被控制: "控制",
  活动者: "活动于",
  成员: "所属",
  任职者: "任职",
  下属: "领导",
  下级: "上级",
  学生: "老师",
  徒弟: "师父",
  子女: "父母",
  效忠者: "效忠",
  被监管: "监管",
  出身者: "出身",
  创建者: "创建",
  掌握者: "掌握",
  使用者: "使用",
  受传者: "传授",
  后续: "前置",
  被克制: "克制",
  被反制: "反制",
  拥有者: "拥有",
  生产者: "生产",
  加工者: "加工",
  运输者: "运输",
  交易方: "交易",
  消费者: "消费",
  支撑: "依赖",
  产出: "产于",
  参与者: "参与",
  发生事件: "发生于",
  结果来自: "导致",
  被知晓: "知道",
  信息来源: "来自",
  接收自: "传播到",
  被评价: "评价",
};

export function inverseWorldAtlasRelation(relation: string): string | null {
  const normalized = relation.trim();
  return (
    WORLD_ATLAS_INVERSE_RELATIONS.get(normalized) ??
    WORLD_ATLAS_REVERSE_INPUTS[normalized] ??
    null
  );
}
