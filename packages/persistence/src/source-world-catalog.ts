import type { WorldAtlasCognitiveMother } from "@narralume/contracts";

export type SourceWorldAdapterId =
  | "naruto-specialized-v1"
  | "one-piece-dataset-v1"
  | "bleach-database-v1"
  | "hxh-static-v1"
  | "hxh-api-rich-v1"
  | "jikan-anime-cast-v1";

export interface SourceWorldUpstreamManifest {
  id: string;
  adapter: SourceWorldAdapterId;
  role: "primary" | "supporting";
  sourceUrl: string;
  repository?: string;
  ref?: string;
  paths?: string[];
  endpoint?: string;
  note: string;
}

export interface SourceWorldCatalogEntry {
  id: string;
  name: string;
  aliases: string[];
  kind: "fictional" | "historical" | "era" | "original_reference";
  canonicalCorpusId: string;
  description: string;
  cognitiveMother: WorldAtlasCognitiveMother;
  upstreams: SourceWorldUpstreamManifest[];
}

const NARUTO: SourceWorldCatalogEntry = {
  id: "naruto",
  name: "火影忍者",
  aliases: ["Naruto", "火影"],
  kind: "fictional",
  canonicalCorpusId: "wiki:naruto",
  description:
    "可被多本火影同人反复 Fork 的统一原生母体；保留全时代 Source Reference，与单书 Project Reality 分权。",
  cognitiveMother: {
    summary:
      "Reader 通常预装忍村、忍族、任务、师承、查克拉、忍术、血继限界、尾兽与忍界战争等关系语法。",
    preloadedWorldGrammar: [
      "忍者以忍村、忍族、队伍、师承和任务体系组织职业生活",
      "查克拉、忍术、血继、秘术和尾兽形成力量与稀缺分层",
      "忍村政治、战争历史与人物师承长期改变社会权限和资源价格",
    ],
    priceLogic: [
      "血继限界、顶级瞳术、尾兽、禁术与顶尖忍者天然高价",
      "火影、族长、上忍、暗部等身份同时意味着能力价格与社会权限",
    ],
    naturalEntrances: [
      "忍者学校与毕业分班",
      "任务体系",
      "忍族与师承",
      "医院、暗部、研究、后勤与战争系统",
    ],
    expectedInertia: [
      "忍村政治、忍族利益和战争历史不会因主角出现自动消失",
      "原作未来是反事实惯性，不得覆盖已经形成的 Project Reality",
    ],
    attentionLogic: [
      "低位人物突然获得高阶力量、资源或权限会被迅速重新定价",
      "改变高价人物关系与重大历史节点会直接抬高 Reader 期待",
    ],
    basis: "author_judgment",
    sourceNote:
      "Reader-side commercial Naruto fanfiction prior; not Source objective truth.",
  },
  upstreams: [
    {
      id: "naruto-dattebayo",
      adapter: "naruto-specialized-v1",
      role: "primary",
      sourceUrl: "https://github.com/viniciusschuelter/dattebayo-api",
      repository: "viniciusschuelter/dattebayo-api",
      ref: "a3871a6c931cd1f503af0bc16c80007c3a9ecda9",
      note: "Existing specialized importer; rich structured characters/groups/jutsu.",
    },
    {
      id: "naruto-wiki-scraper",
      adapter: "naruto-specialized-v1",
      role: "supporting",
      sourceUrl: "https://github.com/simon8800/naruto-wiki-scraper",
      repository: "simon8800/naruto-wiki-scraper",
      ref: "99ee5a0ff082e7c79540e0ad17b8f308ea965803",
      note: "Existing supporting long-form character evidence.",
    },
  ],
};

