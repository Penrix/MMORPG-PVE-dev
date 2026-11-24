import {
  BenchmarkDeconstructionSchema,
  BenchmarkIncubateRequestSchema,
  BenchmarkIncubateResponseSchema,
  BenchmarkProposalSchema,
  BenchmarkStrategySchema,
  MarketM03MaterialSchema,
  MarketM03MaterialTypeSchema,
  MarketRadarBooksResponseSchema,
  NewbookRankingEntrySchema,
  SaveMarketM03ResponseSchema,
  Tr01AnalyzeRequestSchema,
  Tr01AnalyzeResponseSchema,
  Tr01MacroTrendSchema,
  Tr01PatternItemSchema,
  type BenchmarkIncubateRequest,
  type BenchmarkIncubateResponse,
  type BenchmarkStrategy,
  type MarketBookPlatform,
  type MarketM03Material,
  type MarketPlatform,
  type MarketRadarBooksResponse,
  type NewbookRankingEntry,
  type SaveMarketM03Response,
  type Tr01AnalyzeRequest,
  type Tr01AnalyzeResponse,
} from "@narralume/contracts";
import {
  ModelGateway,
  createModelAdapter,
  type FetchLike,
  type JsonSchemaContract,
  type ModelRequest,
} from "@narralume/llm";
import {
  SqliteAssignmentRepository,
  SqliteRetrievalRepository,
  resolveCredential,
  type NarrativeDatabase,
} from "@narralume/persistence";
import { z } from "zod";
import { ServiceError } from "./service-error.js";

export interface RawNewbookRecord {
  id: string;
  platform: MarketBookPlatform;
  board: string;
  boardsSeen?: string[];
  category?: string;
  title: string;
  author?: string;
  intro?: string;
  url?: string;
  latestRank?: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount?: number;
}

export interface NewbookPoolSnapshot {
  updatedAt: string | null;
  snapshotDate: string | null;
  books: RawNewbookRecord[];
}

export type NewbookPoolLoader = () => NewbookPoolSnapshot;

export interface MarketRadarLlmOverrideInput {
  kind: "tr01" | "benchmark";
  prompt: string;
  responseSchema: JsonSchemaContract;
}

export type MarketRadarLlmOverride = (
  input: MarketRadarLlmOverrideInput,
) => Promise<unknown> | unknown;

export interface MarketRadarServiceOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  fetch?: FetchLike;
  loadNewbookPool?: NewbookPoolLoader;
  generateOverride?: MarketRadarLlmOverride;
  now?: () => Date;
}

export class MarketRadarModelUnavailableError extends ServiceError {
  constructor() {
    super(
      "market_radar.model_unavailable",
      "未配置可用的模型或凭证。请先在设置中配置并绑定写作/规划模型。",
      422,
    );
    this.name = "MarketRadarModelUnavailableError";
  }
}

export class MarketRadarEmptyPoolError extends ServiceError {
  constructor(message = "当前筛选条件下没有可分析的新书样本。") {
    super("market_radar.empty_pool", message, 422);
    this.name = "MarketRadarEmptyPoolError";
  }
}

export function parseNewbookJsonl(
  jsonlContent: string,
  statusJson?: string | null,
): NewbookPoolSnapshot {
  const books: RawNewbookRecord[] = [];
  for (const rawLine of jsonlContent.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as Partial<RawNewbookRecord>;
      if (
        typeof parsed.id === "string" &&
        typeof parsed.title === "string" &&
        (parsed.platform === "qidian" ||
          parsed.platform === "fanqie" ||
          parsed.platform === "ciweimao") &&
        typeof parsed.firstSeenAt === "string" &&
        typeof parsed.lastSeenAt === "string"
      ) {
        books.push({
          id: parsed.id,
          platform: parsed.platform,
          board: typeof parsed.board === "string" ? parsed.board : "新书榜",
          boardsSeen: Array.isArray(parsed.boardsSeen)
            ? parsed.boardsSeen.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          category:
            typeof parsed.category === "string" && parsed.category.trim()
              ? parsed.category.trim()
              : "未分类",
          title: parsed.title.trim(),
          author: typeof parsed.author === "string" ? parsed.author.trim() : "",
          intro: typeof parsed.intro === "string" ? parsed.intro.trim() : "",
          url: typeof parsed.url === "string" ? parsed.url.trim() : "",
          latestRank:
            typeof parsed.latestRank === "number" &&
            Number.isFinite(parsed.latestRank) &&
            parsed.latestRank > 0
              ? Math.round(parsed.latestRank)
              : null,
          firstSeenAt: parsed.firstSeenAt,
          lastSeenAt: parsed.lastSeenAt,
          seenCount:
            typeof parsed.seenCount === "number" && parsed.seenCount > 0
              ? Math.round(parsed.seenCount)
              : 1,
        });
      }
    } catch {
      // Skip malformed line without breaking the pool.
    }
  }

  let updatedAt: string | null = null;
  let snapshotDate: string | null = null;
  if (statusJson) {
    try {
      const parsed = JSON.parse(statusJson) as {
        updatedAt?: unknown;
        snapshotDate?: unknown;
      };
      if (typeof parsed.updatedAt === "string") updatedAt = parsed.updatedAt;
      if (typeof parsed.snapshotDate === "string")
        snapshotDate = parsed.snapshotDate;
    } catch {
      // Ignore invalid status JSON.
    }
  }
  if (!snapshotDate && books.length > 0) {
    snapshotDate =
      books
        .map((book) => book.lastSeenAt)
        .sort()
        .at(-1) ?? null;
  }

  return { updatedAt, snapshotDate, books };
}

