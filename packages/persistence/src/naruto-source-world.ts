import type {
  WorldAtlasCognitiveMother,
  WorldAtlasReaderSemantics,
} from "@narralume/contracts";
import type { NarrativeDatabase } from "./database.js";
import {
  NARUTO_DATTEBAYO_CORPUS,
  NARUTO_WIKI_CORPUS,
} from "./naruto-source-import.js";
import {
  SqliteSourceCorpusRepository,
  type SourceRecord,
  type SourceRelationView,
} from "./source-corpus-repository.js";
import {
  SqliteUnifiedSourceWorldRepository,
  type SourceWorld,
} from "./unified-source-world-repository.js";

export const NARUTO_SOURCE_WORLD_ID = "naruto";
export const NARUTO_CANONICAL_CORPUS = "wiki:naruto";

export const NARUTO_COGNITIVE_MOTHER: WorldAtlasCognitiveMother = {
  summary:
    "目标 Reader 通常不是从空白进入火影世界，而是预装了忍村、忍族、任务、师承、查克拉、忍术、血继限界、尾兽与忍界战争等关系语法，并会天然给少数高阶力量、身份与原作人物更高价格。",
  preloadedWorldGrammar: [
    "忍者以忍村、忍族、队伍、师承和任务体系组织职业生活",
    "查克拉与忍术构成公共力量底盘，血继限界、秘术与禁术形成稀缺分层",
    "忍村之间存在军事与政治竞争，战争历史会持续改变人物关系和资源价格",
    "人物的老师、队友、家族、职位和任务经历会自然决定其社会入口与行动权限",
  ],
  priceLogic: [
    "血继限界、顶级瞳术、尾兽、禁术与少数顶尖忍者天然高价",
    "火影、族长、上忍、暗部等身份同时意味着能力价格与社会权限",
    "原作核心人物、重大组织和著名历史节点自带 Reader 注意力与期待势能",
  ],
  naturalEntrances: [
    "忍者学校与毕业分班",
    "任务委托与任务队伍",
    "忍族内部关系与师承",
    "医院、警务、暗部、研究与后勤等职业系统",
    "战争伤员、边境任务与村际外交",
  ],
  expectedInertia: [
    "忍村政治、忍族利益和战争历史不会因为主角出现而自动消失",
    "既有人物仍会按照自己的身份、关系、职责和历史处境行动",
    "原作未来只是反事实惯性与 Reader 期待；Project Reality 改变条件后不得反压当前事实",
  ],
  attentionLogic: [
    "低位人物获得明显超出身份常识的能力、资源或权限会迅速引发注意",
    "非传统持有者接触高价血继、禁术、尾兽或核心政治资源会形成强异常",
    "主角若改变知名人物的既定命运、关系或重大历史节点，Reader 会立刻重新定价未来",
  ],
  basis: "author_judgment",
  sourceNote:
    "Reader-side mother-world prior for commercial Naruto fanfiction; not objective Source Canon.",
};

export interface NarutoSourceWorldInstallReport {
  worldId: string;
  canonicalCorpusId: string;
  sourceRecords: number;
  createdCards: number;
  preservedCards: number;
  canonicalRelations: number;
  evidenceLinks: number;
  evidenceCorpora: string[];
  cognitiveMother: boolean;
  seededReaderSemantics: string[];
}

/**
 * Turn the imported Naruto evidence corpora into one reusable curated Source
 * World Atlas. The Dattebayo record ID is reused as the canonical stable key,
 * but its assertion remains evidence, not official franchise truth.
 *
 * Existing author-edited Source cards are NEVER overwritten on re-run.
 */
