import { z } from "zod";

/**
 * Cross-module male-frequency wish-fulfillment axis.
 *
 * This is author/director-side creative direction, never Source truth or
 * Project Reality. Module 1 uses it to decide what deserves production and
 * what Reality must bear the fantasy. Module 2 only supplies/queryable
 * evidence. Module 3 uses the same threads to realize and settle the fantasy.
 */
export const WISH_FULFILLMENT_SEARCH_AXES = [
  { id: "power", label: "力量", question: "如果我是男主，我想能做到什么？" },
  { id: "status", label: "身份", question: "如果我是男主，我想成为什么人？" },
  { id: "wealth", label: "财富", question: "如果我是男主，我想拥有什么？" },
  { id: "circle", label: "圈层", question: "如果我是男主，我想和什么人坐到一张桌上？" },
  { id: "information", label: "信息", question: "如果我是男主，我想知道别人不知道什么？" },
  { id: "space", label: "空间", question: "如果我是男主，我想活进怎样更昂贵的世界？" },
  { id: "relationship", label: "关系", question: "如果我是男主，我想和谁形成怎样只有我有的位置？" },
  { id: "career", label: "事业", question: "如果我是男主，我想在世界上留下怎样属于我的事业？" },
] as const;

export type WishFulfillmentSearchAxisId =
  (typeof WISH_FULFILLMENT_SEARCH_AXES)[number]["id"];

export const WishFulfillmentModeSchema = z.enum([
  "source_reusable",
  "project_current",
  "story_current",
]);
export type WishFulfillmentMode = z.infer<typeof WishFulfillmentModeSchema>;

export const WishFulfillmentThreadPhaseSchema = z.enum([
  "candidate",
  "selected",
  "bearing",
  "realizing",
  "realized",
  "retained",
]);
export type WishFulfillmentThreadPhase = z.infer<
  typeof WishFulfillmentThreadPhaseSchema
>;

/**
 * One fantasy thread is one desirable change around one or more concrete
 * world objects. The same high-value object may and normally should carry
 * many simultaneous threads: recognition + mentorship + private access +
 * political alliance + affection + destiny rewrite, etc.
 */
export const WishFulfillmentThreadSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    targetRefs: z.array(z.string().trim().min(1).max(500)).max(50),
    targetNames: z.array(z.string().trim().min(1).max(500)).max(50),
    dimension: z.string().trim().min(1).max(300),
    readerFantasy: z.string().trim().min(1).max(4_000),
    protagonistDesire: z.string().trim().min(1).max(4_000).nullable(),
    desiredChange: z.string().trim().min(1).max(5_000),
    privatePrivilege: z.string().trim().max(3_000).nullable(),
    publicRepricing: z.string().trim().max(3_000).nullable(),
    upgradeLeverage: z.array(z.string().trim().min(1).max(1_000)).max(30),
    phase: WishFulfillmentThreadPhaseSchema,
  })
  .strict();
export type WishFulfillmentThread = z.infer<
  typeof WishFulfillmentThreadSchema
>;

export const WishFulfillmentThreadAdvanceSchema = z
  .object({
    threadId: z.string().trim().min(1).max(300),
    toPhase: z.enum(["bearing", "realizing"]),
    storyMove: z.string().trim().min(1).max(5_000),
  })
  .strict();
export type WishFulfillmentThreadAdvance = z.infer<
  typeof WishFulfillmentThreadAdvanceSchema
>;

export const FantasyBearingKindSchema = z.enum([
  "reality",
  "person",
  "relationship",
  "history",
  "rule",
  "price",
  "access",
  "scarcity",
  "competition",
  "qualification",
  "reader_prior",
  "other",
]);
export type FantasyBearingKind = z.infer<typeof FantasyBearingKindSchema>;

export const FantasyBearingStatusSchema = z.enum([
  "grounded",
  "missing",
  "candidate",
]);
export type FantasyBearingStatus = z.infer<
  typeof FantasyBearingStatusSchema
>;

export const FantasyBearingRequirementSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    threadIds: z.array(z.string().trim().min(1).max(300)).min(1).max(50),
    kind: FantasyBearingKindSchema,
    requirement: z.string().trim().min(1).max(5_000),
    evidenceRefs: z.array(z.string().trim().min(1).max(1_000)).max(100),
    status: FantasyBearingStatusSchema,
    raisesPriceBecause: z.string().trim().min(1).max(4_000),
  })
  .strict();
export type FantasyBearingRequirement = z.infer<
  typeof FantasyBearingRequirementSchema
>;

export const WishFulfillmentSettlementTargetSchema = z
  .object({
    threadId: z.string().trim().min(1).max(300),
    assetKind: z.string().trim().min(1).max(300),
    targetGain: z.string().trim().min(1).max(4_000),
  })
  .strict();
export type WishFulfillmentSettlementTarget = z.infer<
  typeof WishFulfillmentSettlementTargetSchema
>;

/**
 * Shared longitudinal creative frame.
 *
 * Reader fantasy, protagonist desire, fantasy expansion, Reality bearing and
 * settlement are deliberately kept in one frame so no module can silently
 * replace "what are we fantasizing about?" with category completeness,
 * generic conflict, or balance-tax penalties.
 */
export const WishFulfillmentFrameSchema = z
  .object({
    version: z.literal("wish-fulfillment-frame.v1"),
    authority: z.literal("creative-direction"),
    mode: WishFulfillmentModeSchema,
    protagonistEntityId: z.string().trim().min(1).max(500).nullable(),
    readerFantasy: z.string().trim().min(1).max(8_000),
    protagonistDesire: z.string().trim().min(1).max(8_000).nullable(),
    threads: z.array(WishFulfillmentThreadSchema).min(1).max(100),
    bearingRequirements: z
      .array(FantasyBearingRequirementSchema)
      .max(200),
    settlementTargets: z
      .array(WishFulfillmentSettlementTargetSchema)
      .max(100),
  })
  .strict();
export type WishFulfillmentFrame = z.infer<
  typeof WishFulfillmentFrameSchema
>;

export const WISH_FULFILLMENT_ROOT_GUARD = {
  readerQuestion: "目标男性 Reader 借男主到底想活什么、意淫什么？",
  protagonistQuestion: "这个具体男人自己现在想要什么、会主动做什么？",
  expansionQuestion:
    "围绕高价对象，哪些认可、师承、需要、偏爱、私人准入、公开背书、权力、拥有、命运改写等变化都值得逐条发生，而不是只选一种关系？",
  bearingQuestion:
    "什么 Reality、人、关系、历史、规则、价格、门槛、稀缺、竞争、资格与 Reader 预装认知，能把每条意淫展开托得更真、更贵、更馋？",
  realizationQuestion:
    "男主怎样通过自己的行动和现有人物的真实反应，把这些意淫线程一条条做进 Reality？",
  settlementQuestion:
    "兑现以后留下什么技能、身份、财富、关系、权限、组织、知识、名望或地图准入，成为下一轮更贵意淫的本金？",
  antiBalanceTax:
    "承重的目标函数是提高幻想价格，不是降低幻想收益；不得因为太爽、太强、太顺就自动添加冷却、反噬、净亏损或情感债。",
} as const;