const ONE_PIECE: SourceWorldCatalogEntry = {
  id: "one-piece",
  name: "海贼王",
  aliases: ["One Piece", "海贼"],
  kind: "fictional",
  canonicalCorpusId: "wiki:one-piece",
  description:
    "海洋、岛屿、航线、海贼团、海军、世界政府、恶魔果实与霸气共同构成的全时代原生母体。",
  cognitiveMother: {
    summary:
      "Reader 预装海贼团航海、岛屿换图、悬赏、恶魔果实、霸气、海军与世界政府等强关系语法，并会主动给船长、顶级果实、霸气、古代秘密和著名势力高价。",
    preloadedWorldGrammar: [
      "世界以海域、岛屿、航线和船只连接，移动本身就是世界内容",
      "海贼团、海军、世界政府、革命军与地方势力持续争夺人、资源和秩序",
      "恶魔果实、霸气、剑术、科技与种族能力共同组成力量层",
      "悬赏、名号、船长身份与势力规模形成公开社会定价",
    ],
    priceLogic: [
      "顶级果实、霸王色、名刀、历史正文、古代兵器与四皇级势力天然高价",
      "悬赏和称号是 Reader 极熟悉的公开价格界面",
    ],
    naturalEntrances: [
      "加入或建立海贼团",
      "港口、岛屿与航线",
      "海军与世界政府体系",
      "地下交易、拍卖、赏金与情报网络",
    ],
    expectedInertia: [
      "既有势力、航线危险、海军追捕与海上资源竞争不会因主角出现消失",
      "全时代母体保留未来人物与事件，但项目当前只按明确时点读取",
    ],
    attentionLogic: [
      "低位角色接触高悬赏人物、名刀、顶级果实或世界秘密会立即升价",
      "改变著名海贼团、岛屿和大战结果会重写 Reader 对未来航线的定价",
    ],
    basis: "author_judgment",
    sourceNote:
      "Reader-side One Piece fanfiction prior; not Source objective truth.",
  },
  upstreams: [
    {
      id: "one-piece-dataset",
      adapter: "one-piece-dataset-v1",
      role: "primary",
      sourceUrl: "https://github.com/25thNight0901/OnePiece-dataset",
      repository: "25thNight0901/OnePiece-dataset",
      ref: "f876b1383e35d9d3fb4f45f7d8d6aa3edaaa2b07",
      paths: ["characters.json", "pirate-crews.json"],
      note: "Structured seed for characters, crews, ships and listed abilities. Community evidence, not official canon.",
    },
    {
      id: "one-piece-interaction-data",
      adapter: "one-piece-dataset-v1",
      role: "supporting",
      sourceUrl: "https://github.com/jonaszeu/one-piece-interaction-data",
      repository: "jonaszeu/one-piece-interaction-data",
      ref: "b2008e5a5c45cd96fbe96786f48fb65b1e18c147",
      paths: ["one_piece_interactions_1-1085.csv"],
      note: "Large interaction evidence across manga chapters 1-1085; registered for later relation enrichment, not blindly promoted.",
    },
  ],
};

const BLEACH: SourceWorldCatalogEntry = {
  id: "bleach",
  name: "死神",
  aliases: ["Bleach", "境·界"],
  kind: "fictional",
  canonicalCorpusId: "wiki:bleach",
  description:
    "现世、尸魂界、虚圈及相关组织、种族、斩魄刀、鬼道、灭却师能力共同组成的全时代原生母体。",
  cognitiveMother: {
    summary:
      "Reader 预装现世、尸魂界、虚圈、护廷十三队、斩魄刀、始解/卍解、虚/破面、灭却师与灵压等级等语法。",
    preloadedWorldGrammar: [
      "多个空间层通过灵魂、穿界和组织任务连接",
      "护廷十三队等组织把职位、番队、职责与人物关系绑定",
      "斩魄刀、始解、卍解、鬼道、虚化、归刃与灭却师能力形成多体系力量网络",
    ],
    priceLogic: [
      "队长级身份、卍解、特殊斩魄刀、十刃与星十字骑士等天然高价",
      "灵压、席位、番队和公开战绩会显著影响社会评价",
    ],
    naturalEntrances: [
      "真央灵术院与护廷十三队",
      "番队任务与席位体系",
      "现世驻守与魂魄事件",
      "虚圈、破面与灭却师组织",
    ],
    expectedInertia: [
      "番队组织、种族冲突和历史秘密继续按既有位置运转",
      "不同篇章时代的能力与职位不能自动借给较早时间切片",
    ],
    attentionLogic: [
      "低席位人物显露队长级能力或特殊斩魄刀会立刻抬价",
      "主角触碰蓝染、灵王、友哈巴赫等高价结构会大幅改变未来预期",
    ],
    basis: "author_judgment",
    sourceNote:
      "Reader-side Bleach fanfiction prior; not Source objective truth.",
  },
  upstreams: [
    {
      id: "bleach-database",
      adapter: "bleach-database-v1",
      role: "primary",
      sourceUrl: "https://github.com/ashishk1331/bleach-database",
      repository: "ashishk1331/bleach-database",
      ref: "0ad6aa895abfddef9081b5601c8b883941a4a32c",
      paths: [
        "data/shinigami.json",
        "data/arrancar.json",
        "data/quincy.json",
        "data/humans.json",
      ],
      note: "Large structured community dataset with race, organization/status and primary-skill fields.",
    },
  ],
};