export function installNarutoSourceWorld(
  db: NarrativeDatabase,
  now = new Date().toISOString(),
): NarutoSourceWorldInstallReport {
  const sources = new SqliteSourceCorpusRepository(db);
  const worlds = new SqliteUnifiedSourceWorldRepository(db);
  const dattebayo = sources.getCorpus(NARUTO_DATTEBAYO_CORPUS);
  if (!dattebayo)
    throw new Error("naruto.source_world.dattebayo_missing");

  return db.transaction(() => {
    let world = worlds.getWorld(NARUTO_SOURCE_WORLD_ID);
    let canonical = sources.getCorpus(NARUTO_CANONICAL_CORPUS);
    if (!canonical) {
      sources.upsertCorpus({
        id: NARUTO_CANONICAL_CORPUS,
        title: "火影忍者：统一原生母体 Atlas",
        sourceUrl: "",
        rightsNotice:
          "Curated local projection of separately licensed Naruto community source corpora. Raw evidence keeps its original provenance.",
        importer: "naruto-source-world-v1",
        metadata: {
          worldId: NARUTO_SOURCE_WORLD_ID,
          seedPolicy:
            "Dattebayo records are projected as reviewable Source reference cards; Wiki biographies remain separate supporting evidence unless explicitly mapped.",
        },
        importedAt: now,
      });
      canonical = sources.getCorpus(NARUTO_CANONICAL_CORPUS);
    }
    if (!canonical)
      throw new Error("naruto.source_world.canonical_corpus_failed");

    if (!world) {
      const created: SourceWorld = {
        id: NARUTO_SOURCE_WORLD_ID,
        name: "火影忍者",
        kind: "fictional",
        canonicalCorpusId: NARUTO_CANONICAL_CORPUS,
        description:
          "可被多本火影同人反复 Fork 的统一原生母体。Source evidence、Reader 认知母体与单书 Project Reality 分权保存。",
        createdAt: now,
      };
      worlds.createWorld(created);
      world = created;
    } else if (world.canonicalCorpusId !== NARUTO_CANONICAL_CORPUS) {
      throw new Error("naruto.source_world.canonical_corpus_conflict");
    }

    worlds.addEvidenceCorpus({
      worldId: NARUTO_SOURCE_WORLD_ID,
      corpusId: NARUTO_DATTEBAYO_CORPUS,
      evidenceRole: "primary",
      sourceNote:
        "Primary structured evidence projection. Mixed franchise media and all-time records; not a dated Project Reality.",
    });
    const wiki = sources.getCorpus(NARUTO_WIKI_CORPUS);
    if (wiki)
      worlds.addEvidenceCorpus({
        worldId: NARUTO_SOURCE_WORLD_ID,
        corpusId: NARUTO_WIKI_CORPUS,
        evidenceRole: "supporting",
        sourceNote:
          "Long-form character biographies retained as separate supporting evidence. Same names are not auto-merged.",
      });

    if (!worlds.getCognitiveMother(NARUTO_SOURCE_WORLD_ID))
      worlds.upsertCognitiveMother({
        worldId: NARUTO_SOURCE_WORLD_ID,
        cognitiveMother: NARUTO_COGNITIVE_MOTHER,
      });

    const records = listAllActiveRecords(sources, NARUTO_DATTEBAYO_CORPUS);
    const created = new Set<string>();
    let preservedCards = 0;

    // Phase 1: establish every stable identity first, with no typed links.
    for (const record of records) {
      if (sources.getRecord(NARUTO_CANONICAL_CORPUS, record.sourceKey)) {
        preservedCards += 1;
        continue;
      }
      worlds.upsertCard({
        worldId: NARUTO_SOURCE_WORLD_ID,
        entityKey: record.sourceKey,
        kind: record.kind,
        name: record.name,
        aliases: record.aliases,
        content: renderNarutoSourceCard(record, []),
        now,
      });
      created.add(record.sourceKey);
    }

    // Phase 2: only fresh seed cards receive the current evidence relations.
    // Existing cards may have been manually curated, so re-import never rewrites
    // their Markdown truth.
    for (const record of records) {
      if (!created.has(record.sourceKey)) continue;
      const relations = sources
        .listRelations(NARUTO_DATTEBAYO_CORPUS, record.sourceKey)
        .filter((edge) => edge.direction === "out");
      worlds.upsertCard({
        worldId: NARUTO_SOURCE_WORLD_ID,
        entityKey: record.sourceKey,
        kind: record.kind,
        name: record.name,
        aliases: record.aliases,
        content: renderNarutoSourceCard(record, relations),
        now,
      });
    }

    // The identity mapping is mechanical and reviewable. "verified" here means
    // the canonical card was deliberately projected from this exact evidence
    // key; it does NOT upgrade the upstream claim to official franchise canon.
    for (const record of records)
      worlds.linkEvidence({
        worldId: NARUTO_SOURCE_WORLD_ID,
        canonicalKey: record.sourceKey,
        evidenceCorpusId: NARUTO_DATTEBAYO_CORPUS,
        evidenceKey: record.sourceKey,
        matchKind: "source_adaptation",
        reviewStatus: "verified",
        sourceNote:
          "Exact stable-key projection from Dattebayo into the curated Naruto Source World. Upstream assertion still requires provenance-aware use.",
        createdAt: now,
      });

    const seededReaderSemantics = seedNarutoReaderSemantics(worlds, now);

    const relationCount =
      sources.getCorpus(NARUTO_CANONICAL_CORPUS)?.relationCount ?? 0;
    const evidenceLinks = (
      db.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM source_world_evidence_links WHERE world_id=?",
        )
        .get(NARUTO_SOURCE_WORLD_ID) as { n: number }
    ).n;

    return {
      worldId: NARUTO_SOURCE_WORLD_ID,
      canonicalCorpusId: NARUTO_CANONICAL_CORPUS,
      sourceRecords: records.length,
      createdCards: created.size,
      preservedCards,
      canonicalRelations: relationCount,
      evidenceLinks,
      evidenceCorpora: [
        NARUTO_DATTEBAYO_CORPUS,
        ...(wiki ? [NARUTO_WIKI_CORPUS] : []),
      ],
      cognitiveMother: worlds.getCognitiveMother(NARUTO_SOURCE_WORLD_ID) !== null,
      seededReaderSemantics,
    };
  });
}

