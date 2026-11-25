import { z } from "zod";

import {
  StoryObjectFocusSchema,
  StoryOpportunitySeedSchema,
  StoryScaleSearchResultSchema,
  StoryUnitCampMemberSchema,
  StoryUnitCampTransitionSchema,
  StoryUnitEventDesignSchema,
  StoryUnitInformationReleaseSchema,
  StoryUnitReactionTargetSchema,
  StoryStakeLedgerEntrySchema,
  StoryWorldGapSchema,
  FantasyBearingRequirementSchema,
  WishFulfillmentBearingEvidenceSchema,
  WishFulfillmentFrameSchema,
  WishFulfillmentSettlementTargetSchema,
  WishFulfillmentThreadAdvanceSchema,
  WishFulfillmentThreadSchema,
  WISH_FULFILLMENT_ROOT_GUARD,
  type ExpectationDesign,
  type StoryAuthoringSearch,
  type StoryCreativeContext,
  type StoryObjectField,
  type StoryProtagonistCamera,
  type StoryUnitDesign,
  type StoryUpgradeLedger,
  type WishFulfillmentFrame,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { JsonSchemaContract } from "@narralume/llm";

import { CreativeMethodRoutingService } from "./creative-method-routing.js";
import type { NarrativeModelClient } from "./model-client.js";
import { zodValidator } from "./schemas.js";
import {
  finalizeStoryAuthoringSearch,
  finalizeStoryUnitDesign,
  storyBearingEvidenceCandidates,
  storyObjectSurfaceRef,
} from "./story-authoring-runtime.js";
import { assertStoryCreativeContextBound } from "./story-creative-context.js";

const StoryAuthoringSearchOutputSchema = z.object({
  status: z.enum(["READY", "BLOCKED_WORLD_GAP"]),
  question: z.string().min(1),
  objectFocus: z.array(StoryObjectFocusSchema),
  seeds: z.array(StoryOpportunitySeedSchema),
  worldGaps: z.array(StoryWorldGapSchema),
  scaleResult: StoryScaleSearchResultSchema,
});
type StoryAuthoringSearchOutput = z.infer<
  typeof StoryAuthoringSearchOutputSchema
>;

const STORY_AUTHORING_SEARCH_CONTRACT: JsonSchemaContract = {
  name: "story_object_grounded_search",
  strict: true,
  schema: z.toJSONSchema(StoryAuthoringSearchOutputSchema),
};

const WishFulfillmentPlanningThreadSchema =
  WishFulfillmentThreadSchema.extend({
    phase: z.enum(["selected", "candidate"]),
  });

const WishFulfillmentPlanningBearingSchema =
  FantasyBearingRequirementSchema.extend({
    evidenceRefs: z.array(z.string()).max(0),
    status: z.enum(["candidate", "missing"]),
  });

const WishFulfillmentPlanningOutputSchema = z
  .object({
    readerFantasy: z.string().trim().min(1).max(8_000),
    protagonistDesire: z.string().trim().min(1).max(8_000),
    threads: z.array(WishFulfillmentPlanningThreadSchema).min(2).max(40),
    bearingRequirements: z
      .array(WishFulfillmentPlanningBearingSchema)
      .min(1)
      .max(100),
    settlementTargets: z
      .array(WishFulfillmentSettlementTargetSchema)
      .min(1)
      .max(40),
  })
  .strict();

type WishFulfillmentPlanningOutput = z.infer<
  typeof WishFulfillmentPlanningOutputSchema
>;

const WISH_FULFILLMENT_PLANNING_CONTRACT: JsonSchemaContract = {
  name: "story_wish_fulfillment_planning",
  strict: true,
  schema: z.toJSONSchema(WishFulfillmentPlanningOutputSchema),
};

const StoryUnitDesignOutputSchema = z.object({
  status: z.enum(["READY", "BLOCKED_WORLD_GAP"]),
  objectAnchorIds: z.array(z.string().min(1)),
  groundingSurfaceRefs: z.array(z.string().min(1)),
  storyProblem: z.string().min(1),
  worldGaps: z.array(StoryWorldGapSchema),
  wishFulfillmentAdvances: z.array(WishFulfillmentThreadAdvanceSchema),
  bearingEvidence: z.array(WishFulfillmentBearingEvidenceSchema),
  campNetwork: z.array(StoryUnitCampMemberSchema),
  stakeLedger: z.array(StoryStakeLedgerEntrySchema),
  reactionTargets: z.array(StoryUnitReactionTargetSchema),
  campTransitions: z.array(StoryUnitCampTransitionSchema),
  appearanceOrderEntityIds: z.array(z.string().min(1)),
  informationRelease: z.array(StoryUnitInformationReleaseSchema),
  events: z.array(StoryUnitEventDesignSchema),
});
type StoryUnitDesignOutput = z.infer<typeof StoryUnitDesignOutputSchema>;

const STORY_UNIT_DESIGN_CONTRACT: JsonSchemaContract = {
  name: "story_unit_design",
  strict: true,
  schema: z.toJSONSchema(StoryUnitDesignOutputSchema),
};

export interface StoryAuthoringSearchModelRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  upgradeLedger: StoryUpgradeLedger;
  request: string;
  readerNeed: string;
  targetEmotion: string;
  protagonistProfile: string;
  methodInstructions?: string;
  /** @deprecated Prefer creativeContext.materialSelections from Module 2. */
  matureStoryMaterials?: string;
}