function daysBetweenIsoDates(olderIso: string, referenceIso: string): number {
  const older = Date.parse(olderIso.slice(0, 10));
  const ref = Date.parse(referenceIso.slice(0, 10));
  if (!Number.isFinite(older) || !Number.isFinite(ref)) return 0;
  return Math.max(0, Math.round((ref - older) / 86_400_000));
}

function enrichBookEntry(
  raw: RawNewbookRecord,
  referenceDate: string,
): NewbookRankingEntry {
  const daysSinceLastSeen = daysBetweenIsoDates(raw.lastSeenAt, referenceDate);
  const daysSinceFirstSeen = daysBetweenIsoDates(
    raw.firstSeenAt,
    referenceDate,
  );
  const freshness =
    daysSinceLastSeen <= 7 ? 1.5 : daysSinceLastSeen <= 14 ? 1.25 : 1.0;
  const rankBoost =
    raw.latestRank !== null && raw.latestRank !== undefined
      ? raw.latestRank <= 10
        ? 0.6
        : raw.latestRank <= 30
          ? 0.35
          : 0.15
      : 0.1;
  const multiBoardBoost = Math.min(
    0.4,
    Math.max(0, (raw.boardsSeen?.length ?? 1) - 1) * 0.2,
  );
  const debutBoost = daysSinceFirstSeen <= 14 ? 0.2 : 0;
  const trendWeight = Number(
    (freshness + rankBoost + multiBoardBoost + debutBoost).toFixed(2),
  );
  const trendLabel =
    trendWeight >= 2.1 ? "hot" : trendWeight >= 1.65 ? "rising" : "steady";

  return NewbookRankingEntrySchema.parse({
    id: raw.id,
    platform: raw.platform,
    board: raw.board,
    boardsSeen:
      raw.boardsSeen && raw.boardsSeen.length > 0
        ? raw.boardsSeen
        : [raw.board],
    category: raw.category || "未分类",
    title: raw.title,
    author: raw.author ?? "",
    intro: raw.intro ?? "",
    url: raw.url ?? "",
    latestRank: raw.latestRank ?? null,
    firstSeenAt: raw.firstSeenAt,
    lastSeenAt: raw.lastSeenAt,
    seenCount: raw.seenCount ?? 1,
    trendWeight,
    trendLabel,
    daysSinceLastSeen,
  });
}

export interface ListMarketBooksFilter {
  windowDays?: number;
  platform?: MarketPlatform;
  category?: string;
  search?: string;
  limit?: number;
}

