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
import type {
  NarrativeCandidate,
  WorldArbitrationReceipt,
} from "@narralume/contracts";
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

function candidate(id: string, summary: string): NarrativeCandidate {
  return {
    id,
    projectId: "p1",
    generationId: "g1",
    storyUnitDesignDigest: "story-unit:expectation",
    storyUnitEventId: "event:recognition",
    realityFingerprint: "r1",
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
  it("designs an expectation transaction before Layer 1 without scripting character decisions", async () => {
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-expectation-design");
          expect(JSON.stringify(request)).toContain("得意与被识货");
          expect(JSON.stringify(request)).toContain("atlas:basic-limit");
          const checked = validate({
            targetOutcome: "让木叶高价人物重新估值秀信",
            scarcityIntents: [
              {
                claim: "基础忍术通常没有高阶价值",
                subjectRef: "basic-ninjutsu",
                existingEvidenceRefs: ["atlas:basic-limit"],
                evidenceToEstablish: [
                  "让专业忍者基于训练经验说明基础忍术的正常上限",
                ],
              },
            ],
            beliefIntents: [
              {
                proposition: "病床上的普通下忍不可能靠基础忍术体现高阶价值",
                scope: "circle",
                holderEntityIds: ["medic", "sakumo"],
                existingEvidenceRefs: ["atlas:basic-limit"],
                stakeToCultivate: ["医疗体系继续按普通伤员流程处理"],
                breakCondition: "可信高手获得不可否认的异常证据",
              },
            ],
            protagonistAdvantageRefs: ["reality:xiuxin-control"],
            reactionTargetEntityIds: ["medic", "sakumo"],
            retainedGainTarget: "获得更高层训练与关系入口",
            activationEntityIds: ["medic", "sakumo"],
            worldFocusRefs: ["atlas:basic-limit"],
            designReasons: [
              "先让基础忍术上限成为稳定认知，再让第一层真实行动决定兑现路径",
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
    ).designExpectation(
      run,
      step,
      {
        projectId: "p1",
        protagonistId: "xiuxin",
        readerNeed: "看低位秀信凭真实能力被高价人物识货",
        targetEmotion: "得意与被识货",
        realityFingerprint: "r1",
        storyStateFingerprint: "s1",
        evidence: [
          {
            ref: "atlas:basic-limit",
            kind: "rule",
            summary: "基础忍术在木叶通常被视为低阶、上限有限",
            entityIds: ["medic", "sakumo"],
          },
          {
            ref: "reality:xiuxin-control",
            kind: "reality",
            summary: "秀信实际拥有远超普通下忍的基础忍术控制",
            entityIds: ["xiuxin"],
          },
        ],
      },
      new AbortController().signal,
    );

    expect(result.value.activationEntityIds).toEqual(["medic", "sakumo"]);
    expect(result.value.mustPreserveAgentAutonomy).toBe(true);
    expect(result.value.mustNotPredetermineOutcome).toBe(true);
    expect(result.value.targetOutcome).toContain("重新估值");
  });

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

  it("accepts a finalized WorldArbitrationReceipt directly from layer 1", async () => {
    const state = expectationState();
    const receipt: WorldArbitrationReceipt = {
      version: "world-arbitration-receipt.v1",
      authority: "speculative",
      projectId: "p1",
      generationId: "g1",
      round: 1,
      storyUnitDesignDigest: "story-unit:expectation",
      storyUnitEventId: "event:recognition",
      realityFingerprint: "r1",
      worldContextDigest: "world-context:r1",
      proposalDigests: ["proposal:xiuxin"],
      resolutions: [
        {
          agentId: "character:xiuxin",
          characterId: "xiuxin",
          characterName: "秀信",
          proposalDigest: "proposal:xiuxin",
          decision: "测试基础忍术",
          intendedAction: "测试基础忍术控制",
          actionOrder: 1,
          outcome: "success",
          immediateResult: "医疗忍者注意到异常控制",
          stateAfter: "秀信仍在病房，异常第一次被见证",
          butterflyEffects: [
            {
              effect: "医疗记录可能上报",
              transmissionPath: "换班记录",
              arrivalHorizon: 1,
              protagonistImpact: "更高层人物可能注意到秀信",
            },
          ],
          conflictIds: [],
        },
      ],
      conflicts: [],
      hardContractStatus: "feasible",
      hardContractConflicts: [],
      protagonistProjection: null,
      finalized: true,
      generatedAt: null,
      digest: "arbiter:direct",
    };

    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, _purpose, request, _contract, validate) => {
          const serialized = JSON.stringify(request);
          expect(serialized).toContain(
            "candidate:arbiter:direct:character:xiuxin",
          );
          expect(serialized).toContain("医疗忍者注意到异常控制");
          const checked = validate({
            decisions: [
              {
                candidateId: "candidate:arbiter:direct:character:xiuxin",
                action: "charge",
                readerTime: "scene",
                expectationThreadIds: ["thread:recognition"],
                reasons: ["真实行动继续给基础忍术的固有认知加价"],
                deepenScarcityEvidenceIds: [],
                reinforceBeliefIds: ["belief:limit"],
                widenGapBeliefIds: ["belief:limit"],
                embodimentTargets: [
                  "让 Reader 看见医疗体系为何先按普通情况处理",
                ],
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
    ).allocateArbitrationReaderTime(
      run,
      step,
      state,
      receipt,
      new AbortController().signal,
    );

    expect(result.value.selectedCandidateIds).toEqual([
      "candidate:arbiter:direct:character:xiuxin",
    ]);
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