function listAllActiveRecords(
  sources: SqliteSourceCorpusRepository,
  corpusId: string,
): SourceRecord[] {
  const records: SourceRecord[] = [];
  for (let offset = 0; ; offset += 200) {
    const hits = sources.search("", { corpusId, limit: 200, offset });
    for (const hit of hits) {
      const record = sources.getRecord(corpusId, hit.sourceKey);
      if (record) records.push(record);
    }
    if (hits.length < 200) break;
  }
  return records;
}

function renderNarutoSourceCard(
  record: SourceRecord,
  relations: readonly SourceRelationView[],
): string {
  const lines = [
    `# ${record.name}`,
    "",
    "## Source Reference",
    `证据来源：${record.corpusId} / ${record.sourceKey}`,
    `来源集合：${record.originCollection}`,
    record.sourceUrl ? `来源地址：${record.sourceUrl}` : "",
    "状态：上游 Source assertion 的整理投影；不是单书 Project Reality，也不代表官方资料书已独立核验。",
  ];
  if (record.summary) lines.push("", "## 上游摘要", record.summary);

  const rawLines = flattenRaw(record.raw);
  if (rawLines.length)
    lines.push("", "## 原始字段摘录", ...rawLines.map((line) => "- " + line));

  if (relations.length) {
    lines.push("", "## 已记录关系");
    for (const edge of relations)
      lines.push(
        `${edge.relation}：[[${edge.toKey}|${edge.otherName}]]`,
      );
  }
  return lines.filter((line) => line !== "").join("\n\n").replace(/\n\n- /g, "\n- ");
}

function flattenRaw(raw: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const add = (path: string, value: unknown): void => {
    if (lines.length >= 40) return;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value).trim();
      if (text) lines.push(`${path}: ${text.slice(0, 500)}`);
      return;
    }
    if (Array.isArray(value)) {
      const primitives = value
        .filter(
          (item) =>
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean",
        )
        .slice(0, 12)
        .map(String);
      if (primitives.length)
        lines.push(`${path}: ${primitives.join("、").slice(0, 900)}`);
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>,
      ).slice(0, 20))
        add(path ? `${path}.${key}` : key, child);
    }
  };
  for (const [key, value] of Object.entries(raw).slice(0, 30)) add(key, value);
  return lines;
}