const HUNTER_X_HUNTER: SourceWorldCatalogEntry = {
  id: "hunter-x-hunter",
  name: "全职猎人",
  aliases: ["Hunter x Hunter", "HxH", "猎人"],
  kind: "fictional",
  canonicalCorpusId: "wiki:hunter-x-hunter",
  description:
    "猎人协会、猎人执照、念能力、家族、黑帮、幻影旅团、贪婪之岛与黑暗大陆等共同组成的全时代原生母体。",
  cognitiveMother: {
    summary:
      "Reader 预装猎人考试、职业猎人、猎人执照、念能力六系、制约与誓约、家族/旅团/黑帮以及危险地域等世界语法。",
    preloadedWorldGrammar: [
      "猎人资格是一种可跨领域调用的高权限职业身份",
      "念能力以系别、个人发、训练与约束形成高度人物化的力量系统",
      "协会、家族、黑帮、幻影旅团与国家/危险区域形成多层社会入口",
    ],
    priceLogic: [
      "顶级念能力者、特殊发、猎人执照、稀有遗迹与黑暗大陆信息天然高价",
      "人物的专业猎人身份、家族与组织关系常比单纯战力更能决定准入",
    ],
    naturalEntrances: [
      "猎人考试",
      "猎人协会委托",
      "家族与师承",
      "黑帮与拍卖",
      "竞技场、贪婪之岛与危险地域探索",
    ],
    expectedInertia: [
      "既有人物会继续追求自己的职业、家族和组织目标",
      "念能力事实与人物状态必须按明确时点查询，不能把后期成长倒灌到早期",
    ],
    attentionLogic: [
      "普通考生突然拥有成熟念或特殊职业权限会被迅速重新定价",
      "接触揍敌客、旅团、十二支、王位战与黑暗大陆信息会天然抬高注意力",
    ],
    basis: "author_judgment",
    sourceNote:
      "Reader-side Hunter x Hunter fanfiction prior; not Source objective truth.",
  },
  upstreams: [
    {
      id: "hxh-static-database",
      adapter: "hxh-static-v1",
      role: "primary",
      sourceUrl:
        "https://github.com/OmarDarioMelendrez/hunter-x-hunter-api-ts",
      repository: "OmarDarioMelendrez/hunter-x-hunter-api-ts",
      ref: "687562028309b66e573ffde1bb707c8e782e0048",
      paths: [
        "src/data/hunters.json",
        "src/data/ryodan.json",
        "src/data/chimeraAnts.json",
      ],
      note:
        "Pinned static community dataset with Hunters, Phantom Troupe, Chimera Ants, Nen types, abilities, professions and family fields. Mandatory reproducible seed.",
    },
    {
      id: "jikan-hxh-2011-cast",
      adapter: "jikan-anime-cast-v1",
      role: "supporting",
      sourceUrl: "https://jikan.moe/",
      endpoint: "https://api.jikan.moe/v4/anime/11061/characters",
      note:
        "Optional online cast enrichment only. Never required for deterministic Source World installation.",
    },
    {
      id: "hxh-api-rich",
      adapter: "hxh-api-rich-v1",
      role: "supporting",
      sourceUrl: "https://github.com/akocero/node_hxh_api",
      repository: "akocero/node_hxh_api",
      ref: "5d6e33f59e49129fd544ee9f744833d7d5922707",
      note:
        "Rich community API advertises ~248 characters, groups and Nen fields; requires API key, so catalogued as later enrichment rather than mandatory import.",
    },
  ]
};

export const SOURCE_WORLD_CATALOG: readonly SourceWorldCatalogEntry[] = [
  NARUTO,
  ONE_PIECE,
  BLEACH,
  HUNTER_X_HUNTER,
];

export function getSourceWorldCatalogEntry(
  reference: string,
): SourceWorldCatalogEntry | null {
  const normalized = reference.trim().toLowerCase();
  return (
    SOURCE_WORLD_CATALOG.find(
      (entry) =>
        entry.id === normalized ||
        entry.name.toLowerCase() === normalized ||
        entry.aliases.some((alias) => alias.toLowerCase() === normalized),
    ) ?? null
  );
}
