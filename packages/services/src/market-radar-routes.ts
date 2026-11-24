import {
  BenchmarkIncubateRequestSchema,
  CreateProjectFromBenchmarkProposalRequestSchema,
  CreateProjectFromBenchmarkProposalResponseSchema,
  MarketM03MaterialSchema,
  MarketPlatformSchema,
  SaveMarketM03RequestSchema,
  Tr01AnalyzeRequestSchema,
} from "@narralume/contracts";
import { randomUuid } from "@narralume/domain";
import {
  SqliteStoryRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import { z } from "zod";
import {
  analyzeMarketTrendsWithTr01,
  incubateBenchmarkProposals,
  listMarketM03Materials,
  listMarketRadarBooks,
  saveMarketM03Materials,
  seedMarketM03IntoProject,
  type MarketRadarServiceOptions,
  type NewbookPoolSnapshot,
} from "./market-radar-service.js";
import { bootstrapProject } from "./project-bootstrap.js";
import type { RouteApp } from "./route-app.js";

const BooksQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(0).max(365).default(14),
  platform: MarketPlatformSchema.default("all"),
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(300).default(120),
});

const EMPTY_POOL: NewbookPoolSnapshot = {
  updatedAt: null,
  snapshotDate: null,
  books: [],
};

export function registerMarketRadarRoutes(
  app: RouteApp,
  database: NarrativeDatabase,
  options: MarketRadarServiceOptions = {},
): void {
  const getPool = (): NewbookPoolSnapshot =>
    options.loadNewbookPool ? options.loadNewbookPool() : EMPTY_POOL;

  app.route("GET", "/api/market-radar/books", (request) => {
    const query = BooksQuerySchema.parse(request.query);
    return listMarketRadarBooks(
      database,
      getPool(),
      {
        windowDays: query.windowDays,
        platform: query.platform,
        ...(query.category === undefined ? {} : { category: query.category }),
        ...(query.search === undefined ? {} : { search: query.search }),
        limit: query.limit,
      },
      options.now ? options.now() : new Date(),
    );
  });

  app.route("GET", "/api/market-radar/m03-trends", () => {
    const cards = listMarketM03Materials(database, 80);
    return {
      total: cards.length,
      cards: cards.map((card) => MarketM03MaterialSchema.parse(card)),
    };
  });

  app.route("POST", "/api/market-radar/tr01-analyze", async (request) => {
    const input = Tr01AnalyzeRequestSchema.parse(request.body);
    return analyzeMarketTrendsWithTr01(database, getPool(), input, options);
  });

  app.route("POST", "/api/market-radar/m03-trends/save", (request) => {
    const input = SaveMarketM03RequestSchema.parse(request.body);
    return saveMarketM03Materials(
      database,
      input.cards,
      (options.now ? options.now() : new Date()).toISOString(),
    );
  });

  app.route("POST", "/api/market-radar/benchmark-incubate", async (request) => {
    const input = BenchmarkIncubateRequestSchema.parse(request.body);
    return incubateBenchmarkProposals(database, getPool(), input, options);
  });

  app.route("POST", "/api/market-radar/create-project", (request) => {
    const input = CreateProjectFromBenchmarkProposalRequestSchema.parse(
      request.body,
    );
    const { proposal, deconstruction } = input;
    const now = (options.now ? options.now() : new Date()).toISOString();
    const projectId = randomUuid();
    const outlineNodeId = randomUuid();
    const title = input.title ?? proposal.suggestedTitle;

    const result = database.transaction(() => {
      const project = bootstrapProject(database, {
        projectId,
        rootOutlineNodeId: outlineNodeId,
        title,
        subtitle: `对标微创新：${input.benchmarkTitle}`,
        premise: proposal.oneLineHook,
        language: input.language,
        now,
      });
      const story = new SqliteStoryRepository(database);
      const intent = story.getAuthorIntent(projectId);
      if (!intent) throw new Error("market_radar.missing_bootstrap_intent");

      story.upsertAuthorIntent({
        ...intent,
        promise: `${proposal.oneLineHook}（保留核心需求：${proposal.preservedDemand}）`,
        audience: deconstruction.targetAudience,
        tone: `${proposal.strategyLabel} · 男频商业连载`,
        themes: [deconstruction.singleCoreDemand],
        currentFocus: [
          `对标书：《${input.benchmarkTitle}》`,
          `单一核心需求：${deconstruction.singleCoreDemand}`,
          `微创新换壳：${proposal.noveltyShift}`,
          `目标世界：${proposal.targetWorldSetting}`,
          `主角身份：${proposal.protagonistIdentity}`,
          `金手指：${proposal.goldenFinger}`,
          `配角反应循环：${deconstruction.supportingReactionLoop}`,
          proposal.m03TrendTags.length > 0
            ? `融合 M03 高权重风口：${proposal.m03TrendTags.join("、")}`
            : null,
          `黄金前三章：\n${proposal.firstThreeChaptersPlan.map((step, i) => `${i + 1}. ${step}`).join("\n")}`,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n"),
        boundaries: [
          `单一需求红线：围绕「${deconstruction.singleCoreDemand}」持续供给，不混入冲突题材需求`,
          `金手指约束：${proposal.goldenFingerGuardrail}`,
          `毒点自检：${proposal.riskCheck}`,
        ],
        updatedAt: now,
      });

      story.updateOutlineDetails(
        projectId,
        outlineNodeId,
        {
          summary: proposal.oneLineHook,
          goal: proposal.firstThreeChaptersPlan[0] ?? proposal.preservedDemand,
          conflict: proposal.noveltyShift,
          metadata: {
            origin: "market-radar-benchmark",
            benchmarkTitle: input.benchmarkTitle,
            deconstruction,
            proposal,
          },
        },
        now,
      );

      const seededM03Count = input.seedMarketM03
        ? seedMarketM03IntoProject(database, projectId, now)
        : 0;

      return { project, seededM03Count };
    });

    return CreateProjectFromBenchmarkProposalResponseSchema.parse(result);
  });
}
