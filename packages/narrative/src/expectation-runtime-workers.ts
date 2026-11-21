import { z } from "zod";

import {
  type ExpectationDesign,
  type ExpectationDesignEvidence,
  type ExpectationState,
  type NarrativeAllocationBatch,
  type NarrativeAllocationDecisionDraft,
  type NarrativeCandidate,
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
  narrativeCandidatesFromArbitration,
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

export interface ExpectationRuntimeModelResult<T> {
  value: T;
  usage: RunBudgetUsage;
  generation: {
    mode: "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

/**
 * Layer-2 story selection.
 *
 * The model does not invent a replacement plot. It receives existing Reality
 * candidates plus active expectation threads and allocates Reader Time according
 * to scarcity, established cognition, Reader-visible advantage gap, embodiment,
 * stake, payoff and reaction value.
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

  async allocateArbitrationReaderTime(
    run: NarrativeRun,
    step: NarrativeRunStep,
    state: ExpectationState,
    receipt: WorldArbitrationReceipt,
    signal: AbortSignal,
  ): Promise<ExpectationRuntimeModelResult<NarrativeAllocationBatch>> {
    if (
      receipt.projectId !== state.projectId ||
      receipt.projectId !== run.projectId
    ) {
      throw new Error("story_runtime.expectation.arbitration_project_mismatch");
    }
    const candidates = narrativeCandidatesFromArbitration(receipt);
    return this.allocateReaderTime(run, step, { state, candidates }, signal);
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
        (candidate) => candidate.projectId !== request.state.projectId,
      )
    ) {
      throw new Error("story_runtime.expectation.invalid_request");
    }

    const result = await this.model.structured(
      run,
      step,
      "story-expectation-narrative-plan",
      {
        instructions: [
          "你是第二层 Expectation / Narrative Runtime，不是第一层世界裁判，也不是自由编剧情的编剧。",
          "输入 candidates 已经来自 Reality Runtime。不得改写候选事实、不得替人物改主意、不得虚构候选之外已经发生的事件。",
          "你的任务不是找“最大事件”或给精彩度打分，而是决定 Reader Time 应投在哪里。",
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
