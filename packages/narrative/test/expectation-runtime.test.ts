import type {
  ExpectationState,
  NarrativeAllocationDecisionDraft,
  NarrativeCandidate,
} from "@narralume/contracts";
import { describe, expect, it } from "vitest";

import {
  finalizeExpectationState,
  finalizeNarrativeAllocationBatch,
  finalizeNarrativeAllocationDecision,
} from "../src/expectation-runtime.js";

function state(phase: ExpectationState["threads"][number]["phase"] = "ripe") {
  return finalizeExpectationState({
    version: "expectation-state.v1",
    authority: "speculative",
    projectId: "p1",
    targetEmotion: "让 Reader 期待秀信打破木叶对基础忍术上限的常识",
    readerNeed: "看到一个低位人物凭真实优势被高价人物重新估值",
    scarcityEvidence: [
      {
        id: "scarcity:basic-ninjutsu-limit",
        kind: "authority_judgment",
        claim: "木叶专业忍者普遍认为基础忍术的上限有限",
        subjectRef: "basic-ninjutsu",
        sourceRefs: ["world-rule:basic-ninjutsu", "expert-history:academy"],
      },
    ],
    establishedBeliefs: [
      {
        id: "belief:basic-is-basic",
        proposition: "一个病床上的普通下忍不可能靠基础忍术表现出上忍级价值",
        scope: "circle",
        holderEntityIds: ["medic", "observer"],
        supportingScarcityEvidenceIds: ["scarcity:basic-ninjutsu-limit"],
        supportingEvidenceRefs: ["world-rule:basic-ninjutsu"],
        actionStakeRefs: ["medic:did-not-escalate", "observer:ignored-report"],
        status: "hardened",
        breakCondition: "秀信在可信见证者面前展示异常结果",
      },
    ],
    protagonistAdvantages: [
      {
        id: "advantage:xiuxin-control",
        summary: "秀信对基础忍术的控制远超当前圈层认知",
        evidenceRefs: ["reality:xiuxin-test"],
        readerKnowledge: "known",
        knownByEntityIds: ["xiuxin"],
        contradictsBeliefIds: ["belief:basic-is-basic"],
      },
    ],
    threads: [
      {
        id: "thread:basic-ninjutsu",
        readerNeed: "看到木叶高手重新认识秀信的价值",
        targetEmotion: "得意与被识货",
        targetOutcome: "一名高价忍者亲自确认异常并改变对秀信的态度",
        scarcityEvidenceIds: ["scarcity:basic-ninjutsu-limit"],
        establishedBeliefIds: ["belief:basic-is-basic"],
        protagonistAdvantageIds: ["advantage:xiuxin-control"],
        readerKnowledgeSummary: "Reader 已知道秀信能做到，相关人物仍按旧常识行动",
        payoffCondition: "可信高价人物亲眼见证或收到不可否认的结果",
        reactionTargetEntityIds: ["medic", "observer"],
        retainedGainTarget: "获得更高层人物注意与新的训练/权限入口",
        phase,
      },
    ],
    realityFingerprint: "reality-1",
    storyStateFingerprint: "story-1",
  });
}

function candidate(
  id: string,
  summary: string,
  source: NarrativeCandidate["source"] = "world_initiative",
): NarrativeCandidate {
  return {
    id,
    projectId: "p1",
    generationId: "g1",
    source,
    authority: "speculative",
    summary,
    involvedEntityIds: ["xiuxin", "medic"],
    evidenceRefs: ["runtime:event"],
    effects: [],
    originDigest: null,
  };
}

