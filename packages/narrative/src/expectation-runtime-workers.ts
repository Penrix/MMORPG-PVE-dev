import { z } from "zod";

import {
  StoryReaderTimeSceneDecisionSchema,
  type ExpectationDesign,
  type ExpectationDesignEvidence,
  type ExpectationState,
  type NarrativeAllocationBatch,
  type NarrativeAllocationDecisionDraft,
  type NarrativeCandidate,
  type StoryReaderTimePlan,
  type StorySceneExpansion,
  type WorldArbitrationReceipt,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { JsonSchemaContract } from "@narralume/llm";

import type { NarrativeModelClient } from "./model-client.js";
import { zodValidator } from "./schemas.js";
import {
  finalizeExpectationDesign,
  finalizeNarrativeAllocationBatch,
  finalizeStoryReaderTimePlan,
} from "./expectation-runtime.js";

const ExpectationDesignOutputSchema = z.object({
  targetOutcome: z.string().min(1),
  scarcityIntents: z
    .array(
      z.object({
        claim: z.string().min(1),
        subjectRef: z.string().min(1).nullable(),
        existingEvidenceRefs: z.array(z.string().min(1)),
        evidenceToEstablish: z.array(z.string().min(1)),
      }),
    )
    .min(1),
  beliefIntents: z
    .array(
      z.object({
        proposition: z.string().min(1),
        scope: z.enum(["world", "circle", "identity", "character"]),
        holderEntityIds: z.array(z.string().min(1)),
        existingEvidenceRefs: z.array(z.string().min(1)),
        stakeToCultivate: z.array(z.string().min(1)),
        breakCondition: z.string().min(1),
      }),
    )
    .min(1),
  protagonistAdvantageRefs: z.array(z.string().min(1)).min(1),
  reactionTargetEntityIds: z.array(z.string().min(1)),
  retainedGainTarget: z.string().min(1).nullable(),
  activationEntityIds: z.array(z.string().min(1)),
  worldFocusRefs: z.array(z.string().min(1)),
  designReasons: z.array(z.string().min(1)).min(1).max(12),
});
type ExpectationDesignOutput = z.infer<typeof ExpectationDesignOutputSchema>;

const EXPECTATION_DESIGN_CONTRACT: JsonSchemaContract = {
  name: "story_expectation_design",
  strict: true,
  schema: z.toJSONSchema(ExpectationDesignOutputSchema),
};

const NarrativeAllocationOutputItemSchema = z.object({
  candidateId: z.string().min(1),
  action: z.enum(["skip", "background", "seed", "charge", "payoff"]),
  readerTime: z.enum(["none", "mention", "beat", "scene", "chapter"]),
  expectationThreadIds: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1)).min(1).max(12),
  deepenScarcityEvidenceIds: z.array(z.string().min(1)).max(20),
  reinforceBeliefIds: z.array(z.string().min(1)).max(20),
  widenGapBeliefIds: z.array(z.string().min(1)).max(20),
  embodimentTargets: z.array(z.string().min(1)).max(12),
  payoffThreadIds: z.array(z.string().min(1)).max(12),
  reactionTargetEntityIds: z.array(z.string().min(1)).max(30),
  retainedGainOpportunity: z.string().min(1).nullable(),
});

const NarrativeAllocationOutputSchema = z.object({
  decisions: z.array(NarrativeAllocationOutputItemSchema).min(1),
});
type NarrativeAllocationOutput = z.infer<
  typeof NarrativeAllocationOutputSchema
>;

const NARRATIVE_ALLOCATION_CONTRACT: JsonSchemaContract = {
  name: "story_expectation_narrative_allocation",
  strict: true,
  schema: z.toJSONSchema(NarrativeAllocationOutputSchema),
};

const StoryReaderTimeOutputSchema = z.object({
  decisions: z.array(StoryReaderTimeSceneDecisionSchema).min(1),
});
type StoryReaderTimeOutput = z.infer<typeof StoryReaderTimeOutputSchema>;

