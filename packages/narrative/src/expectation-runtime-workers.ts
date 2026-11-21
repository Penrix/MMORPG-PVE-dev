import { z } from "zod";

import {
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
  finalizeNarrativeAllocationBatch,
  narrativeCandidatesFromArbitration,
} from "./expectation-runtime.js";

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