function decision(
  candidateId: string,
  overrides: Partial<NarrativeAllocationDecisionDraft> = {},
): NarrativeAllocationDecisionDraft {
  return {
    version: "narrative-allocation.v1",
    authority: "speculative",
    projectId: "p1",
    candidateId,
    action: "charge",
    readerTime: "scene",
    expectationThreadIds: ["thread:basic-ninjutsu"],
    reasons: ["这个候选让相关人物继续依据旧常识行动并增加未来反应价格"],
    deepenScarcityEvidenceIds: [],
    reinforceBeliefIds: ["belief:basic-is-basic"],
    widenGapBeliefIds: ["belief:basic-is-basic"],
    embodimentTargets: ["让 Reader 看到普通医疗忍者为何真心认为这只是普通恢复"],
    payoffThreadIds: [],
    reactionTargetEntityIds: [],
    retainedGainOpportunity: null,
    mustPreserveReality: true,
    mustNotRewriteIntent: true,
    ...overrides,
  };
}

describe("Expectation / Narrative Runtime", () => {
  it("keeps scarcity, established cognition and Reader-visible advantage as relations rather than scores", () => {
    const current = state();
    expect(current.scarcityEvidence[0]?.claim).toContain("基础忍术");
    expect(current.establishedBeliefs[0]?.supportingScarcityEvidenceIds).toEqual([
      "scarcity:basic-ninjutsu-limit",
    ]);
    expect(current.protagonistAdvantages[0]?.readerKnowledge).toBe("known");
    expect(current.threads[0]?.phase).toBe("ripe");
    expect(current.digest).toBeTruthy();
    expect(JSON.stringify(current)).not.toContain("scarcityScore");
    expect(JSON.stringify(current)).not.toContain("excitementScore");
  });

  it("rejects a charge allocation that does not actually add scarcity, belief, gap or embodiment value", () => {
    const current = state();
    const event = candidate("event:handoff", "医院换班");
    expect(() =>
      finalizeNarrativeAllocationDecision(
        decision(event.id, {
          deepenScarcityEvidenceIds: [],
          reinforceBeliefIds: [],
          widenGapBeliefIds: [],
          embodimentTargets: [],
        }),
        current,
        event,
      ),
    ).toThrow("story_runtime.expectation.charge_without_operation");
  });

  it("allows payoff only when an existing expectation thread is ripe", () => {
    const event = candidate("event:witness", "朔茂亲眼看见秀信的异常结果");
    const payoff = decision(event.id, {
      action: "payoff",
      readerTime: "scene",
      deepenScarcityEvidenceIds: [],
      reinforceBeliefIds: [],
      widenGapBeliefIds: [],
      embodimentTargets: [],
      payoffThreadIds: ["thread:basic-ninjutsu"],
      reactionTargetEntityIds: ["observer"],
      retainedGainOpportunity: "朔茂开始把秀信当作值得投入的特殊人才",
    });

    expect(
      finalizeNarrativeAllocationDecision(payoff, state("ripe"), event).action,
    ).toBe("payoff");
    expect(() =>
      finalizeNarrativeAllocationDecision(payoff, state("charging"), event),
    ).toThrow(
      "story_runtime.expectation.payoff_thread_not_ripe:thread:basic-ninjutsu",
    );
  });

  it("can background a real world event while selecting a quieter event that charges expectation", () => {
    const current = state();
    const shift = candidate(
      "event:handoff",
      "唯一见过异常恢复的医生换班，并决定暂时不升级报告",
    );
    const shop = candidate("event:shop", "木叶商店正常进货");

    const batch = finalizeNarrativeAllocationBatch(current, [shift, shop], [
      decision(shift.id),
      decision(shop.id, {
        action: "background",
        readerTime: "mention",
        expectationThreadIds: [],
        reasons: ["真实发生，但与当前期待交易没有直接关系"],
        deepenScarcityEvidenceIds: [],
        reinforceBeliefIds: [],
        widenGapBeliefIds: [],
        embodimentTargets: [],
      }),
    ]);

    expect(batch.selectedCandidateIds).toEqual(["event:handoff"]);
    expect(
      batch.decisions.find((item) => item.candidateId === "event:shop")?.action,
    ).toBe("background");
  });
});