const STORY_READER_TIME_CONTRACT: JsonSchemaContract = {
  name: "story_scene_reader_time_plan",
  strict: true,
  schema: z.toJSONSchema(StoryReaderTimeOutputSchema),
};

export interface ExpectationDesignModelRequest {
  projectId: string;
  protagonistId: string;
  readerNeed: string;
  targetEmotion: string;
  realityFingerprint: string;
  storyStateFingerprint: string;
  evidence: readonly ExpectationDesignEvidence[];
}

export interface ExpectationAllocationModelRequest {
  state: ExpectationState;
  candidates: readonly NarrativeCandidate[];
}

export interface StoryReaderTimeModelRequest {
  state: ExpectationState;
  sceneExpansion: StorySceneExpansion;
}

export interface ExpectationRuntimeModelResult<T> {
  value: T;
  usage: RunBudgetUsage;
  generation: {
    mode: "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

/**
 * Expectation design + S07 Reader Time.
 *
 * The official S07 path is S06 StorySceneExpansion → StoryReaderTimePlan.
 * Raw arbitration is intentionally forbidden from bypassing Scene Expansion.
 * The generic candidate allocator remains a lower-level compatibility helper,
 * not the current S07 orchestration entry.
 */
export class ExpectationNarrativeService {
  constructor(private readonly model: NarrativeModelClient) {}

  async designExpectation(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: ExpectationDesignModelRequest,
    signal: AbortSignal,
  ): Promise<ExpectationRuntimeModelResult<ExpectationDesign>> {
    if (
      run.projectId !== request.projectId ||
      request.evidence.length === 0 ||
      request.readerNeed.trim().length === 0 ||
      request.targetEmotion.trim().length === 0
    ) {
      throw new Error("story_runtime.expectation.invalid_design_request");
    }

    const allowedEvidenceRefs = new Set(
      request.evidence.map((item) => item.ref),
    );
    const allowedEntityIds = new Set<string>([request.protagonistId]);
    for (const item of request.evidence) {
      for (const entityId of item.entityIds) allowedEntityIds.add(entityId);
    }

    const result = await this.model.structured(
      run,
      step,
      "story-expectation-design",
      {
        instructions: [
          "你正在做第二层的设计阶段。这个阶段发生在第一层 Reality Runtime 运行之前。",
          "先确定这一阶段要经营哪一笔 Reader 期待交易，再让第一层人物与世界真实运行去验证和实现它。",
          "设计的是目标、稀缺性建设方向、要形成/加深的固有认知、主角已有优势、未来值得收割的反应与现实权益。",
          "不得预写第一层结果，不得决定某个角色一定会如何行动，不得为了剧情强迫人物违背其 Observation / Goal / 利益。",
          "existingEvidenceRefs、protagonistAdvantageRefs、worldFocusRefs 只能引用 evidence 中真实存在的 ref。",
          "holderEntityIds、reactionTargetEntityIds、activationEntityIds 只能引用 evidence 中出现的人物，或 protagonistId。",
          "稀缺性不是分数；如果当前证据不足，用 evidenceToEstablish 说明接下来应该通过什么世界事实/失败案例/门槛/社会价格来建立。",
          "固有认知不是一句台词；如果当前尚未成立，用 stakeToCultivate 说明未来应让哪些人物基于该认知做出什么真实选择或投入。",
          "activationEntityIds 只是告诉第一层哪些人物值得优先观察/激活，不代表他们必须按某个剧情行动。",
          "targetOutcome 是期待兑现方向，不是已经发生的事实。",
          "retainedGainTarget 应尽量对应男主最终留下的真实资产、身份、权限、关系、能力或入口；若本阶段不适用可为 null。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                readerNeed: request.readerNeed,
                targetEmotion: request.targetEmotion,
                protagonistId: request.protagonistId,
                evidence: request.evidence,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      EXPECTATION_DESIGN_CONTRACT,
      zodValidator(ExpectationDesignOutputSchema, (value) =>
        expectationDesignOutputIssues(
          value,
          allowedEvidenceRefs,
          allowedEntityIds,
        ),
      ),
      signal,
    );

    const value = finalizeExpectationDesign(
      {
        version: "expectation-design.v1",
        authority: "speculative",
        projectId: request.projectId,
        protagonistId: request.protagonistId,
        readerNeed: request.readerNeed,
        targetEmotion: request.targetEmotion,
        targetOutcome: result.value.targetOutcome,
        scarcityIntents: result.value.scarcityIntents,
        beliefIntents: result.value.beliefIntents,
        protagonistAdvantageRefs: result.value.protagonistAdvantageRefs,
        reactionTargetEntityIds: result.value.reactionTargetEntityIds,
        retainedGainTarget: result.value.retainedGainTarget,
        activationEntityIds: result.value.activationEntityIds,
        worldFocusRefs: result.value.worldFocusRefs,
        designReasons: result.value.designReasons,
        realityFingerprint: request.realityFingerprint,
        storyStateFingerprint: request.storyStateFingerprint,
        mustPreserveAgentAutonomy: true,
        mustNotPredetermineOutcome: true,
      },
      allowedEvidenceRefs,
      allowedEntityIds,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }

  async allocateSceneReaderTime(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryReaderTimeModelRequest,
    signal: AbortSignal,
  ): Promise<ExpectationRuntimeModelResult<StoryReaderTimePlan>> {
    if (
      run.projectId !== request.state.projectId ||
      request.sceneExpansion.projectId !== request.state.projectId ||
      request.sceneExpansion.realityFingerprint !==
        request.state.realityFingerprint ||
      request.sceneExpansion.scenes.length === 0
    ) {
      throw new Error("story_runtime.reader_time.invalid_request");
    }

    const result = await this.model.structured(
      run,
      step,
      "story-scene-reader-time-plan",
      {
        instructions: [
          "你在 S07 Reader Time 层工作。输入已经经过 S04 编剧、S05 Reality Rehearsal、S06 Multi-Scene Expansion。禁止重新发明故事、人物行动或场景。",
          "讲师原稿的节奏规则是：制造信息差；分层释放信息差；在旧期待完全满足前提前铺垫新的信息差；一个高潮兑现后，把注意力转移到预先存在或刚种下的新期待。",
          "每个 S06 Scene 必须且只能有一个 decision。readerOrder 是 Reader 实际阅读顺序；可以控制展示顺序，但不能篡改 Scene 已经写明的现实因果、人物行动和 endState。",
          "informationReleased 写 Reader 在这一拍真正获得什么；informationWithheld 写这一拍仍故意不让 Reader 完全知道什么。不要一次把所有信息差结清。",
          "seed：种下新期待；charge：继续加深稀缺、固有认知、压力或认知差；payoff：兑现已成熟期待；background/skip：减少 Reader Time，但不能假装 Scene 没有在 Reality 中发生。",
          "若 action=payoff，必须同时完成期待连续性桥接：focusShiftThreadIds 指向已经存在的下一期待，或 nextExpectationSeed 明确种下新期待。只有确实是阶段/全书收束时，才允许用 terminalExpectationReason 解释为什么可以暂时没有下一笔期待。",
          "focusShiftThreadIds、payoffThreadIds、expectationThreadIds 只能引用 expectationState 中真实存在的 thread。",
          "reactionTargetEntityIds 只能使用 expectation thread 已有反应目标，不能高潮后临时拉一群人震惊。",
          "chapterBoundary 只决定 Reader Time 的切分，不改变 Reality Time。continue=不停章；soft_cut=可切场/节；chapter_end=章末。",
          "Reader knows != Character knows。S07只能控制 Reader 获得什么，不能修改人物自己的 knowledge state。",
          "Reader knows != Reader feels。重要情绪如果仍只是摘要，用 embodimentTargets 指出这一场应让 Reader 具体感受到什么。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                expectationState: request.state,
                sceneExpansion: request.sceneExpansion,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      STORY_READER_TIME_CONTRACT,
      zodValidator(StoryReaderTimeOutputSchema, (value) =>
        readerTimeOutputIssues(value, request.sceneExpansion),
      ),
      signal,
    );

    const value = finalizeStoryReaderTimePlan(
      {
        version: "story-reader-time-plan.v1",
        authority: "speculative",
        projectId: request.state.projectId,
        expectationStateDigest: request.state.digest,
        storySceneExpansionDigest: request.sceneExpansion.digest,
        realityFingerprint: request.sceneExpansion.realityFingerprint,
        sceneIds: request.sceneExpansion.scenes.map((scene) => scene.id),
        decisions: result.value.decisions,
      },
      request.state,
      request.sceneExpansion,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }

  /**
   * Deprecated guardrail: Reader Time may not bypass S06 Scene Expansion.
   */
  async allocateArbitrationReaderTime(
    _run: NarrativeRun,
    _step: NarrativeRunStep,
    _state: ExpectationState,
    _receipt: WorldArbitrationReceipt,
    _signal: AbortSignal,
  ): Promise<ExpectationRuntimeModelResult<NarrativeAllocationBatch>> {
    void _run;
    void _step;
    void _state;
    void _receipt;
    void _signal;
    throw new Error(
      "story_runtime.reader_time.direct_arbitration_bypass_forbidden",
    );
  }

  async allocateReaderTime(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: ExpectationAllocationModelRequest,
    signal: AbortSignal,
  ): Promise<ExpectationRuntimeModelResult<NarrativeAllocationBatch>> {
    if (
      run.projectId !== request.state.projectId ||
      request.candidates.length === 0 ||
      request.candidates.some(
        (candidate) =>
          candidate.projectId !== request.state.projectId ||
          candidate.realityFingerprint !== request.state.realityFingerprint,
      ) ||
      new Set(
        request.candidates.map(
          (candidate) =>
            `${candidate.storyUnitDesignDigest}:${candidate.storyUnitEventId}`,
        ),
      ).size !== 1
    ) {
      throw new Error("story_runtime.expectation.invalid_request");
    }

    const result = await this.model.structured(
      run,
      step,
      "story-expectation-narrative-plan",
      {
        instructions: [
          "你在 S07 Reader Time 层工作，不是世界裁判，也不是 S04 编剧室。",
          "输入 candidates 全部属于同一个已经由 S04 设计、S05 实际演出的 Event。不得把随机 Reality 事件提升成新故事，不得改写候选事实、人物意图或事件边界。",
          "你的任务只是决定这个已设计 Event 的真实 beats 要给 Reader 看多少、以什么节奏进入正文，以及当前期待在哪一拍 seed / charge / payoff。",
          "严格按当前 expectation state 判断：Reader 需求与目标情绪、稀缺性证据、世界/圈层/人物固有认知、主角真实优势、Reader 已知程度、人物已经在旧认知上做出的行动与下注。",
          "skip：与当前期待交易无关，不占正文。",
          "background：世界应继续发生，但只需提及或极短 beat。",
          "seed：种下新的需求/稀缺/认知/未来期待。",
          "charge：继续证明稀缺、固化认知、扩大认知差、加重压力、增强代入、让人物继续下注。",
          "payoff：只有已有 thread 已成熟时才允许。兑现必须考虑打破认知后的真实人物反应，以及可能留下的资产/身份/关系/权限。",
          "不要在成功以后临时安排一群人震惊。reactionTargetEntityIds 应来自已经有认知、利益或下注基础的真实人物。",
          "不要把稀缺性压成数字。要说明具体哪条稀缺证据、哪条固有认知、哪条认知差被这个候选强化或兑现。",
          "Reader knows 不等于 Reader feels。若重要情绪仍只是摘要信息，可用 embodimentTargets 指出应该通过具体生活、关系、制度或场景让 Reader 真正感受到什么。",
          "每个 candidateId 必须且只能输出一次 decision。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                expectationState: request.state,
                candidates: request.candidates,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      NARRATIVE_ALLOCATION_CONTRACT,
      zodValidator(NarrativeAllocationOutputSchema, (value) =>
        allocationOutputIssues(value, request.candidates),
      ),
      signal,
    );

    const drafts: NarrativeAllocationDecisionDraft[] =
      result.value.decisions.map((decision) => ({
        version: "narrative-allocation.v1",
        authority: "speculative",
        projectId: request.state.projectId,
        candidateId: decision.candidateId,
        action: decision.action,
        readerTime: decision.readerTime,
        expectationThreadIds: decision.expectationThreadIds,
        reasons: decision.reasons,
        deepenScarcityEvidenceIds: decision.deepenScarcityEvidenceIds,
        reinforceBeliefIds: decision.reinforceBeliefIds,
        widenGapBeliefIds: decision.widenGapBeliefIds,
        embodimentTargets: decision.embodimentTargets,
        payoffThreadIds: decision.payoffThreadIds,
        reactionTargetEntityIds: decision.reactionTargetEntityIds,
        retainedGainOpportunity: decision.retainedGainOpportunity,
        mustPreserveReality: true,
        mustNotRewriteIntent: true,
      }));

    const value = finalizeNarrativeAllocationBatch(
      request.state,
      request.candidates,
      drafts,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }
}

function readerTimeOutputIssues(
  value: StoryReaderTimeOutput,
  expansion: StorySceneExpansion,
): string[] {
  const issues: string[] = [];
  const allowed = new Set(expansion.scenes.map((scene) => scene.id));
  const seen = new Set<string>();
  const orders = new Set<number>();

  for (const decision of value.decisions) {
    if (!allowed.has(decision.sceneId)) {
      issues.push(`decisions: unknown sceneId ${decision.sceneId}`);
    }
    if (seen.has(decision.sceneId)) {
      issues.push(`decisions: duplicate sceneId ${decision.sceneId}`);
    }
    seen.add(decision.sceneId);
    if (orders.has(decision.readerOrder)) {
      issues.push(`decisions: duplicate readerOrder ${decision.readerOrder}`);
    }
    orders.add(decision.readerOrder);
  }

  for (const scene of expansion.scenes) {
    if (!seen.has(scene.id)) {
      issues.push(`decisions: missing sceneId ${scene.id}`);
    }
  }
  return issues;
}

function allocationOutputIssues(
  value: NarrativeAllocationOutput,
  candidates: readonly NarrativeCandidate[],
): string[] {
  const issues: string[] = [];
  const allowed = new Set(candidates.map((candidate) => candidate.id));
  const seen = new Set<string>();

  for (const decision of value.decisions) {
    if (!allowed.has(decision.candidateId)) {
      issues.push(`decisions: unknown candidateId ${decision.candidateId}`);
    }
    if (seen.has(decision.candidateId)) {
      issues.push(`decisions: duplicate candidateId ${decision.candidateId}`);
    }
    seen.add(decision.candidateId);
  }

  for (const candidate of candidates) {
    if (!seen.has(candidate.id)) {
      issues.push(`decisions: missing candidateId ${candidate.id}`);
    }
  }

  return issues;
}

function expectationDesignOutputIssues(
  value: ExpectationDesignOutput,
  allowedEvidenceRefs: ReadonlySet<string>,
  allowedEntityIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  const evidenceRefs = [
    ...value.protagonistAdvantageRefs,
    ...value.worldFocusRefs,
    ...value.scarcityIntents.flatMap((item) => item.existingEvidenceRefs),
    ...value.beliefIntents.flatMap((item) => item.existingEvidenceRefs),
  ];
  for (const ref of evidenceRefs) {
    if (!allowedEvidenceRefs.has(ref)) {
      issues.push(`design: unknown evidence ref ${ref}`);
    }
  }

  const entityIds = [
    ...value.reactionTargetEntityIds,
    ...value.activationEntityIds,
    ...value.beliefIntents.flatMap((item) => item.holderEntityIds),
  ];
  for (const entityId of entityIds) {
    if (!allowedEntityIds.has(entityId)) {
      issues.push(`design: unknown entityId ${entityId}`);
    }
  }

  return issues;
}
