import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { NarrativeModelClient } from "../src/model-client.js";
import {
  ExpectationNarrativeService,
  finalizeExpectationState,
} from "../src/index.js";
import type { NarrativeCandidate } from "@narralume/contracts";
import { describe, expect, it, vi } from "vitest";

const usage: RunBudgetUsage = {
  inputTokens: 120,
  outputTokens: 60,
  calls: 1,
  costUsd: 0,
  wallTimeMs: 10,
};

const run = { projectId: "p1" } as NarrativeRun;
const step = { id: "expectation-step" } as NarrativeRunStep;

function expectationState() {
  return finalizeExpectationState({
    version: "expectation-state.v1",
    authority: "speculative",
    projectId: "p1",
    targetEmotion: "被识货后的得意",
    readerNeed: "看低位秀信打破木叶对基础忍术的常识",
    scarcityEvidence: [
      {
        id: "scarcity:limit",
        kind: "historical_case",
        claim: "基础忍术通常没有高阶战斗价值",
        subjectRef: "basic-ninjutsu",
        sourceRefs: ["atlas:rule", "history:training"],
      },
    ],
    establishedBeliefs: [
      {
        id: "belief:limit",
        proposition: "普通下忍不可能靠基础忍术让高手重新估值",
        scope: "circle",
        holderEntityIds: ["medic", "sakumo"],
        supportingScarcityEvidenceIds: ["scarcity:limit"],
        supportingEvidenceRefs: ["atlas:rule"],
        actionStakeRefs: ["medic:ordinary-treatment"],
        status: "established",
        breakCondition: "可信高手看到异常结果",
      },
    ],
    protagonistAdvantages: [
      {
        id: "advantage:control",
        summary: "秀信能把基础忍术用出远超常规的结果",
        evidenceRefs: ["reality:test"],
        readerKnowledge: "known",
        knownByEntityIds: ["xiuxin"],
        contradictsBeliefIds: ["belief:limit"],
      },
    ],
    threads: [
      {
        id: "thread:recognition",
        readerNeed: "看高手从忽视到识货",
        targetEmotion: "得意",
        targetOutcome: "高价人物重新评估秀信",
        scarcityEvidenceIds: ["scarcity:limit"],
        establishedBeliefIds: ["belief:limit"],
        protagonistAdvantageIds: ["advantage:control"],
        readerKnowledgeSummary: "Reader 知道优势，相关人物还不知道",
        payoffCondition: "高价人物获得可信证据",
        reactionTargetEntityIds: ["medic", "sakumo"],
        retainedGainTarget: "新的训练与关系入口",
        phase: "charging",
      },
    ],
    realityFingerprint: "r1",
    storyStateFingerprint: "s1",
  });
}

function candidate(
  id: string,
  summary: string,
): NarrativeCandidate {
  return {
    id,
    projectId: "p1",
    generationId: "g1",
    source: "world_initiative",
    authority: "speculative",
    summary,
    involvedEntityIds: ["xiuxin", "medic"],
    evidenceRefs: ["runtime:event"],
    effects: [],
    originDigest: null,
  };
}

describe("ExpectationNarrativeService", () => {
  it("allocates Reader Time without replacing Reality candidates with invented plot", async () => {
    const state = expectationState();
    const handoff = candidate(
      "event:handoff",
      "见过异常的医疗忍者换班，并按普通恢复处理",
    );
    const shop = candidate("event:shop", "商店完成普通补货");

    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-expectation-narrative-plan");
          expect(JSON.stringify(request)).toContain("belief:limit");
          expect(JSON.stringify(request)).toContain("event:handoff");
          const checked = validate({
            decisions: [
              {
                candidateId: "event:handoff",
                action: "charge",
                readerTime: "scene",
                expectationThreadIds: ["thread:recognition"],
                reasons: [
                  "医疗忍者继续按旧常识行动，会让未来高价人物识货时的认知差更贵",
                ],
                deepenScarcityEvidenceIds: [],
                reinforceBeliefIds: ["belief:limit"],
                widenGapBeliefIds: ["belief:limit"],
                embodimentTargets: [
                  "通过医疗流程让 Reader 感受到木叶为何把秀信当普通伤员",
                ],
                payoffThreadIds: [],
                reactionTargetEntityIds: [],
                retainedGainOpportunity: null,
              },
              {
                candidateId: "event:shop",
                action: "background",
                readerTime: "mention",
                expectationThreadIds: [],
                reasons: ["真实发生，但当前没有承担期待交易"],
                deepenScarcityEvidenceIds: [],
                reinforceBeliefIds: [],
                widenGapBeliefIds: [],
                embodimentTargets: [],
                payoffThreadIds: [],
                reactionTargetEntityIds: [],
                retainedGainOpportunity: null,
              },
            ],
          });
          if (!checked.success) throw new Error(checked.issues.join("; "));
          return {
            value: checked.data,
            usage,
            mode: "native" as const,
            attempts: 1,
          };
        },
      ),
    };

    const result = await new ExpectationNarrativeService(
      model,
    ).allocateReaderTime(
      run,
      step,
      { state, candidates: [handoff, shop] },
      new AbortController().signal,
    );

    expect(result.value.selectedCandidateIds).toEqual(["event:handoff"]);
    expect(
      result.value.decisions.find(
        (decision) => decision.candidateId === "event:handoff",
      )?.readerTime,
    ).toBe("scene");
    expect(
      result.value.decisions.find(
        (decision) => decision.candidateId === "event:shop",
      )?.action,
    ).toBe("background");
    expect(result.value.authority).toBe("speculative");
  });

  it("requires a decision for every Reality candidate", async () => {
    const state = expectationState();
    const handoff = candidate("event:handoff", "医院换班");
    const shop = candidate("event:shop", "商店进货");

    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, _purpose, _request, _contract, validate) => {
          const checked = validate({
            decisions: [
              {
                candidateId: "event:handoff",
                action: "charge",
                readerTime: "scene",
                expectationThreadIds: ["thread:recognition"],
                reasons: ["继续固化旧认知"],
                deepenScarcityEvidenceIds: [],
                reinforceBeliefIds: ["belief:limit"],
                widenGapBeliefIds: [],
                embodimentTargets: [],
                payoffThreadIds: [],
                reactionTargetEntityIds: [],
                retainedGainOpportunity: null,
              },
            ],
          });
          if (!checked.success) throw new Error(checked.issues.join("; "));
          throw new Error("unexpected validation success");
        },
      ),
    };

    await expect(
      new ExpectationNarrativeService(model).allocateReaderTime(
        run,
        step,
        { state, candidates: [handoff, shop] },
        new AbortController().signal,
      ),
    ).rejects.toThrow("decisions: missing candidateId event:shop");
  });
});
