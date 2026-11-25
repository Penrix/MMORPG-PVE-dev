import { z } from "zod";
import { ProjectSchema } from "./story.js";

export const MarketPlatformSchema = z.enum([
  "all",
  "qidian",
  "fanqie",
  "ciweimao",
]);
export type MarketPlatform = z.infer<typeof MarketPlatformSchema>;

export const MarketBookPlatformSchema = z.enum([
  "qidian",
  "fanqie",
  "ciweimao",
]);
export type MarketBookPlatform = z.infer<typeof MarketBookPlatformSchema>;

export const MarketTrendLabelSchema = z.enum(["hot", "rising", "steady"]);
export type MarketTrendLabel = z.infer<typeof MarketTrendLabelSchema>;

export const NewbookRankingEntrySchema = z.object({
  id: z.string().min(1),
  platform: MarketBookPlatformSchema,
  board: z.string().min(1),
  boardsSeen: z.array(z.string().min(1)).default([]),
  category: z.string().default("未分类"),
  title: z.string().min(1),
  author: z.string().default(""),
  intro: z.string().default(""),
  url: z.string().default(""),
  latestRank: z.number().int().positive().nullable().default(null),
  firstSeenAt: z.string().min(1),
  lastSeenAt: z.string().min(1),
  seenCount: z.number().int().positive().default(1),
  trendWeight: z.number().positive(),
  trendLabel: MarketTrendLabelSchema,
  daysSinceLastSeen: z.number().int().nonnegative(),
});
export type NewbookRankingEntry = z.infer<typeof NewbookRankingEntrySchema>;