export interface WishFulfillmentPlanningModelRequest {
  field: StoryObjectField;
  protagonistCamera: StoryProtagonistCamera;
  upgradeLedger: StoryUpgradeLedger;
  request: string;
  readerNeed: string;
  targetEmotion: string;
}

export interface StoryUnitDesignModelRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  sourceSearch: StoryAuthoringSearch | null;
  sourceSeedIds: readonly string[];
  expectationDesign: ExpectationDesign;
  upgradeLedger: StoryUpgradeLedger;
  request: string;
}

export interface StoryAuthoringModelResult<T> {
  value: T;
  usage: RunBudgetUsage;
  generation: {
    mode: "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

export interface StoryAuthoringRoutedSearchResult {
  routing: Awaited<
    ReturnType<CreativeMethodRoutingService["routeStorySearch"]>
  >;
  search: StoryAuthoringModelResult<StoryAuthoringSearch>;
}

function fieldObjectCatalog(field: StoryObjectField) {
  return field.objects.map((object) => ({
    id: object.id,
    entityId: object.entityId,
    name: object.name,
    kind: object.kind,
    aliases: object.aliases,
    surfaces: object.surfaces.map((surface) => ({
      ...surface,
      ref: storyObjectSurfaceRef(object.id, surface),
    })),
    sourceRefs: object.sourceRefs,
  }));
}

function m01bContinuitySnapshot(input: {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  upgradeLedger: StoryUpgradeLedger;
}) {
  const currentStep =
    input.upgradeLedger.steps.find(
      (step) => step.id === input.upgradeLedger.currentStepId,
    ) ?? null;
  return {
    mode: "embedded-always-on" as const,
    upgradeFront: {
      currentPosition: input.upgradeLedger.currentPosition,
      stageGoal: input.upgradeLedger.stageGoal,
      settlementTarget: input.upgradeLedger.settlementTarget,
      currentStep,
      retainedAssets: input.creativeContext.frame.inheritedState.retainedAssets,
    },
    actorFront: {
      currentPeople: input.field.objects
        .filter((object) => object.kind === "character")
        .map((object) => ({
          objectId: object.id,
          entityId: object.entityId,
          name: object.name,
        })),
      activeStakes:
        input.creativeContext.frame.inheritedState.activeStakeLedger,
    },
    readerFront: {
      openExpectationThreads:
        input.creativeContext.frame.inheritedState.openExpectationThreads,
      unresolvedQuestions:
        input.creativeContext.frame.inheritedState.unresolvedQuestions,
    },
  };
}

function searchOutputIssues(
  value: StoryAuthoringSearchOutput,
  field: StoryObjectField,
): string[] {
  const issues: string[] = [];
  const allowed = new Set(field.objects.map((object) => object.id));
  const allowedSurfaces = new Set(
    field.objects.flatMap((object) =>
      object.surfaces.map((surface) =>
        storyObjectSurfaceRef(object.id, surface),
      ),
    ),
  );
  if (value.scaleResult.scale !== field.scale) {
    issues.push(
      `scaleResult.scale must equal field.scale (${field.scale}), got ${value.scaleResult.scale}`,
    );
  }
  for (const focus of value.objectFocus) {
    if (!allowed.has(focus.objectId)) {
      issues.push(`objectFocus: unknown objectId ${focus.objectId}`);
    }
    for (const surfaceRef of focus.surfaceRefs) {
      if (!allowedSurfaces.has(surfaceRef)) {
        issues.push(`objectFocus: unknown surfaceRef ${surfaceRef}`);
      }
    }
  }
  for (const seed of value.seeds) {
    if (seed.candidateNewObjects.length > 0) {
      issues.push(
        `seed ${seed.id}: candidateNewObjects must be empty; report a worldGap instead`,
      );
    }
    for (const objectId of seed.anchorObjectIds) {
      if (!allowed.has(objectId)) {
        issues.push(`seed ${seed.id}: unknown anchorObjectId ${objectId}`);
      }
    }
    for (const surfaceRef of seed.groundingSurfaceRefs) {
      if (!allowedSurfaces.has(surfaceRef)) {
        issues.push(
          `seed ${seed.id}: unknown groundingSurfaceRef ${surfaceRef}`,
        );
      }
    }
  }
  return issues;
}

function storyUnitOutputIssues(
  value: StoryUnitDesignOutput,
  field: StoryObjectField,
  creativeContext: StoryCreativeContext,
): string[] {
  const issues: string[] = [];
  const allowedObjects = new Set(field.objects.map((object) => object.id));
  const allowedSurfaces = new Set(
    field.objects.flatMap((object) =>
      object.surfaces.map((surface) =>
        storyObjectSurfaceRef(object.id, surface),
      ),
    ),
  );
  const allowedEntities = new Set(
    field.objects.map((object) => object.entityId),
  );
  const campEntities = new Set(
    value.campNetwork.map((member) => member.entityId),
  );
  const stakeIds = new Set(value.stakeLedger.map((entry) => entry.id));
  const stakesByEntity = new Map<string, string[]>();
  for (const entry of value.stakeLedger) {
    if (!allowedEntities.has(entry.entityId)) {
      issues.push(`stakeLedger: unknown entityId ${entry.entityId}`);
    }
    const ids = stakesByEntity.get(entry.entityId) ?? [];
    ids.push(entry.id);
    stakesByEntity.set(entry.entityId, ids);
  }
  const reactionTargetEntities = new Set(
    value.reactionTargets.map((target) => target.entityId),
  );
  const informationSteps = new Set(
    value.informationRelease.map((item) => item.step),
  );

  const wishFrame = creativeContext.wishFulfillment;
  const advancedThreadIds = new Set(
    value.wishFulfillmentAdvances.map((advance) => advance.threadId),
  );
  const bearingRequirementById = new Map(
    wishFrame?.bearingRequirements.map((requirement) => [
      requirement.id,
      requirement,
    ]) ?? [],
  );
  const bearingKindsByRef = new Map(
    storyBearingEvidenceCandidates(field).map((candidate) => [
      candidate.evidenceRef,
      new Set(candidate.bearingKinds),
    ]),
  );
  const bearingBindingIds = new Set<string>();
  for (const binding of value.bearingEvidence) {
    if (bearingBindingIds.has(binding.requirementId)) {
      issues.push(
        `bearingEvidence: duplicate requirementId ${binding.requirementId}`,
      );
    }
    bearingBindingIds.add(binding.requirementId);
    const requirement = bearingRequirementById.get(binding.requirementId);
    if (!requirement) {
      issues.push(
        `bearingEvidence: unknown requirementId ${binding.requirementId}`,
      );
    } else if (
      !requirement.threadIds.some((threadId) => advancedThreadIds.has(threadId))
    ) {
      issues.push(
        `bearingEvidence: requirement ${binding.requirementId} is unrelated to advanced threads`,
      );
    }
    for (const evidenceRef of binding.evidenceRefs) {
      if (!allowedSurfaces.has(evidenceRef)) {
        issues.push(
          `bearingEvidence[${binding.requirementId}]: unknown surfaceRef ${evidenceRef}`,
        );
        continue;
      }
      if (
        requirement &&
        !bearingKindsByRef.get(evidenceRef)?.has(requirement.kind)
      ) {
        issues.push(
          `bearingEvidence[${binding.requirementId}]: surfaceRef ${evidenceRef} cannot prove ${requirement.kind}`,
        );
      }
    }
  }
  if (value.status === "READY" && wishFrame) {
    for (const threadId of advancedThreadIds) {
      const related = wishFrame.bearingRequirements.filter((requirement) =>
        requirement.threadIds.includes(threadId),
      );
      if (related.length === 0) {
        issues.push(
          `wishFulfillmentAdvances: thread ${threadId} has no bearing requirement`,
        );
      }
      for (const requirement of related) {
        if (
          requirement.status !== "grounded" &&
          !bearingBindingIds.has(requirement.id)
        ) {
          issues.push(
            `bearingEvidence: missing requirement ${requirement.id} for thread ${threadId}`,
          );
        }
      }
    }
  }
  for (const objectId of value.objectAnchorIds) {
    if (!allowedObjects.has(objectId)) {
      issues.push(`objectAnchorIds: unknown objectId ${objectId}`);
    }
  }
  for (const surfaceRef of value.groundingSurfaceRefs) {
    if (!allowedSurfaces.has(surfaceRef)) {
      issues.push(`groundingSurfaceRefs: unknown surfaceRef ${surfaceRef}`);
    }
  }
  for (const member of value.campNetwork) {
    if (!allowedEntities.has(member.entityId)) {
      issues.push(`campNetwork: unknown entityId ${member.entityId}`);
    }
  }
  for (const target of value.reactionTargets) {
    if (!stakesByEntity.has(target.entityId)) {
      issues.push(
        `reactionTargets: entity ${target.entityId} has no priced stake`,
      );
    }
    if (!campEntities.has(target.entityId)) {
      issues.push(
        `reactionTargets: entity ${target.entityId} is not in campNetwork`,
      );
    }
  }
  for (const transition of value.campTransitions) {
    if (!campEntities.has(transition.entityId)) {
      issues.push(
        `campTransitions: entity ${transition.entityId} is not in campNetwork`,
      );
    }
  }
  for (const entityId of value.appearanceOrderEntityIds) {
    if (!campEntities.has(entityId)) {
      issues.push(
        `appearanceOrderEntityIds: entity ${entityId} is not in campNetwork`,
      );
    }
  }
  for (const event of value.events) {
    const cast = new Set(event.castPoolEntityIds);
    for (const entityId of event.castPoolEntityIds) {
      if (!allowedEntities.has(entityId)) {
        issues.push(`event ${event.id}: unknown castPool entityId ${entityId}`);
      }
    }
    for (const entityId of event.activeSeedEntityIds) {
      if (!cast.has(entityId)) {
        issues.push(
          `event ${event.id}: activeSeed ${entityId} is outside castPool`,
        );
      }
    }
    const pressureActors = new Set(
      event.actorPressures.map((item) => item.entityId),
    );
    for (const stakeId of event.stakeEntryIds) {
      if (!stakeIds.has(stakeId)) {
        issues.push(`event ${event.id}: unknown stakeEntryId ${stakeId}`);
      }
      const stake = value.stakeLedger.find((entry) => entry.id === stakeId);
      if (stake && !cast.has(stake.entityId)) {
        issues.push(
          `event ${event.id}: stake ${stakeId} belongs to ${stake.entityId} outside castPool`,
        );
      }
    }
    for (const entityId of event.castPoolEntityIds) {
      if (!pressureActors.has(entityId)) {
        issues.push(
          `event ${event.id}: missing actorPressure for cast entity ${entityId}`,
        );
      }
    }
    for (const entityId of pressureActors) {
      if (!cast.has(entityId)) {
        issues.push(
          `event ${event.id}: actorPressure entity ${entityId} is outside castPool`,
        );
      }
    }
    for (const entityId of event.reactionTargetEntityIds) {
      const activeStakeIds = new Set(event.stakeEntryIds);
      const priced = (stakesByEntity.get(entityId) ?? []).some((stakeId) =>
        activeStakeIds.has(stakeId),
      );
      if (!priced) {
        issues.push(
          `event ${event.id}: reaction target ${entityId} has no active stake`,
        );
      }
      if (!reactionTargetEntities.has(entityId)) {
        issues.push(
          `event ${event.id}: reaction target ${entityId} has no S04 reactionTarget`,
        );
      }
      if (!cast.has(entityId)) {
        issues.push(
          `event ${event.id}: reaction target ${entityId} is outside castPool`,
        );
      }
    }
    for (const step of event.informationReleaseSteps) {
      if (!informationSteps.has(step)) {
        issues.push(
          `event ${event.id}: unknown informationRelease step ${step}`,
        );
      }
    }
    const phaseNames = new Set<string>();
    for (const target of event.phaseTargets) {
      if (phaseNames.has(target.phase)) {
        issues.push(`event ${event.id}: duplicate phaseTarget ${target.phase}`);
      }
      phaseNames.add(target.phase);
      for (const entityId of target.entityIds) {
        if (!cast.has(entityId)) {
          issues.push(
            `event ${event.id}: phase ${target.phase} entity ${entityId} is outside castPool`,
          );
        }
      }
    }
  }
  return issues;
}

function wishFulfillmentPlanningIssues(
  value: WishFulfillmentPlanningOutput,
  request: WishFulfillmentPlanningModelRequest,
): string[] {
  const issues: string[] = [];
  const allowedObjectIds = new Set(
    request.field.objects.map((object) => object.id),
  );
  const threadIds = new Set<string>();
  const targetThreadCounts = new Map<string, number>();

  for (const thread of value.threads) {
    if (threadIds.has(thread.id)) {
      issues.push(`threads: duplicate id ${thread.id}`);
    }
    threadIds.add(thread.id);
    if (thread.targetRefs.length === 0) {
      issues.push(`thread ${thread.id}: targetRefs must name real Module-2 objects`);
    }
    for (const targetRef of thread.targetRefs) {
      if (!allowedObjectIds.has(targetRef)) {
        issues.push(`thread ${thread.id}: unknown targetRef ${targetRef}`);
      } else {
        targetThreadCounts.set(
          targetRef,
          (targetThreadCounts.get(targetRef) ?? 0) + 1,
        );
      }
    }
  }

  if (![...targetThreadCounts.values()].some((count) => count >= 2)) {
    issues.push(
      "threads: at least one high-value object must carry multiple simultaneous wish-fulfillment threads; do not reduce each object to one chosen relation",
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
      "settlementTargets: at least one selected thread must name the real gain expected from this fantasy line",
    );
  }

  return issues;
}

/**
 * Author-side writers' room service.
 *
 * S01-S03 are optional lenses over one inherited creative frame. S04 turns
 * concrete Module-2 objects into an authored story unit around the protagonist.
 * Character execution chooses concrete performance inside the authored line.
 */
export class StoryAuthoringService {
  constructor(
    private readonly model: NarrativeModelClient,
    _legacyCreativeMaterials?: unknown,
  ) {
    void _legacyCreativeMaterials;
  }

  /**
   * Plan the shared male-frequency fantasy axis only when no author-provided
   * or inherited WishFulfillmentFrame exists. This is author/director-side
   * creative direction, not a fourth module and never world truth.
   */
  async planWishFulfillment(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: WishFulfillmentPlanningModelRequest,
    signal: AbortSignal,
  ): Promise<StoryAuthoringModelResult<WishFulfillmentFrame>> {
    if (
      run.projectId !== request.field.projectId ||
      request.field.scale !== "S04" ||
      request.request.trim().length === 0 ||
      request.readerNeed.trim().length === 0 ||
      request.targetEmotion.trim().length === 0 ||
      request.protagonistCamera.projectId !== request.field.projectId ||
      request.protagonistCamera.protagonistEntityId !==
        request.upgradeLedger.protagonistEntityId ||
      !request.field.objects.some(
        (object) =>
          object.entityId === request.protagonistCamera.protagonistEntityId,
      )
    ) {
      throw new Error("story_authoring.invalid_wish_fulfillment_request");
    }

    const result = await this.model.structured(
      run,
      step,
      "story-wish-fulfillment-planning",
      {
        instructions: [
          "你在作者/Director侧先决定这轮商业男频到底要意淫什么，再进入Expectation与StoryUnit。不要把这一步降级成升级字段改写。",
          WISH_FULFILLMENT_ROOT_GUARD.readerQuestion,
          WISH_FULFILLMENT_ROOT_GUARD.protagonistQuestion,
          WISH_FULFILLMENT_ROOT_GUARD.expansionQuestion,
          WISH_FULFILLMENT_ROOT_GUARD.bearingQuestion,
          WISH_FULFILLMENT_ROOT_GUARD.settlementQuestion,
          WISH_FULFILLMENT_ROOT_GUARD.antiBalanceTax,
          "先读当前 Object Field 里的具体人、能力、组织、地点、资产、Reader Semantics、世界价格、关系和入口。想象必须有对象；targetRefs只能引用真实 object.id。",
          "不要只输出‘获得当前升级收益 + 进入更高圈层’两条模板线。优先找 Reader 真馋的高价对象，并把同一个对象展开成多条可长期升价的线程。",
          "高价人物尤其不要单选关系。若世界对象支持，可以同时展开：注意/认可、师承、主动合作、需要男主、私人准入、公开背书、权力联盟、偏爱、独占例外、公开重新定价、命运改写等。它们是不同剧情资产，不互相替代。",
          "高价技能/资产也要展开：真正拥有、独门使用、身份标签、高手重新定价、打开高阶圈层、继续开发、形成事业或权限等，而不是只写‘学会技能’。",
          "Reader Fantasy 与 protagonistDesire 必须分开。Reader可以期待更大的高价人生；具体男主当前只能按自己的目标、性格和Reality行动。",
          "每条thread都必须有bearing requirement。承重负责把幻想托贵，不负责削弱收益。没有合适Reality就标missing，后续返回World Gap；不要发明冷却、反噬、寿命税、净亏损、感情债来平衡。",
          "planner没有权限宣布承重已成立、幻想已实现或收益已资产化。thread.phase只能selected/candidate；bearing.status只能candidate/missing；evidenceRefs必须为空。",
          "至少让一个高价对象承载两条以上不同意淫展开，防止把多声部关系压成单选题。不要为了凑数量机械枚举八类；只展开当前对象真正有价格、能长期写Story的线。",
          "settlementTargets写未来真正希望结算进男主人生的权益。计划收益不是Reality，后续仍必须经过Grounded Settlement。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                request: request.request,
                readerNeed: request.readerNeed,
                targetEmotion: request.targetEmotion,
                protagonistCamera: request.protagonistCamera,
                upgradeLedger: request.upgradeLedger,
                objectField: {
                  digest: request.field.digest,
                  storyTimeLabel: request.field.storyTimeLabel,
                  objects: fieldObjectCatalog(request.field),
                },
                bearingEvidenceCandidates: storyBearingEvidenceCandidates(
                  request.field,
                ),
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      WISH_FULFILLMENT_PLANNING_CONTRACT,
      zodValidator(WishFulfillmentPlanningOutputSchema, (value) =>
        wishFulfillmentPlanningIssues(value, request),
      ),
      signal,
    );

    const value = WishFulfillmentFrameSchema.parse({
      version: "wish-fulfillment-frame.v1",
      authority: "creative-direction",
      mode: "story_current",
      protagonistEntityId: request.protagonistCamera.protagonistEntityId,
      readerFantasy: result.value.readerFantasy,
      protagonistDesire: result.value.protagonistDesire,
      threads: result.value.threads,
      bearingRequirements: result.value.bearingRequirements,
      settlementTargets: result.value.settlementTargets,
    });

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }

  /**
   * Compatibility entry retained for callers that used the former auto-router.
   *
   * It no longer selects methods or recalls materials automatically. Explicit
   * Module-2 operator invocations already present in creativeContext are
   * preserved; otherwise the Story Director proceeds with embedded M01B only.
   */
  async searchWithCreativeMethods(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryAuthoringSearchModelRequest,
    signal: AbortSignal,
  ): Promise<StoryAuthoringRoutedSearchResult> {
    assertStoryCreativeContextBound(
      request.creativeContext,
      request.field,
      request.upgradeLedger,
    );

    const routing = await new CreativeMethodRoutingService(
      this.model,
    ).routeStorySearch(
      run,
      step,
      {
        field: request.field,
        creativeContext: request.creativeContext,
        upgradeLedger: request.upgradeLedger,
        request: request.request,
        readerNeed: request.readerNeed,
        targetEmotion: request.targetEmotion,
      },
      signal,
    );
    const search = await this.search(
      run,
      step,
      { ...request, creativeContext: routing.creativeContext },
      signal,
    );
    return { routing, search };
  }

  async search(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryAuthoringSearchModelRequest,
    signal: AbortSignal,
  ): Promise<StoryAuthoringModelResult<StoryAuthoringSearch>> {
    if (
      run.projectId !== request.field.projectId ||
      !["S01", "S02", "S03"].includes(request.field.scale) ||
      request.field.objects.length === 0 ||
      !request.field.objects.some(
        (object) =>
          object.entityId === request.upgradeLedger.protagonistEntityId,
      ) ||
      request.request.trim().length === 0 ||
      request.readerNeed.trim().length === 0 ||
      request.targetEmotion.trim().length === 0
    ) {
      throw new Error("story_authoring.invalid_search_request");
    }

    assertStoryCreativeContextBound(
      request.creativeContext,
      request.field,
      request.upgradeLedger,
    );

    const scaleInstruction =
      request.field.scale === "S01"
        ? "S01只是长程视角：围绕既定 Upgrade Ledger 看这条 Road 为什么能持续、哪些现有人物/圈层/资源会成为后续价格阶梯。不要把它当成另一台从零生成 Story Concept 的机器。"
        : request.field.scale === "S02"
          ? "S02只是当前阶段视角：围绕 upgradeLedger.currentStepId / stageGoal，看现有人物网如何给这一层升级定价、设门槛、提供入口。不要脱离升级路线另造一条人生。"
          : "S03只是当前故事视角：围绕当前 stageGoal，从现成人物的认知、利益、关系、正在做的事中寻找可下注、可碰撞、可结算的 Story Seed。不要凭空造新人物，也不要直接写完整 S04。";

    const result = await this.model.structured(
      run,
      step,
      "story-object-grounded-search",
      {
        instructions: [
          "你在作者侧 Writers' Room 工作。所有想象和脑洞必须先有想象对象。",
          "输入 Object Field 来自 Module 2 的 Project Reality / Source Atlas 投影。它是想象底座，不是背景装饰。",
          "禁止先想一个熟悉套路，再回来给套路贴世界名词。先看具体对象当前是谁、拥有什么、缺什么、和谁相连、什么规则给它定价，再做连接、交叉、对立、变奏、因果追踪或成熟故事迁移。",
          "每颗 Story Seed 的 anchorObjectIds 必须引用 Object Field 中真实 object.id，groundingSurfaceRefs 必须引用对象 surfaces 中提供的 ref。Observation 必须能从这些具体 surfaces 推出来，不能只借两个真名字编一条不存在的关系。",
          "第三模块不负责捏人或补世界。candidateNewObjects 必须为空。若当前 Story 真正缺人物、关系、制度、组织、资源或入口，写入 worldGaps，回 Module 1 / World Builder 生产后再继续。尤其禁止为了‘需要一个识货人/反派/妹妹位’临时造功能NPC。",
          "如果 Object Field 太薄，status 必须返回 BLOCKED_WORLD_GAP。worldGaps 必须结构化写出缺什么、锚在哪些已有对象、为什么缺，并用 productionHint 指向现有 World Builder workshop。此时允许 seeds 与尺度结果为空，不要为了过 schema 用‘神秘高手/反派/美女/商会’占位补洞。",
          "Creative Frame 是当前长篇创作状态：必须继承父层与同层前序区段，不能把当前区段当成新书重新开机。",
          "男主是故事推演的主摄像机。先问 protagonistCamera 中男主现在在哪里、想得到什么、这一步准备主动做什么，再看他的行动会撞到哪些现成人物、资源、组织和规则。",
          "M01B不是可选methodInvocation，而是第三模块常驻三意识：始终同时听升级是否真正变贵、现有人物接下来会自己干什么、Reader已经在等什么；三者互相触发、回返，不能机械排成三步流程。",
          "creativeContext.methodInvocations 只承载从 Module 2 Creative Operator Space 按需显式调用的算子；creativeContext.materialSelections 承载从 Module 2 Creative Material Space 召回的具体素材。M03素材卡不是算法，两类输入都不能自动成为 Canon。",
          "没有显式算子调用时不要自动挑一个方法。存在methodInvocations时，按每次调用的purpose与instruction解决那个局部卡点；算子可以重复、回返、切换，但不构成固定主辅流程。每颗Seed的searchMove要能看出实际使用了什么搜索运动。",
          "S01/S02/S03 不是 S Framework 本体，更不是三台独立故事生成器，只是同一 Creative Frame / Upgrade Ledger 的长程 / 当前阶段 / 当前故事观察尺度。所有结果必须服务同一条 Road。",
          "候选可以分叉、回返和失败；不要为了尽快交付而把第一条可行答案冒充完成。",
          scaleInstruction,
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                scale: request.field.scale,
                request: request.request,
                readerNeed: request.readerNeed,
                targetEmotion: request.targetEmotion,
                protagonistProfile: request.protagonistProfile,
                creativeContext: request.creativeContext,
                m01bContinuity: m01bContinuitySnapshot({
                  field: request.field,
                  creativeContext: request.creativeContext,
                  upgradeLedger: request.upgradeLedger,
                }),
                upgradeLedger: request.upgradeLedger,
                objectField: {
                  digest: request.field.digest,
                  storyTimeLabel: request.field.storyTimeLabel,
                  objects: fieldObjectCatalog(request.field),
                },
                methodInstructions: request.methodInstructions ?? null,
                legacyMatureStoryMaterials:
                  request.matureStoryMaterials ?? null,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      STORY_AUTHORING_SEARCH_CONTRACT,
      zodValidator(StoryAuthoringSearchOutputSchema, (value) =>
        searchOutputIssues(value, request.field),
      ),
      signal,
    );

    const value = finalizeStoryAuthoringSearch(
      {
        version: "story-authoring-search.v1",
        authority: "speculative",
        status: result.value.status,
        projectId: request.field.projectId,
        scale: request.field.scale as "S01" | "S02" | "S03",
        objectFieldDigest: request.field.digest,
        creativeContextDigest: request.creativeContext.digest,
        question: result.value.question,
        objectFocus: result.value.objectFocus,
        seeds: result.value.seeds,
        worldGaps: result.value.worldGaps,
        scaleResult: result.value.scaleResult,
      },
      request.field,
      request.creativeContext,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }

  async designStoryUnit(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryUnitDesignModelRequest,
    signal: AbortSignal,
  ): Promise<StoryAuthoringModelResult<StoryUnitDesign>> {
    if (
      run.projectId !== request.field.projectId ||
      request.field.scale !== "S04" ||
      request.expectationDesign.projectId !== request.field.projectId ||
      !request.field.objects.some(
        (object) =>
          object.entityId === request.upgradeLedger.protagonistEntityId,
      ) ||
      request.request.trim().length === 0
    ) {
      throw new Error("story_authoring.invalid_story_unit_request");
    }

    assertStoryCreativeContextBound(
      request.creativeContext,
      request.field,
      request.upgradeLedger,
    );

    if (
      request.sourceSearch &&
      (request.sourceSearch.projectId !== request.field.projectId ||
        request.sourceSearch.scale !== "S03" ||
        request.sourceSearch.creativeContextDigest !==
          request.creativeContext.digest)
    ) {
      throw new Error("story_authoring.source_search_not_bound");
    }

    const availableSeedIds = new Set(
      request.sourceSearch?.seeds.map((seed) => seed.id) ?? [],
    );
    const currentObjectIds = new Set(
      request.field.objects.map((object) => object.id),
    );
    for (const seedId of request.sourceSeedIds) {
      if (!availableSeedIds.has(seedId)) {
        throw new Error(`story_authoring.unknown_source_seed:${seedId}`);
      }
      const seed = request.sourceSearch?.seeds.find(
        (candidate) => candidate.id === seedId,
      );
      const currentSurfaceRefs = new Set(
        request.field.objects.flatMap((object) =>
          object.surfaces.map((surface) =>
            storyObjectSurfaceRef(object.id, surface),
          ),
        ),
      );
      if (
        !seed ||
        seed.anchorObjectIds.some(
          (objectId) => !currentObjectIds.has(objectId),
        ) ||
        seed.groundingSurfaceRefs.some(
          (surfaceRef) => !currentSurfaceRefs.has(surfaceRef),
        )
      ) {
        throw new Error(`story_authoring.stale_source_seed:${seedId}`);
      }
    }

    const selectedSeeds =
      request.sourceSearch?.seeds.filter((seed) =>
        request.sourceSeedIds.includes(seed.id),
      ) ?? [];

    const result = await this.model.structured(
      run,
      step,
      "story-unit-design",
      {
        instructions: [
          "你在 S04 Writers' Room 设计一出故事。小说不是世界自转后的监控录像，也不是让 Character Agents 随机生活后再捡精彩片段。",
          "先从给定 Object Field 与已选 Story Seeds 选择具体对象，再设计为什么这些对象现在要撞在一起。READY 时 groundingSurfaceRefs 必须指出这出 Story 具体踩在哪些 Object surfaces 上，不能只引用对象名。",
          "Creative Frame 是长期创作状态，不是提示词标题。先继承 parentFrames 与 previousSiblingFrames 已经成立的目标、关系、结果和未结事项，再设计当前区段。",
          "Protagonist Camera 是本轮推演起点。男主不是旁观摄像头，而是主动行动者：围绕 currentGoal / upgradeNeed / activeMove，让他去碰 Module 2 已有的人、资源、组织、制度与高价对象，由这些人的下注与反应形成剧情。",
          "M01B三意识在S04仍然常驻：升级意识持续追问这出戏结束后男主真正变贵什么；人物自己找事持续追问现有人物基于欲望、认知、利益和已下注筹码下一手会干什么；Reader张力持续追问已经立价的期待怎样蓄力、兑现或合法转期。三者是同时运行的前线，不是额外三步。",
          "Creative Method Invocations 是从第二模块按需拿来的创意算子。只有调用方明确点名时才执行；它们帮助局部搜索、迁移、组合、变奏或压力测试，但不接管讲师Story Director主流程。",
          "Upgrade Ledger 是这部长篇已经确定的升级路线与当前阶段，不是本轮临时脑洞。StoryUnit 必须服务 currentStepId / stageGoal / settlementTarget，不能等一次互动结束后再问‘下一故事自然长什么’。",
          "Expectation Design 已经给出 Reader 需求、目标情绪、稀缺性方向、固有认知、主角优势、反应与收益方向。不得偷换这笔交易。",
          "creativeContext.wishFulfillment 是三模块共享的男频纵轴。Reader意淫什么、男主自己想要什么、怎么意淫、怎样实现、靠什么Reality承重，都必须继续参与当前Story设计。",
          "意淫展开不是单选。同一个高价人物/能力可以同时拥有认可、师承、需要、私人准入、公开背书、偏爱、政治联盟、拥有、命运改写等多条thread；当前StoryUnit只推进真正该推进的若干条，但不得把整束关系压成一个desiredRelation。",
          "READY时 wishFulfillmentAdvances 必须指出本轮具体推进哪些thread以及Story怎样推进。bearingEvidence必须逐条写 requirementId + evidenceRefs：每个尚未grounded、且关联到本轮推进thread的承重要求都要用 Object Field 真实 surface ref 单独证明。只能引用 bearingEvidenceCandidates 中 bearingKinds 包含该 requirement.kind 的证据；证明‘这个人很贵’不能顺手证明‘她会给私人准入/政治背书/偏爱/命运改写’，每种承重各算各的。",
          "如果缺少关键承重就返回 BLOCKED_WORLD_GAP，让 Module 1 补世界。禁止用副作用、失败、净亏损、情感债或‘太爽所以要平衡’替代意淫承重。",
          "三阵营首先是编剧工具：只从 Object Field 中已经存在的人物划分当前友方/敌方/中立/其他利益位置。禁止为了‘需要一个识货人/反派/妹妹位’在第三模块临时造功能NPC。",
          "配角反应是爽点，但反应必须先定价。stakeLedger 是核心：每个关键配角先写 currentBelief/currentInterest，再写他因此做出的 stakeAction、压上的 stakeAssets、撤退成本、后续怎样加注，最后才设计 payoffReaction 与 settlementChange。不是只写‘他觉得主角不行’。",
          "作者/Director可以主动设计震惊、投靠、后悔、误判、犯蠢、变脸、效忠等反应方向。要求不是‘人物不能被作者设计’，而是铺垫、固有认知、利益、人设与下注成立。",
          "appearanceOrderEntityIds 与 informationRelease 负责谁先进入、Reader/人物分别何时知道什么。",
          "events 是有顺序的 S05 Story Node，不是 Agent 模拟结果。每个 Node 必须只有一个清楚的 problem：主线化为节点，每个节点一个问题，这个问题之后会在 S06 影响多个场景。",
          "每个 S05 Node 要写 storyPressure、realityQuestion、readerExpectation；用 phaseTargets 明确 before / during / after 哪些人物线要被展开，用 reactionTargetEntityIds 关联 S04 已设计的反应目标，用 informationReleaseSteps 关联这一节点承接的信息释放步骤。",
          "Cast Pool 是这个 Node 可能卷入的人物池；Active Seed 是第一轮真正被激活的人。actorPressures 为 Cast Pool 每个人写当前刺激条件；stakeEntryIds 必须指向本 Node 正在推进/加注/结算的 Stake Ledger 项。",
          "Character Model + World Arbiter 只是 S05 Node 内部的演法与硬事实检查，不拥有上位编剧权。Director 已经决定人物线的戏剧方向；Character Model 要在这一方向内寻找最符合人设、利益、既有认知与可见 Reality 的具体行动/表达。只有时间、地点、资源、知识、规则等硬事实冲突才允许判定当前演法不可执行，再回 S05 调整演法，而不是取消这条商业男频人物线。",
          "S06 会把通过 Reality 约束的一个 Node 展开为多个 Scene，所以这里不要把 event 写成单一场景摘要，也不要提前把 scene 数量压成一个动作结果。",
          "如果当前对象不够支撑这出戏，status 必须返回 BLOCKED_WORLD_GAP，把缺口结构化写入 worldGaps，并用 productionHint 指向现有 World Builder workshop，events 为空；不要为了过 schema 凭空造人物、关系或事件。对象足够时返回 READY。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                request: request.request,
                objectField: {
                  digest: request.field.digest,
                  storyTimeLabel: request.field.storyTimeLabel,
                  objects: fieldObjectCatalog(request.field),
                },
                creativeContext: request.creativeContext,
                m01bContinuity: m01bContinuitySnapshot({
                  field: request.field,
                  creativeContext: request.creativeContext,
                  upgradeLedger: request.upgradeLedger,
                }),
                selectedSeeds,
                wishFulfillment: request.creativeContext.wishFulfillment,
                bearingEvidenceCandidates: storyBearingEvidenceCandidates(
                  request.field,
                ),
                upgradeLedger: request.upgradeLedger,
                expectationDesign: request.expectationDesign,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      STORY_UNIT_DESIGN_CONTRACT,
      zodValidator(StoryUnitDesignOutputSchema, (value) =>
        storyUnitOutputIssues(value, request.field, request.creativeContext),
      ),
      signal,
    );

    const value = finalizeStoryUnitDesign(
      {
        version: "story-unit-design.v1",
        authority: "speculative",
        status: result.value.status,
        projectId: request.field.projectId,
        objectFieldDigest: request.field.digest,
        creativeContextDigest: request.creativeContext.digest,
        sourceSeedIds: [...request.sourceSeedIds],
        expectationDesignDigest: request.expectationDesign.digest,
        objectAnchorIds: result.value.objectAnchorIds,
        groundingSurfaceRefs: result.value.groundingSurfaceRefs,
        storyProblem: result.value.storyProblem,
        worldGaps: result.value.worldGaps,
        wishFulfillmentAdvances: result.value.wishFulfillmentAdvances,
        bearingEvidence: result.value.bearingEvidence,
        upgradeLedger: request.upgradeLedger,
        campNetwork: result.value.campNetwork,
        stakeLedger: result.value.stakeLedger,
        reactionTargets: result.value.reactionTargets,
        campTransitions: result.value.campTransitions,
        appearanceOrderEntityIds: result.value.appearanceOrderEntityIds,
        informationRelease: result.value.informationRelease,
        events: result.value.events,
        directorAuthority: "author-defined-story-line",
        characterExecutionRule: "characterization-constrained-performance",
      },
      request.field,
      request.expectationDesign,
      request.creativeContext,
      availableSeedIds,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }
}