export function listMarketRadarBooks(
  database: NarrativeDatabase,
  pool: NewbookPoolSnapshot,
  filter: ListMarketBooksFilter = {},
  now: Date = new Date(),
): MarketRadarBooksResponse {
  const windowDays = filter.windowDays ?? 14;
  const platform = filter.platform ?? "all";
  const category = filter.category?.trim() || "";
  const search = filter.search?.trim().toLowerCase() || "";
  const limit = Math.max(1, Math.min(filter.limit ?? 120, 300));

  const referenceDate = pool.snapshotDate ?? now.toISOString().slice(0, 10);
  const enrichedAll = pool.books.map((book) =>
    enrichBookEntry(book, referenceDate),
  );

  const byPlatform: Record<string, number> = {
    qidian: 0,
    fanqie: 0,
    ciweimao: 0,
  };
  const categoryCounts = new Map<string, number>();

  for (const book of enrichedAll) {
    byPlatform[book.platform] = (byPlatform[book.platform] ?? 0) + 1;
    const baseCategory = book.category.split("·")[0]?.trim() || book.category;
    categoryCounts.set(
      baseCategory,
      (categoryCounts.get(baseCategory) ?? 0) + 1,
    );
  }

  const filtered = enrichedAll
    .filter((book) => {
      if (windowDays > 0 && book.daysSinceLastSeen > windowDays) return false;
      if (platform !== "all" && book.platform !== platform) return false;
      if (category && !book.category.includes(category)) return false;
      if (search) {
        const haystack =
          `${book.title} ${book.author} ${book.category} ${book.intro}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b.trendWeight !== a.trendWeight) return b.trendWeight - a.trendWeight;
      const rankA = a.latestRank ?? 9999;
      const rankB = b.latestRank ?? 9999;
      if (rankA !== rankB) return rankA - rankB;
      return a.title.localeCompare(b.title, "zh-Hans-CN");
    });

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([name, count]) => ({ category: name, count }));

  const storedM03TrendCount = countActiveMarketM03Materials(database);

  return MarketRadarBooksResponseSchema.parse({
    status: {
      updatedAt: pool.updatedAt,
      snapshotDate: pool.snapshotDate,
      totalBooks: enrichedAll.length,
      filteredBooks: filtered.length,
      windowDays,
      byPlatform,
      topCategories,
      storedM03TrendCount,
    },
    books: filtered.slice(0, limit),
  });
}

interface MarketTrendMaterialRow {
  id: string;
  material_type: string;
  name: string;
  summary: string;
  tags_json: string;
  evidence_titles_json: string;
  trend_weight: number;
  market_window: string;
  platform: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function countActiveMarketM03Materials(
  database: NarrativeDatabase,
): number {
  const row = database.raw
    .prepare(
      "SELECT COUNT(*) AS count FROM market_trend_materials WHERE status = 'active'",
    )
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}

export function listMarketM03Materials(
  database: NarrativeDatabase,
  limit = 60,
): MarketM03Material[] {
  const rows = database.raw
    .prepare(
      `SELECT id, material_type, name, summary, tags_json, evidence_titles_json,
              trend_weight, market_window, platform, status, created_at, updated_at
         FROM market_trend_materials
        WHERE status = 'active'
        ORDER BY trend_weight DESC, updated_at DESC, id
        LIMIT ?`,
    )
    .all(limit) as unknown as MarketTrendMaterialRow[];
  return rows.map((row) =>
    MarketM03MaterialSchema.parse({
      id: row.id,
      materialType: safeMaterialType(row.material_type),
      name: row.name,
      summary: row.summary,
      tags: safeStringArray(row.tags_json),
      evidenceTitles: safeStringArray(row.evidence_titles_json),
      trendWeight: row.trend_weight,
      marketWindow: row.market_window,
      platform: safePlatform(row.platform),
      status: row.status === "archived" ? "archived" : "active",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export function saveMarketM03Materials(
  database: NarrativeDatabase,
  cards: readonly MarketM03Material[],
  nowIso: string = new Date().toISOString(),
): SaveMarketM03Response {
  let savedCount = 0;
  database.transaction(() => {
    const stmt = database.raw.prepare(
      `INSERT INTO market_trend_materials (
         id, material_type, name, summary, tags_json, evidence_titles_json,
         trend_weight, market_window, platform, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         material_type = excluded.material_type,
         name = excluded.name,
         summary = excluded.summary,
         tags_json = excluded.tags_json,
         evidence_titles_json = excluded.evidence_titles_json,
         trend_weight = excluded.trend_weight,
         market_window = excluded.market_window,
         platform = excluded.platform,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    );
    for (const raw of cards) {
      const card = MarketM03MaterialSchema.parse(raw);
      stmt.run(
        card.id,
        card.materialType,
        card.name,
        card.summary,
        JSON.stringify(card.tags),
        JSON.stringify(card.evidenceTitles),
        card.trendWeight,
        card.marketWindow,
        card.platform,
        card.status,
        card.createdAt ?? nowIso,
        nowIso,
      );
      savedCount += 1;
    }
  });
  return SaveMarketM03ResponseSchema.parse({
    savedCount,
    totalActiveCount: countActiveMarketM03Materials(database),
  });
}

export function seedMarketM03IntoProject(
  database: NarrativeDatabase,
  projectId: string,
  nowIso: string = new Date().toISOString(),
): number {
  const materials = listMarketM03Materials(database, 40);
  if (materials.length === 0) return 0;
  const retrieval = new SqliteRetrievalRepository(database);
  let seeded = 0;
  for (const card of materials) {
    const searchable = [
      "素材库：M03",
      `组件类型：${card.materialType}`,
      "状态：active",
      `流行风口权重：${card.trendWeight}（窗口：${card.marketWindow}）`,
      `摘要：${card.summary}`,
      card.tags.length > 0 ? `标签：${card.tags.join("、")}` : null,
      card.evidenceTitles.length > 0
        ? `新书榜例证：${card.evidenceTitles.join("、")}`
        : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    retrieval.upsertSegment({
      id: `creative-material:M03:${card.id}:${projectId}`,
      projectId,
      sourceType: "creative_material",
      sourceId: `M03:${card.id}`,
      title: `M03 ${card.id}｜${card.name}`,
      content: searchable,
      authority: "reference",
      metadata: {
        libraryId: "M03",
        materialId: card.id,
        materialType: card.materialType,
        status: "active",
        summary: card.summary,
        tags: card.tags,
        evidenceTitles: card.evidenceTitles,
        trendWeight: card.trendWeight,
        marketWindow: card.marketWindow,
        sourcePath: `market-radar/tr01/${card.id}`,
        curationStage: "market-trend-high-weight",
      },
      entityIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    seeded += 1;
  }
  return seeded;
}

const RawTr01OutputSchema = z.object({
  macroTrends: z.array(Tr01MacroTrendSchema).min(1).max(8),
  mesoPatterns: z.object({
    goldenFingerFormulas: z.array(Tr01PatternItemSchema).min(1).max(8),
    protagonistFormulas: z.array(Tr01PatternItemSchema).min(1).max(8),
    openingHooks: z.array(Tr01PatternItemSchema).min(1).max(8),
  }),
  m03Cards: z
    .array(
      z.object({
        materialType: MarketM03MaterialTypeSchema,
        name: z.string().trim().min(2).max(80),
        summary: z.string().trim().min(8).max(400),
        tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
        evidenceTitles: z.array(z.string().trim().min(1)).min(1).max(6),
        trendWeight: z.number().min(1.0).max(3.0).default(2.0),
      }),
    )
    .min(3)
    .max(20),
});

const TR01_JSON_CONTRACT: JsonSchemaContract = {
  name: "market_radar_tr01_analysis",
  description:
    "TR-I-01 v4.2 three-layer funnel market trend analysis and M03 material extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["macroTrends", "mesoPatterns", "m03Cards"],
    properties: {
      macroTrends: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "readerDemandGap",
            "whyHotNow",
            "weight",
            "evidenceTitles",
          ],
          properties: {
            name: { type: "string", minLength: 2, maxLength: 80 },
            readerDemandGap: { type: "string", minLength: 6, maxLength: 240 },
            whyHotNow: { type: "string", minLength: 6, maxLength: 260 },
            weight: { type: "string", enum: ["high", "medium"] },
            evidenceTitles: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: { type: "string" },
            },
          },
        },
      },
      mesoPatterns: {
        type: "object",
        additionalProperties: false,
        required: [
          "goldenFingerFormulas",
          "protagonistFormulas",
          "openingHooks",
        ],
        properties: {
          goldenFingerFormulas: patternArraySchema(),
          protagonistFormulas: patternArraySchema(),
          openingHooks: patternArraySchema(),
        },
      },
      m03Cards: {
        type: "array",
        minItems: 6,
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "materialType",
            "name",
            "summary",
            "tags",
            "evidenceTitles",
            "trendWeight",
          ],
          properties: {
            materialType: {
              type: "string",
              enum: [
                "金手指形态",
                "核心爽点",
                "主角人设",
                "情绪钩子",
                "世界奇观",
              ],
            },
            name: { type: "string", minLength: 2, maxLength: 80 },
            summary: { type: "string", minLength: 8, maxLength: 400 },
            tags: {
              type: "array",
              maxItems: 8,
              items: { type: "string" },
            },
            evidenceTitles: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: { type: "string" },
            },
            trendWeight: { type: "number", minimum: 1.0, maximum: 3.0 },
          },
        },
      },
    },
  },
};