export const MarketRadarStatusSummarySchema = z.object({
  updatedAt: z.string().nullable(),
  snapshotDate: z.string().nullable(),
  totalBooks: z.number().int().nonnegative(),
  filteredBooks: z.number().int().nonnegative(),
  windowDays: z.number().int().nonnegative(),
  byPlatform: z.record(z.string(), z.number().int().nonnegative()),
  topCategories: z.array(
    z.object({
      category: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  storedM03TrendCount: z.number().int().nonnegative(),
});
export type MarketRadarStatusSummary = z.infer<
  typeof MarketRadarStatusSummarySchema
>;

export const MarketRadarBooksResponseSchema = z.object({
  status: MarketRadarStatusSummarySchema,
  books: z.array(NewbookRankingEntrySchema),
});
export type MarketRadarBooksResponse = z.infer<
  typeof MarketRadarBooksResponseSchema
>;

export const MarketM03MaterialTypeSchema = z.enum([
  "金手指形态",
  "核心爽点",
  "主角人设",
  "情绪钩子",
  "世界奇观",
]);
export type MarketM03MaterialType = z.infer<typeof MarketM03MaterialTypeSchema>;

export const MarketM03MaterialSchema = z.object({
  id: z.string().min(1),
  materialType: MarketM03MaterialTypeSchema,
  name: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  evidenceTitles: z.array(z.string().min(1)).default([]),
  trendWeight: z.number().positive().default(1.8),
  marketWindow: z.string().default("recent"),
  platform: MarketPlatformSchema.default("all"),
  status: z.enum(["active", "archived"]).default("active"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type MarketM03Material = z.infer<typeof MarketM03MaterialSchema>;

export const Tr01AnalyzeRequestSchema = z.object({
  windowDays: z.number().int().min(0).max(365).default(14),
  platform: MarketPlatformSchema.default("all"),
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
  bookIds: z.array(z.string().min(1)).max(60).optional(),
  sampleLimit: z.number().int().min(5).max(50).default(24),
  autoSaveM03: z.boolean().default(true),
});
export type Tr01AnalyzeRequest = z.infer<typeof Tr01AnalyzeRequestSchema>;

export const Tr01MacroTrendSchema = z.object({
  name: z.string().min(1),
  readerDemandGap: z.string().min(1),
  whyHotNow: z.string().min(1),
  weight: z.enum(["high", "medium"]),
  evidenceTitles: z.array(z.string().min(1)).min(1),
});

export const Tr01PatternItemSchema = z.object({
  formula: z.string().min(1),
  mechanism: z.string().min(1),
  evidenceTitles: z.array(z.string().min(1)).min(1),
});

export const Tr01AnalyzeResponseSchema = z.object({
  analyzedAt: z.string(),
  windowLabel: z.string(),
  platform: MarketPlatformSchema,
  analyzedBookCount: z.number().int().positive(),
  modelId: z.string().min(1),
  macroTrends: z.array(Tr01MacroTrendSchema).min(1),
  mesoPatterns: z.object({
    goldenFingerFormulas: z.array(Tr01PatternItemSchema).min(1),
    protagonistFormulas: z.array(Tr01PatternItemSchema).min(1),
    openingHooks: z.array(Tr01PatternItemSchema).min(1),
  }),
  m03Cards: z.array(MarketM03MaterialSchema).min(1),
  savedToM03Count: z.number().int().nonnegative(),
});
export type Tr01AnalyzeResponse = z.infer<typeof Tr01AnalyzeResponseSchema>;

export const SaveMarketM03RequestSchema = z.object({
  cards: z.array(MarketM03MaterialSchema).min(1).max(60),
});
export type SaveMarketM03Request = z.infer<typeof SaveMarketM03RequestSchema>;

export const SaveMarketM03ResponseSchema = z.object({
  savedCount: z.number().int().nonnegative(),
  totalActiveCount: z.number().int().nonnegative(),
});
export type SaveMarketM03Response = z.infer<typeof SaveMarketM03ResponseSchema>;

export const BenchmarkStrategySchema = z.enum([
  "multi",
  "reskin_world",
  "reskin_identity",
  "hardcore_graft",
  "contrast_cheat",
  "character_contrast",
]);
export type BenchmarkStrategy = z.infer<typeof BenchmarkStrategySchema>;

export const BenchmarkIncubateRequestSchema = z.object({
  bookId: z.string().trim().min(1).optional(),
  customTitle: z.string().trim().min(1).max(120).optional(),
  customCategory: z.string().trim().max(80).optional(),
  customPlatform: MarketPlatformSchema.optional(),
  customIntro: z.string().trim().max(4000).optional(),
  publicChapterExcerpt: z.string().trim().max(12000).optional(),
  strategy: BenchmarkStrategySchema.default("multi"),
  targetWorld: z.string().trim().max(160).optional(),
  targetIdentityHint: z.string().trim().max(160).optional(),
  useM03Trends: z.boolean().default(true),
  proposalCount: z.number().int().min(1).max(5).default(3),
});
export type BenchmarkIncubateRequest = z.infer<
  typeof BenchmarkIncubateRequestSchema
>;

export const BenchmarkDeconstructionSchema = z.object({
  benchmarkTitle: z.string().min(1),
  targetAudience: z.string().min(1),
  singleCoreDemand: z.string().min(1),
  corePayoffMechanism: z.string().min(1),
  supportingReactionLoop: z.string().min(1),
  openingHookPattern: z.string().min(1),
});
export type BenchmarkDeconstruction = z.infer<
  typeof BenchmarkDeconstructionSchema
>;

export const BenchmarkProposalSchema = z.object({
  id: z.string().min(1),
  strategy: BenchmarkStrategySchema,
  strategyLabel: z.string().min(1),
  suggestedTitle: z.string().min(1),
  oneLineHook: z.string().min(1),
  preservedDemand: z.string().min(1),
  noveltyShift: z.string().min(1),
  targetWorldSetting: z.string().min(1),
  protagonistIdentity: z.string().min(1),
  goldenFinger: z.string().min(1),
  goldenFingerGuardrail: z.string().min(1),
  firstThreeChaptersPlan: z.array(z.string().min(1)).min(1).max(4),
  m03TrendTags: z.array(z.string().min(1)).default([]),
  riskCheck: z.string().min(1),
});
export type BenchmarkProposal = z.infer<typeof BenchmarkProposalSchema>;

export const BenchmarkIncubateResponseSchema = z.object({
  incubatedAt: z.string(),
  modelId: z.string().min(1),
  benchmarkSource: z.object({
    bookId: z.string().nullable(),
    title: z.string().min(1),
    platform: z.string(),
    category: z.string(),
    intro: z.string(),
  }),
  benchmarkDeconstruction: BenchmarkDeconstructionSchema,
  appliedM03Trends: z.array(
    z.object({
      id: z.string(),
      materialType: z.string(),
      name: z.string(),
      trendWeight: z.number(),
    }),
  ),
  proposals: z.array(BenchmarkProposalSchema).min(1),
});
export type BenchmarkIncubateResponse = z.infer<
  typeof BenchmarkIncubateResponseSchema
>;

export const CreateProjectFromBenchmarkProposalRequestSchema = z.object({
  benchmarkTitle: z.string().trim().min(1).max(160),
  deconstruction: BenchmarkDeconstructionSchema,
  proposal: BenchmarkProposalSchema,
  title: z.string().trim().min(1).max(160).optional(),
  language: z.enum(["zh-CN", "en"]).default("zh-CN"),
  seedMarketM03: z.boolean().default(true),
});
export type CreateProjectFromBenchmarkProposalRequest = z.infer<
  typeof CreateProjectFromBenchmarkProposalRequestSchema
>;

export const CreateProjectFromBenchmarkProposalResponseSchema = z.object({
  project: ProjectSchema,
  seededM03Count: z.number().int().nonnegative(),
});
export type CreateProjectFromBenchmarkProposalResponse = z.infer<
  typeof CreateProjectFromBenchmarkProposalResponseSchema
>;
