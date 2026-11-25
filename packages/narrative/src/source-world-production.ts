import { z } from "zod";
import {
  WORLD_BUILDER_ATLAS_CONTRACT,
  WORLD_BUILDER_SELECTION_POLICY,
  WISH_FULFILLMENT_ROOT_GUARD,
  FantasyBearingRequirementSchema,
  WishFulfillmentFrameSchema,
  WishFulfillmentSettlementTargetSchema,
  WishFulfillmentThreadSchema,
  WorldPackDocumentSchema,
  WorldPackRequestSchema,
  worldPackAtlasKind,
  worldPackCoarseTypeForAtlasKind,
  type WishFulfillmentFrame,
  type WorldAction,
  type WorldPackDocument,
  type WorldPackRequest,
} from "@narralume/contracts";
import {
  ModelGateway,
  createModelAdapter,
  type FetchLike,
  type JsonSchemaContract,
} from "@narralume/llm";
import {
  SqliteAssignmentRepository,
  SqliteUnifiedSourceWorldRepository,
  resolveCredential,
  type NarrativeDatabase,
} from "@narralume/persistence";
import {
  applyWorldProductionDelta,
  auditWorldAtlasProduction,
  emptyWorldDocument,
  playtestWorld,
  worldWorkOrderInput,
} from "./world-production-engine.js";
import {
  hasWorldWorkshopOutput,
  worldProductionWorkOrder,
  worldProductionWorkOrderForWishFulfillment,
} from "./world-production-runner.js";
import {
  initialWorldWorkshopOrder,
  resolveWorldDesignEntry,
} from "./world-design-policy.js";
import { previewProductionReality } from "./world-production-reality.js";
import { WORLD_PACK_MODEL_CONTRACT } from "./world-pack-workers.js";

const SourceWishPlanningThreadSchema = WishFulfillmentThreadSchema.extend({
  protagonistDesire: z.null(),
  phase: z.enum(["selected", "candidate"]),
});

const SourceWishPlanningBearingSchema =
  FantasyBearingRequirementSchema.extend({
    evidenceRefs: z.array(z.string()).max(0),
    status: z.enum(["candidate", "missing"]),
  });

const SourceWishFulfillmentPlanningOutputSchema = z
  .object({
    readerFantasy: z.string().trim().min(1).max(8_000),
    threads: z.array(SourceWishPlanningThreadSchema).min(2).max(50),
    bearingRequirements: z
      .array(SourceWishPlanningBearingSchema)
      .min(1)
      .max(120),
    settlementTargets: z
      .array(WishFulfillmentSettlementTargetSchema)
      .min(1)
      .max(50),
  })
  .strict();

type SourceWishFulfillmentPlanningOutput = z.infer<
  typeof SourceWishFulfillmentPlanningOutputSchema
>;

const SOURCE_WISH_FULFILLMENT_PLANNING_CONTRACT: JsonSchemaContract = {
  name: "source_world_wish_fulfillment_planning",
  strict: true,
  schema: z.toJSONSchema(SourceWishFulfillmentPlanningOutputSchema),
};

