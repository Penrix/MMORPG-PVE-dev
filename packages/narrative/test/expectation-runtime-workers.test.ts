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
  StorySceneExpansion,
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

function sceneExpansion(): StorySceneExpansion {
  return {
    version: "story-scene-expansion.v1",
    authority: "speculative",
    projectId: "p1",
    storyUnitDesignDigest: "story-unit:expectation",
    storyUnitEventId: "event:recognition",
    arbitrationDigest: "arbiter:scene",
    realityFingerprint: "r1",
    eventProblem: "医疗忍者如何处理秀信的异常表现",
    scenes: [
      {
        id: "scene:ordinary",
        order: 1,
        phase: "before",
        title: "普通流程",
        participantEntityIds: ["xiuxin", "medic"],
        locationObjectId: null,
        localProblem: "旧流程仍把秀信当普通伤员",
        pressure: "Reader知道优势但人物仍按旧认知行动",
        observableStart: "医疗忍者按常规复核",
        interaction: "秀信训练，医疗忍者观察",
        informationMove: "医疗忍者尚未确认异常",
        expectationMove: "继续加深认知差",
        projectedRealityUse: "使用S05已确认的训练行为",
        endState: "异常开始进入观察",
        nextSceneCause: "训练结果开始偏离普通标准",
      },
      {
        id: "scene:confirm",
        order: 2,
        phase: "during",
        title: "专业确认",
        participantEntityIds: ["xiuxin", "medic"],
        locationObjectId: null,
        localProblem: "专业常识与直接观察冲突",
        pressure: "必须重新判断秀信",
        observableStart: "异常结果出现",
        interaction: "医疗忍者复核",
        informationMove: "医疗忍者开始确认异常",
        expectationMove: "第一层期待进入兑现边缘",
        projectedRealityUse: "严格使用S05仲裁结果",
        endState: "异常被专业确认",
        nextSceneCause: null,
      },
    ],
    digest: "scene-expansion:reader-time",
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

  it("allocates S07 only after S06 scenes and applies lecturer continuity rules", async () => {
    const state = expectationState();
    const expansion = sceneExpansion();
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-scene-reader-time-plan");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("分层释放信息差");
          expect(serialized).toContain("旧期待完全满足前");
          expect(serialized).toContain("scene:ordinary");
          const checked = validate({
            decisions: [
              {
                sceneId: "scene:ordinary",
                readerOrder: 1,
                action: "charge",
                readerTime: "scene",
                expectationThreadIds: ["thread:recognition"],
                reasons: ["先让旧常识继续在现实流程里生效"],
                deepenScarcityEvidenceIds: [],
                reinforceBeliefIds: ["belief:limit"],
                widenGapBeliefIds: ["belief:limit"],
                embodimentTargets: ["让Reader具体感到普通流程为何合理"],
                payoffThreadIds: [],
                reactionTargetEntityIds: [],
                retainedGainOpportunity: null,
                informationReleased: "Reader看到医疗忍者仍按普通流程判断",
                informationWithheld: "专业确认尚未完成",
                focusShiftThreadIds: [],
                nextExpectationSeed: null,
                terminalExpectationReason: null,
                chapterBoundary: "continue",
              },
              {
                sceneId: "scene:confirm",
                readerOrder: 2,
                action: "seed",
                readerTime: "scene",
                expectationThreadIds: ["thread:recognition"],
                reasons: ["在第一层认知即将被打破时提前种下更高层识货期待"],
                deepenScarcityEvidenceIds: [],
                reinforceBeliefIds: [],
                widenGapBeliefIds: [],
                embodimentTargets: ["让Reader看到确认异常后的现实变化"],
                payoffThreadIds: [],
                reactionTargetEntityIds: [],
                retainedGainOpportunity: null,
                informationReleased: "医疗忍者开始确认异常",
                informationWithheld: "更高层人物尚未知情",
                focusShiftThreadIds: [],
                nextExpectationSeed: "更高层人物何时看到这份异常记录",
                terminalExpectationReason: null,
                chapterBoundary: "chapter_end",
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
    ).allocateSceneReaderTime(
      run,
      step,
      { state, sceneExpansion: expansion },
      new AbortController().signal,
    );

    expect(result.value.sceneIds).toEqual(["scene:ordinary", "scene:confirm"]);
    expect(result.value.decisions[1]?.nextExpectationSeed).toContain("更高层");
  });

  it("forbids the old S05 arbitration directly into S07 bypass", async () => {
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
      resolutions: [],
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
      structured: vi.fn(),
    };

    await expect(
      new ExpectationNarrativeService(model).allocateArbitrationReaderTime(
        run,
        step,
        state,
        receipt,
        new AbortController().signal,
      ),
    ).rejects.toThrow(
      "story_runtime.reader_time.direct_arbitration_bypass_forbidden",
    );
    expect(model.structured).not.toHaveBeenCalled();
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