export async function analyzeMarketTrendsWithTr01(
  database: NarrativeDatabase,
  pool: NewbookPoolSnapshot,
  rawInput: Tr01AnalyzeRequest,
  options: MarketRadarServiceOptions = {},
): Promise<Tr01AnalyzeResponse> {
  const input = Tr01AnalyzeRequestSchema.parse(rawInput);
  const now = options.now ? options.now() : new Date();
  const nowIso = now.toISOString();

  const listing = listMarketRadarBooks(
    database,
    pool,
    {
      windowDays: input.windowDays,
      platform: input.platform,
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.search === undefined ? {} : { search: input.search }),
      limit: 200,
    },
    now,
  );

  const selectedBooks = input.bookIds?.length
    ? listing.books.filter((book) => input.bookIds!.includes(book.id))
    : listing.books.slice(0, input.sampleLimit);

  if (selectedBooks.length === 0) {
    throw new MarketRadarEmptyPoolError();
  }

  const windowLabel =
    input.windowDays > 0 ? `最近 ${input.windowDays} 天新书` : "全量新书库";
  const prompt = buildTr01Prompt(selectedBooks, windowLabel, input.platform);

  const { data: rawOutput, modelId } = await runStructuredModel(
    database,
    "tr01",
    "你是男频网文市场首席数据分析师，严格执行 TR-I-01 v4.2 三层漏斗分析法。所有结论必须直接从输入的新书榜样本提炼，不得编造未出现的书名，不得空泛套话。",
    prompt,
    TR01_JSON_CONTRACT,
    RawTr01OutputSchema,
    options,
  );

  const dateTag = nowIso.slice(0, 10).replace(/-/gu, "");
  const m03Cards: MarketM03Material[] = rawOutput.m03Cards.map((card, idx) =>
    MarketM03MaterialSchema.parse({
      id: `TR01-${dateTag}-${idx + 1}-${slugHash(card.name)}`,
      materialType: card.materialType,
      name: card.name,
      summary: card.summary,
      tags: card.tags,
      evidenceTitles: card.evidenceTitles,
      trendWeight: Number(card.trendWeight.toFixed(2)),
      marketWindow: windowLabel,
      platform: input.platform,
      status: "active",
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
  );

  let savedToM03Count = 0;
  if (input.autoSaveM03) {
    savedToM03Count = saveMarketM03Materials(
      database,
      m03Cards,
      nowIso,
    ).savedCount;
  }

  return Tr01AnalyzeResponseSchema.parse({
    analyzedAt: nowIso,
    windowLabel,
    platform: input.platform,
    analyzedBookCount: selectedBooks.length,
    modelId,
    macroTrends: rawOutput.macroTrends,
    mesoPatterns: rawOutput.mesoPatterns,
    m03Cards,
    savedToM03Count,
  });
}

const RawBenchmarkOutputSchema = z.object({
  benchmarkDeconstruction: BenchmarkDeconstructionSchema,
  proposals: z
    .array(
      BenchmarkProposalSchema.omit({ id: true }).extend({
        strategy: BenchmarkStrategySchema,
      }),
    )
    .min(1)
    .max(5),
});

function benchmarkJsonContract(count: number): JsonSchemaContract {
  return {
    name: "benchmark_micro_innovation_proposals",
    description:
      "Benchmark book single-demand deconstruction and micro-innovation newbook proposals",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["benchmarkDeconstruction", "proposals"],
      properties: {
        benchmarkDeconstruction: {
          type: "object",
          additionalProperties: false,
          required: [
            "benchmarkTitle",
            "targetAudience",
            "singleCoreDemand",
            "corePayoffMechanism",
            "supportingReactionLoop",
            "openingHookPattern",
          ],
          properties: {
            benchmarkTitle: { type: "string", minLength: 1, maxLength: 160 },
            targetAudience: { type: "string", minLength: 4, maxLength: 240 },
            singleCoreDemand: { type: "string", minLength: 4, maxLength: 260 },
            corePayoffMechanism: {
              type: "string",
              minLength: 6,
              maxLength: 320,
            },
            supportingReactionLoop: {
              type: "string",
              minLength: 6,
              maxLength: 320,
            },
            openingHookPattern: {
              type: "string",
              minLength: 6,
              maxLength: 320,
            },
          },
        },
        proposals: {
          type: "array",
          minItems: 1,
          maxItems: Math.max(1, count),
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "strategy",
              "strategyLabel",
              "suggestedTitle",
              "oneLineHook",
              "preservedDemand",
              "noveltyShift",
              "targetWorldSetting",
              "protagonistIdentity",
              "goldenFinger",
              "goldenFingerGuardrail",
              "firstThreeChaptersPlan",
              "m03TrendTags",
              "riskCheck",
            ],
            properties: {
              strategy: {
                type: "string",
                enum: [
                  "reskin_world",
                  "reskin_identity",
                  "hardcore_graft",
                  "contrast_cheat",
                  "character_contrast",
                ],
              },
              strategyLabel: { type: "string", minLength: 2, maxLength: 40 },
              suggestedTitle: { type: "string", minLength: 2, maxLength: 100 },
              oneLineHook: { type: "string", minLength: 10, maxLength: 280 },
              preservedDemand: {
                type: "string",
                minLength: 6,
                maxLength: 260,
              },
              noveltyShift: { type: "string", minLength: 6, maxLength: 320 },
              targetWorldSetting: {
                type: "string",
                minLength: 4,
                maxLength: 260,
              },
              protagonistIdentity: {
                type: "string",
                minLength: 4,
                maxLength: 220,
              },
              goldenFinger: { type: "string", minLength: 4, maxLength: 280 },
              goldenFingerGuardrail: {
                type: "string",
                minLength: 6,
                maxLength: 260,
              },
              firstThreeChaptersPlan: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: { type: "string", minLength: 6, maxLength: 260 },
              },
              m03TrendTags: {
                type: "array",
                maxItems: 6,
                items: { type: "string" },
              },
              riskCheck: { type: "string", minLength: 6, maxLength: 260 },
            },
          },
        },
      },
    },
  };
}