function seedNarutoReaderSemantics(
  worlds: SqliteUnifiedSourceWorldRepository,
  now: string,
): string[] {
  const seeds: Array<[string, WorldAtlasReaderSemantics]> = [
    [
      "Konohagakure",
      {
        readerPrice:
          "木叶是火影最核心的长期舞台之一，政治、忍族、师承、任务与大量高价人物高度密集。",
        preloadedExpectations: ["火影体系", "忍族政治", "任务与师承", "木叶核心人物"],
        familiarRelations: ["忍村与忍族", "火影与上忍", "老师与队伍"],
        naturalEntrances: ["忍者学校", "任务体系", "医院", "忍族", "行政与暗部"],
        attentionTriggers: ["低位人物突然获得高阶权限", "改变木叶重大历史节点"],
        basis: "author_judgment",
        sourceNote: "Reader-side Naruto fanfiction pricing; not Source objective fact.",
      },
    ],
    [
      "Uchiha",
      {
        readerPrice:
          "宇智波自带高价血继、强者密度与木叶政治冲突，是 Reader 会主动盯住的忍族资产。",
        preloadedExpectations: ["写轮眼", "族内强者", "木叶政治", "灭族历史"],
        familiarRelations: ["宇智波与木叶", "族人与写轮眼", "家族内部关系"],
        naturalEntrances: ["族人身份", "警务系统", "师承与队伍", "血继研究"],
        attentionTriggers: ["非传统写轮眼持有者", "灭族轨迹被改变", "族内权力重新定价"],
        basis: "author_judgment",
        sourceNote: "Reader-side Naruto fanfiction pricing; not Source objective fact.",
      },
    ],
    [
      "Sharingan",
      {
        readerPrice:
          "写轮眼是火影 Reader 已经预装为高价的标志性瞳术，能力成长、移植与持有者身份都会被立即定价。",
        preloadedExpectations: ["瞳术成长", "复制与洞察", "万花筒", "宇智波"],
        familiarRelations: ["写轮眼与宇智波", "瞳术与战斗", "移植与非宇智波持有者"],
        naturalEntrances: ["血继觉醒", "训练", "移植", "战斗与研究"],
        attentionTriggers: ["低位人物提前觉醒", "非宇智波者异常掌握", "突破已知进阶路径"],
        basis: "author_judgment",
        sourceNote: "Reader-side Naruto fanfiction pricing; not Source objective fact.",
      },
    ],
    [
      "Akatsuki",
      {
        readerPrice:
          "晓天然代表高危险、高战力和重大阴谋密度，Reader 会把接近、渗透或改变其成员关系视为昂贵事件。",
        preloadedExpectations: ["S级叛忍", "尾兽计划", "核心成员", "高强度战斗"],
        familiarRelations: ["晓成员之间", "晓与尾兽", "晓与各忍村"],
        naturalEntrances: ["叛忍网络", "情报追踪", "任务冲突", "卧底与招募"],
        attentionTriggers: ["提前接触核心成员", "改变成员命运", "低位人物被晓注意"],
        basis: "author_judgment",
        sourceNote: "Reader-side Naruto fanfiction pricing; not Source objective fact.",
      },
    ],
    [
      "Kurama",
      {
        readerPrice:
          "九尾是顶级尾兽资产，与人柱力、木叶安全和重大历史事件绑定，天然拥有极高 Reader 价格。",
        preloadedExpectations: ["九尾", "人柱力", "尾兽力量", "木叶灾难史"],
        familiarRelations: ["九尾与人柱力", "尾兽与忍村", "封印与力量"],
        naturalEntrances: ["封印体系", "人柱力关系", "尾兽研究", "战争与村级安全"],
        attentionTriggers: ["异常接触尾兽", "封印被改变", "人柱力命运偏离"],
        basis: "author_judgment",
        sourceNote: "Reader-side Naruto fanfiction pricing; not Source objective fact.",
      },
    ],
  ];

  const seeded: string[] = [];
  for (const [name, semantics] of seeds) {
    const matches = worlds
      .listCards(NARUTO_SOURCE_WORLD_ID, name, { limit: 5 })
      .filter((card) => card.name === name);
    if (matches.length !== 1) continue;
    const key = matches[0]!.sourceKey;
    if (worlds.getReaderSemantics(NARUTO_SOURCE_WORLD_ID, key)) continue;
    worlds.upsertReaderSemantics({
      worldId: NARUTO_SOURCE_WORLD_ID,
      entityKey: key,
      semantics,
      now,
    });
    seeded.push(key);
  }
  return seeded;
}