function sourceWishPlanningIssues(
  value: SourceWishFulfillmentPlanningOutput,
  existingWorld: WorldPackDocument,
): string[] {
  const issues: string[] = [];
  const knownRefs = new Set(existingWorld.nodes.map((node) => node.localId));
  const threadIds = new Set<string>();
  const targetThreadCounts = new Map<string, number>();

  for (const thread of value.threads) {
    if (threadIds.has(thread.id)) {
      issues.push(`threads: duplicate id ${thread.id}`);
    }
    threadIds.add(thread.id);
    if (thread.targetRefs.length === 0 && thread.targetNames.length === 0) {
      issues.push(
        `thread ${thread.id}: name an existing Source object or a concrete high-value candidate`,
      );
    }
    for (const targetRef of thread.targetRefs) {
      if (!knownRefs.has(targetRef)) {
        issues.push(`thread ${thread.id}: unknown targetRef ${targetRef}`);
      }
    }
    const targetKey =
      thread.targetRefs[0] ??
      thread.targetNames[0]?.trim().toLocaleLowerCase() ??
      "";
    if (targetKey) {
      targetThreadCounts.set(
        targetKey,
        (targetThreadCounts.get(targetKey) ?? 0) + 1,
      );
    }
  }

  if (![...targetThreadCounts.values()].some((count) => count >= 2)) {
    issues.push(
      "threads: at least one high-value source object/candidate must carry multiple reusable fantasy threads",
    );
  }

  const bearingIds = new Set<string>();
  const threadsWithBearing = new Set<string>();
  for (const requirement of value.bearingRequirements) {
    if (bearingIds.has(requirement.id)) {
      issues.push(`bearingRequirements: duplicate id ${requirement.id}`);
    }
    bearingIds.add(requirement.id);
    for (const threadId of requirement.threadIds) {
      if (!threadIds.has(threadId)) {
        issues.push(
          `bearing requirement ${requirement.id}: unknown threadId ${threadId}`,
        );
      } else {
        threadsWithBearing.add(threadId);
      }
    }
  }
  for (const threadId of threadIds) {
    if (!threadsWithBearing.has(threadId)) {
      issues.push(`thread ${threadId}: missing bearing requirement`);
    }
  }

  const settlementThreadIds = new Set<string>();
  for (const target of value.settlementTargets) {
    if (!threadIds.has(target.threadId)) {
      issues.push(
        `settlementTargets: unknown threadId ${target.threadId}`,
      );
    }
    if (settlementThreadIds.has(target.threadId)) {
      issues.push(
        `settlementTargets: duplicate threadId ${target.threadId}`,
      );
    }
    settlementThreadIds.add(target.threadId);
  }
  if (
    !value.threads.some(
      (thread) =>
        thread.phase === "selected" && settlementThreadIds.has(thread.id),
    )
  ) {
    issues.push(
      "settlementTargets: at least one selected reusable fantasy thread must name a future protagonist gain",
    );
  }

  return issues;
}

export interface SourceWorldProductionGenerateInput {
  worldId: string;
  request: WorldPackRequest;
}

export interface SourceWorldProductionGenerateOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  fetch?: FetchLike;
  generateOverride?: (input: {
    worldId: string;
    request: WorldPackRequest;
    prompt: string;
    existingWorld: WorldPackDocument;
    operation: string;
  }) => Promise<unknown> | unknown;
  /**
   * Test/manual override for the source-reusable wish planner. Normal runtime
   * uses the configured planning model. When generateOverride is supplied
   * without this hook, auto-planning is intentionally bypassed so legacy
   * production test doubles keep receiving exactly one generation call.
   */
  planWishFulfillmentOverride?: (input: {
    worldId: string;
    request: WorldPackRequest;
    prompt: string;
    existingWorld: WorldPackDocument;
  }) => Promise<unknown> | unknown;
}