export async function incubateBenchmarkProposals(
  database: NarrativeDatabase,
  pool: NewbookPoolSnapshot,
  rawInput: BenchmarkIncubateRequest,
  options: MarketRadarServiceOptions = {},
): Promise<BenchmarkIncubateResponse> {
  const input = BenchmarkIncubateRequestSchema.parse(rawInput);
  const now = options.now ? options.now() : new Date();
  const nowIso = now.toISOString();

  let benchmarkSource: {
    bookId: string | null;
    title: string;
    platform: string;
    category: string;
    intro: string;
  };

  if (input.bookId) {
    const found = pool.books.find((book) => book.id === input.bookId);
    if (!found) {
      throw new MarketRadarEmptyPoolError(
        `未在新书库中找到对标书：${input.bookId}`,
      );
    }
    benchmarkSource = {
      bookId: found.id,
      title: found.title,
      platform: found.platform,
      category: found.category || "未分类",
      intro: found.intro || "",
    };
  } else if (input.customTitle) {
    benchmarkSource = {
      bookId: null,
      title: input.customTitle,
      platform: input.customPlatform ?? "custom",
      category: input.customCategory || "自定义对标",
      intro: input.customIntro || "",
    };
  } else {
    throw new MarketRadarEmptyPoolError(
      "请先从新书榜选择一本对标书，或填写自定义对标书名与简介。",
    );
  }

  const activeTrends = input.useM03Trends
    ? listMarketM03Materials(database, 12)
    : [];

  const prompt = buildBenchmarkPrompt({
    source: benchmarkSource,
    ...(input.publicChapterExcerpt === undefined
      ? {}
      : { excerpt: input.publicChapterExcerpt }),
    strategy: input.strategy,
    ...(input.targetWorld === undefined
      ? {}
      : { targetWorld: input.targetWorld }),
    ...(input.targetIdentityHint === undefined
      ? {}
      : { targetIdentityHint: input.targetIdentityHint }),
    proposalCount: input.proposalCount,
    activeTrends,
  });

  const { data: rawOutput, modelId } = await runStructuredModel(
    database,
    "benchmark",
    "你是资深男频商业网文主编与开书策划。你严格遵循“锁定对标书单一核心读者需求 + 微创新换壳”的爆款孵化方法，以及金手指平衡编辑铁律，绝不输出泛泛空话或违背单一需求的缝合怪。",
    prompt,
    benchmarkJsonContract(input.proposalCount),
    RawBenchmarkOutputSchema,
    options,
  );

  const proposals = rawOutput.proposals.map((item, idx) =>
    BenchmarkProposalSchema.parse({
      ...item,
      id: `proposal-${idx + 1}-${slugHash(item.suggestedTitle)}`,
    }),
  );

  return BenchmarkIncubateResponseSchema.parse({
    incubatedAt: nowIso,
    modelId,
    benchmarkSource,
    benchmarkDeconstruction: rawOutput.benchmarkDeconstruction,
    appliedM03Trends: activeTrends.map((trend) => ({
      id: trend.id,
      materialType: trend.materialType,
      name: trend.name,
      trendWeight: trend.trendWeight,
    })),
    proposals,
  });
}