export async function generateSourceWorldProduction(
  database: NarrativeDatabase,
  input: SourceWorldProductionGenerateInput,
  options: SourceWorldProductionGenerateOptions = {},
): Promise<WorldPackDocument> {
  let request = WorldPackRequestSchema.parse(input.request);
  const worlds = new SqliteUnifiedSourceWorldRepository(database);
  const world = worlds.getWorld(input.worldId);
  if (!world)
    throw serviceLikeError(
      "source.world.not_found",
      "Source World not found",
      404,
    );

  const knownSourceKeys = new Set(worlds.listCardKeys(input.worldId));
  const existingWorld = projectSourceWorldForProduction(
    worlds,
    input.worldId,
    request,
  );
  if (
    request.wishFulfillment &&
    request.wishFulfillment.mode !== "source_reusable"
  ) {
    throw serviceLikeError(
      "source.world.production.invalid_wish_fulfillment_mode",
      "Source World production requires wishFulfillment.mode=source_reusable",
      422,
    );
  }

  if (
    !request.wishFulfillment &&
    (!options.generateOverride || options.planWishFulfillmentOverride)
  ) {
    const planningPrompt = JSON.stringify(
      {
        sourceWorld: {
          id: world.id,
          name: world.name,
          kind: world.kind,
          description: world.description,
          cognitiveMother: worlds.getCognitiveMother(input.worldId),
        },
        authorRequest: {
          premise: request.premise,
          focus: request.focus,
          genre: request.genre,
          worldTime: request.worldTime,
          instruction: request.instruction,
        },
        selectionPolicy: WORLD_BUILDER_SELECTION_POLICY,
        wishFulfillmentRootGuard: WISH_FULFILLMENT_ROOT_GUARD,
        currentSourceObjects: existingWorld.nodes.map((node) => ({
          ref: node.localId,
          sourceKey: node.existingSourceKey,
          name: node.name,
          kind: node.atlasKind ?? node.type,
          value: node.value,
          access: node.access,
          motive: node.motive,
          currentActivity: node.currentActivity,
          readerSemantics: node.readerSemantics,
          description: node.description.slice(0, 1_500),
        })),
        currentSourceRelations: existingWorld.links,
      },
      null,
      2,
    );
    const plannedRaw = options.planWishFulfillmentOverride
      ? await options.planWishFulfillmentOverride({
          worldId: input.worldId,
          request,
          prompt: planningPrompt,
          existingWorld,
        })
      : await callSourceWorldWishPlanner(
          database,
          planningPrompt,
          existingWorld,
          options,
        );
    const planned = SourceWishFulfillmentPlanningOutputSchema.safeParse(
      plannedRaw,
    );
    if (!planned.success) {
      throw serviceLikeError(
        "source.world.production.invalid_wish_fulfillment_plan",
        planned.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".") || "root"}: ${issue.message}`,
          )
          .join("; "),
        422,
      );
    }
    const planningIssues = sourceWishPlanningIssues(
      planned.data,
      existingWorld,
    );
    if (planningIssues.length > 0) {
      throw serviceLikeError(
        "source.world.production.invalid_wish_fulfillment_plan",
        planningIssues.join("; "),
        422,
      );
    }
    request = WorldPackRequestSchema.parse({
      ...request,
      wishFulfillment: finalizeSourceReusableWishFulfillment(planned.data),
    });
  }

  const wishFulfillmentOrder = request.wishFulfillment
    ? worldProductionWorkOrderForWishFulfillment(
        request.wishFulfillment,
        existingWorld,
        request,
      )
    : null;
  const requestedEntry = resolveWorldDesignEntry(request, existingWorld);
  const playtest = playtestWorld(existingWorld, request);
  const fallbackWorkshop =
    playtest.atlasAudit.nextWorkshop ??
    initialWorldWorkshopOrder(request)[0] ??
    "geography";
  const op = wishFulfillmentOrder ?? (requestedEntry
    ? worldProductionWorkOrder(requestedEntry.workshop, existingWorld, request)
    : (playtest.next ??
      worldProductionWorkOrder(fallbackWorkshop, existingWorld, request)));

  const instruction = {
    target: "source_world",
    authority: {
      existingSourceCards:
        "reference truth already accepted into this Source World Atlas",
      generatedContent:
        "candidate only until author adoption; model recall is never verified Source Canon",
      readerSemantics:
        "Reader-side prior only; never objective Source fact and never Project Canon",
    },
    ...worldWorkOrderInput(
      op,
      existingWorld,
      request.wishFulfillment ?? null,
    ),
    authorRequest: request,
    worldBuilderAtlasContract: WORLD_BUILDER_ATLAS_CONTRACT,
    sourceWorld: {
      id: world.id,
      name: world.name,
      kind: world.kind,
      description: world.description,
      cognitiveMother: worlds.getCognitiveMother(input.worldId),
    },
    outputRules: [
      "existingCanonId must always be null for Source World production",
      "when deepening an existing Source card set existingSourceKey to its exact stable key",
      "references to existing Source cards use source:<stable-key>",
      "new unverified material must use origin=inference or origin=original; never manufacture source_canon",
      "value means world-internal social value; readerSemantics is the target Reader's preloaded price and expectation",
      "readerSemantics may be null when there is no meaningful Reader prior",
      "selectionPolicy chooses which existing-IP / historical objects deserve expensive curation; do not fill low-value encyclopedia categories merely for symmetry",
      "bearing must raise fantasy price through real Reality / relations / history / scarcity / access; never invent penalties solely because a benefit feels too strong",
    ],
  };
  const prompt =
    "你正在扩充一个可被多本小说反复 Fork 的原生母体世界，不是在写某一本小说的剧情。\n" +
    "原生事实、模型推断、原创扩展、Reader 预装认知必须分权。\n" +
    JSON.stringify(instruction);

  const raw = options.generateOverride
    ? await options.generateOverride({
        worldId: input.worldId,
        request,
        prompt,
        existingWorld,
        operation: op.workshop,
      })
    : await callSourceWorldModel(database, prompt, options);

  const parsed = WorldPackDocumentSchema.safeParse(raw);
  if (!parsed.success)
    throw serviceLikeError(
      "source.world.production.invalid_output",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
      422,
    );

  for (const node of parsed.data.nodes) {
    if (node.existingCanonId)
      throw serviceLikeError(
        "source.world.production.project_authority_leak",
        `Source World production cannot reference Project Canon identity: ${node.name}`,
        422,
      );
    if (node.origin === "source_canon" && !node.existingSourceKey)
      throw serviceLikeError(
        "source.world.production.fabricated_canon",
        `New Source World candidate ${node.name} cannot claim source_canon without an existing Source identity`,
        422,
      );
    if (node.existingSourceKey) {
      const existing = worlds.getCard(input.worldId, node.existingSourceKey);
      if (!existing)
        throw serviceLikeError(
          "source.world.production.source_missing",
          `Existing Source card not found: ${node.existingSourceKey}`,
          422,
        );
      const allowedNames = new Set([
        existing.record.name,
        ...existing.record.aliases,
      ]);
      if (!allowedNames.has(node.name))
        throw serviceLikeError(
          "source.world.production.identity_changed",
          `Source identity ${node.existingSourceKey} is ${existing.record.name}, not ${node.name}`,
          422,
        );
      if (existing.record.kind !== worldPackAtlasKind(node))
        throw serviceLikeError(
          "source.world.production.kind_changed",
          `Source identity ${node.existingSourceKey} kind is ${existing.record.kind}, not ${worldPackAtlasKind(node)}`,
          422,
        );
    }
  }

  const merged = applyWorldProductionDelta(
    emptyWorldDocument(),
    parsed.data,
    new Set<string>(),
    op.workshop,
    op.subjectRef,
    knownSourceKeys,
    op,
  );
  const combined = previewProductionReality(existingWorld, merged.document);
  if (!hasWorldWorkshopOutput(op.workshop, existingWorld, combined))
    throw serviceLikeError(
      "source.world.production.no_product",
      `${op.workshop} did not produce its promised Source World objects / relations / activities`,
      422,
    );

  return {
    ...merged.document,
    production: {
      engine: "mmorpg-world-workshop-v1",
      executed: [
        {
          workshop: op.workshop,
          subjectRef: op.subjectRef,
          changedRefs: merged.step.changedRefs,
          wishFulfillmentThreadIds: op.wishFulfillmentThreadIds,
          bearingRequirementIds: op.bearingRequirementIds,
        },
      ],
      playtestedPaths: playtestWorld(combined, request).interactionPaths,
      atlasAudit: auditWorldAtlasProduction(combined),
    },
  };
}

export function projectSourceWorldForProduction(
  worlds: SqliteUnifiedSourceWorldRepository,
  worldId: string,
  request: WorldPackRequest,
): WorldPackDocument {
  const exactFocus = request.focus
    ? worlds.findCardByReference(worldId, request.focus)
    : null;
  const fuzzyFocusHits =
    request.focus && !exactFocus
      ? worlds.listCards(worldId, request.focus, { limit: 30 })
      : [];
  const focusHits = exactFocus
    ? [
        {
          corpusId: exactFocus.record.corpusId,
          sourceKey: exactFocus.record.sourceKey,
          name: exactFocus.record.name,
          kind: exactFocus.record.kind,
          summary: exactFocus.record.summary,
          originCollection: exactFocus.record.originCollection,
        },
      ]
    : fuzzyFocusHits;
  const selected = new Map(focusHits.map((hit) => [hit.sourceKey, hit]));

  const addCard = (key: string): void => {
    if (selected.has(key) || selected.size >= 80) return;
    const card = worlds.getCard(worldId, key);
    if (!card) return;
    selected.set(key, {
      corpusId: card.record.corpusId,
      sourceKey: card.record.sourceKey,
      name: card.record.name,
      kind: card.record.kind,
      summary: card.record.summary,
      originCollection: card.record.originCollection,
    });
  };

  // W1 around an existing mother-world object must pull an actual local graph,
  // not "focus card + alphabetically unrelated global cards". First take the
  // people/objects directly connected to the focus, then follow a limited
  // second hop from those people into clans, teams, powers and other assets.
  const directKeys: string[] = [];
  for (const hit of focusHits) {
    const card = worlds.getCard(worldId, hit.sourceKey);
    if (!card) continue;
    for (const edge of card.relations) {
      const key = edge.direction === "out" ? edge.toKey : edge.fromKey;
      if (!directKeys.includes(key)) directKeys.push(key);
      addCard(key);
      if (selected.size >= 35) break;
    }
    if (selected.size >= 35) break;
  }
  const isExplicitTimeSlice =
    exactFocus?.record.sourceKey.startsWith("slice:") ?? false;
  if (!isExplicitTimeSlice)
    for (const key of directKeys.slice(0, 24)) {
      const card = worlds.getCard(worldId, key);
      if (!card) continue;
      const neighbors = card.relations
        .map((edge) => ({
          key: edge.direction === "out" ? edge.toKey : edge.fromKey,
          kind: edge.otherKind,
        }))
        .sort((a, b) => {
          const rank = (kind: string) => (kind === "character" ? 1 : 0);
          return rank(a.kind) - rank(b.kind);
        });
      for (const neighbor of neighbors) {
        addCard(neighbor.key);
        if (selected.size >= 65) break;
      }
      if (selected.size >= 65) break;
    }

  // Only a completely unresolved/empty entry may fall back to broad Atlas
  // context. A resolved but thin Zone is itself a production deficiency and
  // must stay thin so the audit can ask Module 1 to fill it.
  if (selected.size === 0)
    for (const hit of worlds.listCards(worldId, "", { limit: 80 })) {
      if (selected.size >= 80) break;
      if (!selected.has(hit.sourceKey)) selected.set(hit.sourceKey, hit);
    }
  const nodes: WorldPackDocument["nodes"] = [];
  const links: WorldPackDocument["links"] = [];
  const activities: WorldPackDocument["activities"] = [];
  const interactions: WorldPackDocument["interactions"] = [];
  const seenLinks = new Set<string>();

  for (const hit of selected.values()) {
    const card = worlds.getCard(worldId, hit.sourceKey);
    if (!card) continue;
    const fields = readAdoptedWorldFields(card.content);
    const areaEdge = card.relations.find(
      (edge) =>
        edge.direction === "out" &&
        ["位于", "发生于", "活动于", "village_affiliation_recorded"].includes(
          edge.relation,
        ),
    );
    nodes.push({
      localId: "source:" + hit.sourceKey,
      existingCanonId: null,
      existingSourceKey: hit.sourceKey,
      type: worldPackCoarseTypeForAtlasKind(hit.kind),
      atlasKind: hit.kind,
      name: hit.name,
      description: card.content.slice(0, 3_500),
      areaRef: areaEdge ? "source:" + areaEdge.toKey : null,
      value: fields.value,
      access: fields.access,
      motive: fields.motive,
      currentActivity: fields.currentActivity,
      origin: "source_canon",
      sourceNote: "Existing Source World Atlas reference",
      readerSemantics: worlds.getReaderSemantics(worldId, hit.sourceKey),
    });
    interactions.push(
      ...readAdoptedWorldActions(card.content, "source:" + hit.sourceKey),
    );
    if (hit.kind === "activity") {
      const actorRefs = card.relations
        .filter(
          (edge) =>
            edge.direction === "out" &&
            ["参与者", "行动者"].includes(edge.relation),
        )
        .map((edge) => "source:" + edge.toKey);
      const resourceRefs = card.relations
        .filter(
          (edge) =>
            edge.direction === "out" &&
            ["涉及", "使用", "争夺"].includes(edge.relation),
        )
        .map((edge) => "source:" + edge.toKey);
      if (actorRefs.length > 0 && fields.activityStage) {
        activities.push({
          localId: "source-activity-" + safeInternalId(hit.sourceKey),
          actorRefs,
          description: card.record.name,
          reason: fields.activityReason,
          resourceRefs,
          stage: fields.activityStage,
          worldTime: fields.worldTime || request.worldTime,
        });
      }
    }
    for (const edge of card.relations) {
      if (edge.direction !== "out" || !selected.has(edge.toKey)) continue;
      const key = edge.fromKey + "|" + edge.relation + "|" + edge.toKey;
      if (seenLinks.has(key)) continue;
      seenLinks.add(key);
      links.push({
        fromRef: "source:" + edge.fromKey,
        toRef: "source:" + edge.toKey,
        relation: edge.relation,
        description: edge.sourceNote || "Existing Source World relation",
        status: "current",
      });
    }
  }

  return {
    summary:
      nodes.length > 0
        ? "Existing Source World Atlas; read-only input for this production batch"
        : "Source World Atlas currently has no curated cards",
    nodes,
    links,
    activities,
    interactions,
    openThreads: [],
    dimensionSignals: [],
  };
}

function sourceWorldModelRuntime(
  database: NarrativeDatabase,
  options: SourceWorldProductionGenerateOptions,
) {
  const assignments = new SqliteAssignmentRepository(database);
  const assignment =
    assignments.resolve("planning") ?? assignments.resolve("writing");
  if (!assignment)
    throw serviceLikeError(
      "source.world.production.model_unavailable",
      "No planning or writing model assignment is configured",
      422,
    );
  const credential = resolveCredential(
    assignment.provider,
    options.environment ?? {},
  );
  if (!credential.ok)
    throw serviceLikeError(
      "source.world.production.model_unavailable",
      "The configured model credential is unavailable",
      422,
    );
  const gateway = new ModelGateway(
    createModelAdapter({
      protocol: assignment.provider.wireApi,
      baseUrl: assignment.provider.baseUrl,
      apiKey: credential.apiKey,
      ...(assignment.provider.endpoint === null
        ? {}
        : { endpoint: assignment.provider.endpoint }),
      ...(assignment.provider.anthropicVersion === null
        ? {}
        : { anthropicVersion: assignment.provider.anthropicVersion }),
      headers: assignment.provider.headers,
      queryParams: assignment.provider.queryParams,
      timeoutMs: 90_000,
      maxRetries: 1,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }),
  );
  return { assignment, gateway };
}

async function callSourceWorldWishPlanner(
  database: NarrativeDatabase,
  prompt: string,
  existingWorld: WorldPackDocument,
  options: SourceWorldProductionGenerateOptions,
): Promise<SourceWishFulfillmentPlanningOutput> {
  const { assignment, gateway } = sourceWorldModelRuntime(database, options);
  const result = await gateway.generateStructured(
    {
      model: assignment.model.modelId,
      instructions: [
        "你在 Module 1 / World Builder 的 Source-Reusable Selection 阶段工作，不是在写某一本书的剧情。",
        WISH_FULFILLMENT_ROOT_GUARD.readerQuestion,
        WISH_FULFILLMENT_ROOT_GUARD.expansionQuestion,
        WISH_FULFILLMENT_ROOT_GUARD.bearingQuestion,
        WISH_FULFILLMENT_ROOT_GUARD.antiBalanceTax,
        "面对同人/类同人母体，优先挑未来男主一旦接触就能持续释放多轮高价意淫的人物、技能、身份、组织、地点、秘密、资产与事件。",
        "不要按百科类别平权补数据。一个高价人物如果能持续产生认可、师承、需要男主、私人准入、公开背书、联盟、偏爱、命运改写等多条关系线，应优先于大量一次性低价背景对象。",
        "已有 Source 对象用其 source:<stable-key> 作为 targetRef；尚未进入 Atlas 的高价候选可以只给 concrete targetName。候选名字不是 Source Canon，后续仍只能作为 inference/original candidate 生产并等待人工 adoption。",
        "这是公共母体，不绑定具体小说男主；thread.protagonistDesire 必须为 null。描述的是未来典型男频男主可与该对象形成的高价关系。",
        "至少让一个高价对象/候选承载两条以上不同 thread。不要只写‘得到技能 + 进入圈层’两条模板，也不要为了凑数量机械枚举八个轴。",
        "每条 thread 必须有承重要求。planner 无权宣告 grounded / realizing / realized / retained；bearing evidenceRefs 必须为空。",
      ].join("\n"),
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: Math.min(
        assignment.model.maxOutputTokens ?? 10_000,
        14_000,
      ),
      responseSchema: SOURCE_WISH_FULFILLMENT_PLANNING_CONTRACT,
    },
    (value) => {
      const parsed = SourceWishFulfillmentPlanningOutputSchema.safeParse(value);
      if (!parsed.success) {
        return {
          success: false as const,
          issues: parsed.error.issues.map(
            (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
          ),
        };
      }
      const issues = sourceWishPlanningIssues(parsed.data, existingWorld);
      return issues.length === 0
        ? { success: true as const, data: parsed.data }
        : { success: false as const, issues };
    },
    { maxRepairAttempts: 1 },
  );
  return result.value;
}

function finalizeSourceReusableWishFulfillment(
  value: SourceWishFulfillmentPlanningOutput,
): WishFulfillmentFrame {
  return WishFulfillmentFrameSchema.parse({
    version: "wish-fulfillment-frame.v1",
    authority: "creative-direction",
    mode: "source_reusable",
    protagonistEntityId: null,
    readerFantasy: value.readerFantasy,
    protagonistDesire: null,
    threads: value.threads,
    bearingRequirements: value.bearingRequirements,
    settlementTargets: value.settlementTargets,
  });
}

async function callSourceWorldModel(
  database: NarrativeDatabase,
  prompt: string,
  options: SourceWorldProductionGenerateOptions,
): Promise<unknown> {
  const { assignment, gateway } = sourceWorldModelRuntime(
    database,
    options,
  );
  const result = await gateway.generateStructured(
    {
      model: assignment.model.modelId,
      instructions:
        "执行一个 Source World Atlas 世界内容生产工序。先服从 selectionPolicy：优先选择高意淫价值、高升级杠杆、能继续打开更贵人生的世界对象，再用意淫承重补齐真实人物、关系、历史、价格、门槛、稀缺和入口。承重是抬价，不是平衡税，不得因为太爽自动加副作用或净亏损。只生产候选世界对象、typed relations、活动、世界内部价格/入口及独立的 Reader-side semantics；不要写小说剧情，不要把模型记忆冒充已核实原作事实。",
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: Math.min(
        assignment.model.maxOutputTokens ?? 12_000,
        16_000,
      ),
      responseSchema: WORLD_PACK_MODEL_CONTRACT,
    },
    (value) => {
      const parsed = WorldPackDocumentSchema.safeParse(value);
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
  return result.value;
}

const WORLD_ACTION_TERM_KINDS = new Set<
  WorldAction["requires"][number]["kind"]
>(["asset", "permission", "relationship", "knowledge", "ability", "access"]);

function readAdoptedWorldActions(
  content: string,
  offeredByRef: string,
): WorldAction[] {
  const actions: WorldAction[] = [];
  const pattern =
    /<!-- world-builder-action:[^\n]*:([a-z][a-z0-9_-]{1,79}) -->\s*\n### 可玩入口｜([^\n]+)\n([\s\S]*?)(?=\n<!-- world-builder-action:|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const localId = match[1];
    const name = match[2]?.trim();
    const body = match[3] ?? "";
    if (!localId || !name) continue;
    const lines = body.split(/\r?\n/).map((line) => line.trim());
    const action = lines.find(
      (line) =>
        line &&
        !line.startsWith("状态：") &&
        !line.startsWith("地点：") &&
        !line.startsWith("需要(") &&
        !line.startsWith("取得("),
    );
    const stateLine = lines.find((line) => line.startsWith("状态："));
    const state =
      stateLine?.slice("状态：".length).trim() === "potential"
        ? "potential"
        : "available";
    const locationLine = lines.find((line) => line.startsWith("地点："));
    const locationKey = locationLine ? wikiTarget(locationLine) : null;
    const parseTerms = (prefix: "需要" | "取得"): WorldAction["requires"] => {
      const terms: WorldAction["requires"] = [];
      for (const line of lines) {
        const term = new RegExp("^" + prefix + "\\(([^)]+)\\)：").exec(line);
        if (!term) continue;
        const kind = term[1] as WorldAction["requires"][number]["kind"];
        const key = wikiTarget(line);
        if (!key || !WORLD_ACTION_TERM_KINDS.has(kind)) continue;
        terms.push({ kind, ref: "source:" + key });
      }
      return terms;
    };
    const yields = parseTerms("取得");
    if (!action || yields.length === 0) continue;
    actions.push({
      localId,
      name,
      offeredByRef,
      locationRef: locationKey ? "source:" + locationKey : null,
      action,
      requires: parseTerms("需要"),
      yields,
      state,
    });
  }
  return actions;
}

function wikiTarget(line: string): string | null {
  const match = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/.exec(line);
  return match?.[1]?.trim() || null;
}

function readAdoptedWorldFields(content: string): {
  value: string;
  access: string;
  motive: string;
  currentActivity: string;
  activityStage: "ongoing" | "potential" | "ended" | null;
  activityReason: string;
  worldTime: string;
} {
  const lines = content.split(/\r?\n/);
  const field = (label: string) => {
    const prefix = label + "：";
    const found = lines.find((line) => line.trimStart().startsWith(prefix));
    return found ? found.trimStart().slice(prefix.length).trim() : "";
  };
  const stage = field("阶段");
  return {
    value: field("世界内部价值"),
    access: field("准入/取得"),
    motive: field("自身目标/作用"),
    currentActivity: field("当前事务"),
    activityStage:
      stage === "ongoing" || stage === "potential" || stage === "ended"
        ? stage
        : null,
    activityReason: field("原因"),
    worldTime: field("世界时间"),
  };
}

function safeInternalId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "source_activity"
  );
}

function serviceLikeError(
  code: string,
  message: string,
  statusCode: number,
): Error {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    retryable: false,
  });
}