async function runStructuredModel<T>(
  database: NarrativeDatabase,
  kind: "tr01" | "benchmark",
  instructions: string,
  prompt: string,
  responseSchema: JsonSchemaContract,
  validatorSchema: z.ZodType<T>,
  options: MarketRadarServiceOptions,
): Promise<{ data: T; modelId: string }> {
  if (options.generateOverride) {
    const raw = await options.generateOverride({
      kind,
      prompt,
      responseSchema,
    });
    return {
      data: validatorSchema.parse(raw),
      modelId: "override-test-model",
    };
  }

  const assignments = new SqliteAssignmentRepository(database);
  const resolved =
    assignments.resolve("planning") ?? assignments.resolve("writing");
  if (!resolved) throw new MarketRadarModelUnavailableError();

  const credential = resolveCredential(
    resolved.provider,
    options.environment ?? {},
  );
  if (!credential.ok) throw new MarketRadarModelUnavailableError();

  const gateway = new ModelGateway(
    createModelAdapter({
      protocol: resolved.provider.wireApi,
      baseUrl: resolved.provider.baseUrl,
      apiKey: credential.apiKey,
      ...(resolved.provider.endpoint === null
        ? {}
        : { endpoint: resolved.provider.endpoint }),
      ...(resolved.provider.anthropicVersion === null
        ? {}
        : { anthropicVersion: resolved.provider.anthropicVersion }),
      headers: resolved.provider.headers,
      queryParams: resolved.provider.queryParams,
      ...(resolved.provider.requestStartTimeoutMs === null
        ? {}
        : { requestStartTimeoutMs: resolved.provider.requestStartTimeoutMs }),
      ...(resolved.provider.streamIdleTimeoutMs === null
        ? {}
        : { streamIdleTimeoutMs: resolved.provider.streamIdleTimeoutMs }),
      timeoutMs: 90_000,
      maxRetries: 1,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }),
  );

  const modelRequest: ModelRequest = {
    model: resolved.model.modelId,
    instructions,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.65,
    maxOutputTokens: Math.min(resolved.model.maxOutputTokens ?? 10_000, 14_000),
    responseSchema,
  };

  const structured = await gateway.generateStructured(
    modelRequest,
    (value) => {
      const parsed = validatorSchema.safeParse(value);
      return parsed.success
        ? { success: true as const, data: parsed.data }
        : {
            success: false as const,
            issues: parsed.error.issues.map(
              (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
            ),
          };
    },
    { maxRepairAttempts: 1 },
  );

  return { data: structured.value, modelId: resolved.model.modelId };
}

function buildTr01Prompt(
  books: readonly NewbookRankingEntry[],
  windowLabel: string,
  platform: MarketPlatform,
): string {
  const sampleLines = books.map((book, idx) => {
    const cleanIntro = book.intro.replace(/\s+/gu, " ").slice(0, 260);
    return [
      `[${idx + 1}] 《${book.title}》 | 平台:${book.platform} | 榜:${book.board} | 分类:${book.category} | 排名:${book.latestRank ?? "-"} | 权重:${book.trendWeight}`,
      `简介：${cleanIntro || "（无简介）"}`,
    ].join("\n");
  });

  return [
    `请对以下 ${books.length} 本【${windowLabel}】（平台筛选：${platform}）男频真实新书榜样本执行 TR-I-01 v4.2 三层漏斗解码：`,
    "",
    "【分析铁律】",
    "1. 从案例到模式：不要简单罗列书名，必须提炼出可复用、可组合的底层套路与情绪缺口。",
    "2. 严格举证：每条宏观趋势、中观公式、M03 素材卡都必须在 evidenceTitles 中引用样本里真实出现过的书名。",
    "3. 男频商业导向：高权重（trendWeight 2.0~2.8）优先给近期上榜频繁、情绪缺口直接、爽点可落地、适合二次组合的元素。",
    "4. 微观 M03 素材卡请产出 8~14 张，覆盖「金手指形态」「核心爽点」「主角人设」「情绪钩子」「世界奇观」，每张卡片必须写清怎么触发爽感/冲突，供下游 TR-02 与对标微创新直接调用。",
    "",
    "【真实男频新书榜样本】",
    sampleLines.join("\n\n"),
  ].join("\n");
}

const STRATEGY_GUIDE: Record<BenchmarkStrategy, string> = {
  multi:
    "请并行生成多个不同路线的微创新方案，至少覆盖：换皮流（换世界/换身份）、硬核植入法、以及身份反差金手指/人物反差切入，方便作者横向挑最对味的。",
  reskin_world:
    "聚焦【换皮流·换世界/换地图】：100% 锁死对标书被市场验证过的单一读者需求与爽点结构，但彻底换到一个全新舞台或作者指定的同人/历史世界。",
  reskin_identity:
    "聚焦【换皮流·换主角身份】：保留对标书核心爽点与世界类型，但把主角换成一个更有反差感、更贴合目标人群共鸣的新身份切入点。",
  hardcore_graft:
    "聚焦【硬核植入法】：保留对标书的情绪需求骨架，植入一套真实感极强的硬核知识/民俗法脉/职业技能/刑侦智斗/求生体系来制造强烈新奇感。",
  contrast_cheat:
    "聚焦【身份反差金手指】：在主角当前身份下，故意做出“反常识/看似作死或吃亏”的行为来触发金手指高额回报（类似舔狗返现、黑粉变强、败家反赚）。",
  character_contrast:
    "聚焦【人物反差切入】：把高能力、强性格或特定领域大佬穿进低位/弱势/强烈反差的原主身体，用前后能力差值引爆原著人物与周围配角的震惊反应。",
};

function buildBenchmarkPrompt(input: {
  source: {
    title: string;
    platform: string;
    category: string;
    intro: string;
  };
  excerpt?: string;
  strategy: BenchmarkStrategy;
  targetWorld?: string;
  targetIdentityHint?: string;
  proposalCount: number;
  activeTrends: readonly MarketM03Material[];
}): string {
  const trendLines =
    input.activeTrends.length > 0
      ? [
          "【当前 M03 高权重市场风口素材（可按 TR-02 组合思路择优融入，不要强塞）】",
          ...input.activeTrends.map(
            (item, idx) =>
              `${idx + 1}. [${item.materialType}|权重${item.trendWeight}] ${item.name}：${item.summary}`,
          ),
          "",
        ]
      : [];

  return [
    "请严格按【讲师基础课：对标书拆解 + 微创新开书】方法论执行以下任务：",
    "",
    "【待拆解的对标书】",
    `书名：《${input.source.title}》`,
    `平台/分类：${input.source.platform} / ${input.source.category}`,
    `简介：${input.source.intro || "（未提供简介，请结合标题与正文节选分析）"}`,
    ...(input.excerpt?.trim()
      ? [
          "",
          "【对标书前几章公共章节节选】",
          input.excerpt.trim().slice(0, 6000),
        ]
      : []),
    "",
    "【本次微创新指令】",
    `策略要求：${STRATEGY_GUIDE[input.strategy]}`,
    `目标方案数量：严格产出 ${input.proposalCount} 个差异明显的新书方案。`,
    ...(input.targetWorld?.trim()
      ? [`作者指定的目标世界/同人地图：${input.targetWorld.trim()}`]
      : []),
    ...(input.targetIdentityHint?.trim()
      ? [`作者希望尝试的主角身份方向：${input.targetIdentityHint.trim()}`]
      : []),
    "",
    ...trendLines,
    "【编辑铁律（必须遵守）】",
    "1. 单一核心需求铁律：一本书只能深度讨好一类读者的一个核心缺憾/爽感需求，绝不能把互相冲突的需求硬缝在一本书里（例如又写纯升级又大篇幅写纯爱）。",
    "2. 换皮不换魂：微创新换掉的是外壳（世界/身份/硬核知识/反差机制），必须明确保留对标书最让读者上头的配角反应循环与期待感。",
    "3. 金手指红线（原则2编辑铁律）：",
    "   - 若目标世界是现实都市重生/历史穿越，以【信息差 + 自身手腕】为主，禁止塞破坏真实感的万能系统；",
    "   - 若目标世界是玄幻/仙侠/同人/脑洞，金手指必须有清晰边界、代价或二次开发空间，严禁万能许愿机和系统代打。",
    "4. 每个方案给出具体可落地的【黄金前三章推进路线】（3 条，分别对应第1/2/3章核心动作与钩子）和【毒点防踩雷自检】。",
  ].join("\n");
}

function patternArraySchema() {
  return {
    type: "array",
    minItems: 2,
    maxItems: 6,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["formula", "mechanism", "evidenceTitles"],
      properties: {
        formula: { type: "string", minLength: 2, maxLength: 90 },
        mechanism: { type: "string", minLength: 6, maxLength: 260 },
        evidenceTitles: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
        },
      },
    },
  };
}

function slugHash(text: string): string {
  let hash = 2166136261;
  for (const ch of text) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function safeStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function safeMaterialType(raw: string): MarketM03Material["materialType"] {
  const parsed = MarketM03MaterialTypeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "核心爽点";
}

function safePlatform(raw: string): MarketPlatform {
  return raw === "qidian" || raw === "fanqie" || raw === "ciweimao"
    ? raw
    : "all";
}
