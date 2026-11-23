// prettier-ignore
import { createCanonEntity, createOutlineNode, createProject, type NarrativeRun, type NarrativeRunStep, type RunBudgetUsage } from "@narralume/domain";
// prettier-ignore
import type { ExpectationDesign, ExpectationState, StoryUnitDesign, StoryObjectField, StorySceneExpansion, StoryReaderTimePlan, WorldArbitrationReceipt, CharacterActionProposal, CharacterObservationPacket } from "@narralume/contracts";
// prettier-ignore
import { SqliteCanonRepository, SqliteProjectRepository, SqliteStoryRepository } from "@narralume/persistence";
// prettier-ignore
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
// prettier-ignore
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// prettier-ignore
import type { NarrativeModelClient } from "../src/model-client.js";
// prettier-ignore
import { StoryDirectorPipeline } from "../src/story-director-pipeline.js";
// prettier-ignore
import { StoryAuthoringService } from "../src/story-authoring-runtime-workers.js";
// prettier-ignore
import { ExpectationNarrativeService } from "../src/expectation-runtime-workers.js";
// prettier-ignore
import { StoryRuntimeAgentService } from "../src/story-runtime-workers.js";
// prettier-ignore
import { StorySceneExpansionService } from "../src/story-scene-runtime-workers.js";
// prettier-ignore
import { buildStoryCreativeFrameContext } from "../src/story-creative-context.js";
// prettier-ignore
import { parseStoryChapterProductionHandoff } from "../src/story-production-handoff.js";

// prettier-ignore
const now = "2026-11-23T12:00:00.000Z";
// prettier-ignore
const usage: RunBudgetUsage = { inputTokens: 10, outputTokens: 5, calls: 1, costUsd: 0, wallTimeMs: 2 };
// prettier-ignore
const run = { projectId: "p1" } as NarrativeRun;
// prettier-ignore
const step = { id: "test-step" } as NarrativeRunStep;
// prettier-ignore
const signal = new AbortController().signal;
// prettier-ignore
const mockModel: NarrativeModelClient = {
  text: vi.fn(),
  structured: vi.fn(),
};
// prettier-ignore
const ledger = {
  protagonistEntityId: "hero",
  road: "高价忍者任务",
  currentStepId: "step:1",
  currentPosition: "普通伤员",
  stageGoal: "专业估值",
  settlementTarget: "高价任务资格",
  steps: [{ id: "step:1", title: "专业复核", targetGain: "上级任务", gate: "专业认可", targetCircle: "忍者任务体系" }],
};
// prettier-ignore
const camera = {
  version: "story-protagonist-camera.v1" as const,
  projectId: "p1",
  protagonistEntityId: "hero",
  currentLocation: "木叶医院",
  currentState: "重伤忍者",
  currentGoal: "获得重新估值",
  upgradeNeed: "获得上层任务权限",
  activeMove: "以基础忍术展示超常技巧",
  focusObjectIds: ["object:hero", "object:medic"],
  advantageRefs: ["world-reality:hero"],
  assetRefs: [],
};

let db: NodeNarrativeDatabase;
let story: SqliteStoryRepository;

// prettier-ignore
beforeEach(() => {
  db = new NodeNarrativeDatabase();
  db.migrate();
  new SqliteProjectRepository(db).insert(createProject({ id: "p1", title: "测试书", now }));
  story = new SqliteStoryRepository(db);
  const book = story.insertOutlineNode(createOutlineNode({
    id: "book", projectId: "p1", parent: null, kind: "book", ordinal: 0, title: "测试书", now,
  }));
  for (let ordinal = 0; ordinal < 2; ordinal++) {
    story.insertOutlineNode(createOutlineNode({
      id: `chapter-${ordinal + 1}`, projectId: "p1", parent: book,
      kind: "chapter", ordinal, title: ordinal === 0 ? "重新估值" : "下一章",
      povEntityId: "hero", now,
    }));
  }
  const canon = new SqliteCanonRepository(db);
  for (const [id, name] of [["hero", "秀信"], ["medic", "医疗忍者"]]) {
    canon.insertEntity(createCanonEntity({
      id, projectId: "p1", name, type: "character",
      description: id === "medic" ? "坚信秀信只是普通伤员，负责复核" : "木叶伤员", now,
    }));
  }
});

// prettier-ignore
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});

// prettier-ignore
function frameRequest() {
  return {
    projectId: "p1",
    frameOutlineNodeId: "chapter-1",
    entityIds: ["hero", "medic"],
    protagonistCamera: camera,
    upgradeLedger: ledger,
    request: "设计秀信打破普通伤员估值的故事",
    readerNeed: "得意",
    targetEmotion: "得意",
  };
}

// prettier-ignore
function expectationFor(field: { realityFingerprint: string; storyStateFingerprint: string }): ExpectationDesign {
  return {
    version: "expectation-design.v1", authority: "speculative",
    projectId: "p1", protagonistId: "hero",
    readerNeed: "得意", targetEmotion: "得意", targetOutcome: "专业重新估值",
    scarcityIntents: [], beliefIntents: [], protagonistAdvantageRefs: [],
    reactionTargetEntityIds: ["medic"], retainedGainTarget: "上层任务入口",
    activationEntityIds: ["hero", "medic"], worldFocusRefs: [], designReasons: ["先有固有认知"],
    realityFingerprint: field.realityFingerprint,
    storyStateFingerprint: field.storyStateFingerprint,
    directorMayDesignReactionPayoff: true,
    mustGroundPerformanceInCharacterization: true,
    digest: "expectation:1",
  };
}

// prettier-ignore
function unitFor(field: { digest: string }, status: "READY" | "BLOCKED_WORLD_GAP" = "READY"): StoryUnitDesign {
  return {
    version: "story-unit-design.v1", authority: "speculative", status,
    projectId: "p1", objectFieldDigest: field.digest,
    creativeContextDigest: "creative:1", sourceSeedIds: [],
    expectationDesignDigest: "expectation:1",
    objectAnchorIds: ["object:hero", "object:medic"], groundingSurfaceRefs: [],
    storyProblem: "医疗忍者如何重新估值秀信",
    worldGaps: status === "READY" ? [] : [{ id: "gap:1", description: "尚缺专业证据" }],
    upgradeLedger: ledger, campNetwork: [
      { entityId: "hero", camp: "主角", currentGoal: "升级", storyRole: "主动测试", currentBelief: "自己能做到", currentInterest: "拿高价任务" },
      { entityId: "medic", camp: "专业观察者", currentGoal: "按流程工作", storyRole: "旧认知下注", currentBelief: "秀信只是普通伤员", currentInterest: "维持专业判断" },
    ],
    stakeLedger: [{
      id: "stake:medic", entityId: "medic",
      currentBelief: "秀信普通", currentInterest: "专业地位",
      stakeAction: "继续按普通伤员等级处理",
      stakeAssets: ["专业评级"], commitmentCost: "承认误判",
      escalationPlan: "进一步下注", payoffReaction: "震惊并改判",
      settlementChange: "专业评估升级", state: "committed",
    }],
    reactionTargets: [], campTransitions: [], appearanceOrderEntityIds: ["hero", "medic"],
    informationRelease: [],
    events: [{
      id: "event:1", title: "复核", purpose: "估值翻转", problem: "是否改变判断",
      storyPressure: "旧评价过低",
      castPoolEntityIds: ["hero", "medic"],
      activeSeedEntityIds: ["medic"],
      actorPressures: [{ entityId: "hero", pressure: "必须训练" }, { entityId: "medic", pressure: "必须判断" }],
      stakeEntryIds: ["stake:medic"], reactionTargetEntityIds: ["medic"],
      informationReleaseSteps: [], phaseTargets: [],
      realityQuestion: "怎样复核", observableStart: "训练开始",
      expectedChange: "形成新判断", readerExpectation: "等待改判",
    }],
    directorAuthority: "author-defined-story-line",
    characterExecutionRule: "characterization-constrained-performance",
    digest: "story-unit:1",
  } as StoryUnitDesign;
}

// prettier-ignore
const expectationState = {
  projectId: "p1", realityFingerprint: "",
  threads: [],
} as unknown as ExpectationState;

// prettier-ignore
function sceneExpansion(realityFingerprint: string): StorySceneExpansion {
  return {
    version: "story-scene-expansion.v1", authority: "speculative",
    projectId: "p1", storyUnitDesignDigest: "story-unit:1",
    storyUnitEventId: "event:1", arbitrationDigest: "arbitration:1", realityFingerprint,
    eventProblem: "怎样重新估值",
    scenes: [{
      id: "scene:1", order: 1, phase: "during", title: "复核",
      participantEntityIds: ["hero", "medic"], locationObjectId: null,
      localProblem: "秀信价值重新估算", pressure: "医疗忍者旧判断",
      observableStart: "训练开始", interaction: "医疗忍者观察",
      informationMove: "证据逐步释放", expectationMove: "加深认知差",
      projectedRealityUse: "训练符合现实", endState: "正式重新估值", nextSceneCause: null,
    }],
    digest: "scene:expansion",
  };
}

// prettier-ignore
function readerTime(realityFingerprint: string): StoryReaderTimePlan {
  return {
    version: "story-reader-time-plan.v1", authority: "speculative",
    projectId: "p1", expectationStateDigest: "expectation:state",
    storySceneExpansionDigest: "scene:expansion", realityFingerprint,
    sceneIds: ["scene:1"], decisions: [{
      sceneId: "scene:1", readerOrder: 1, action: "charge", readerTime: "scene",
      expectationThreadIds: [], reasons: ["专业人物下注"],
      deepenScarcityEvidenceIds: [], reinforceBeliefIds: [], widenGapBeliefIds: [],
      embodimentTargets: ["旧认知被打破"], payoffThreadIds: [],
      reactionTargetEntityIds: ["medic"], retainedGainOpportunity: "任务入口",
      informationReleased: "重新估值", informationWithheld: "更高层尚未知情",
      focusShiftThreadIds: [], nextExpectationSeed: "上层识货",
      terminalExpectationReason: null, chapterBoundary: "chapter_end",
    }], digest: "reader:time",
  };
}

// prettier-ignore
function rehearsalMocks(statuses: ("feasible" | "infeasible")[]) {
  vi.spyOn(StoryRuntimeAgentService.prototype, "proposeCharacterAction")
    .mockImplementation(async (_run, _step, observation) => ({
      value: {
        projectId: "p1", generationId: observation.generationId,
        round: observation.round, characterId: observation.characterId,
        agentId: observation.agentId, digest: `proposal:${observation.round}`,
      } as CharacterActionProposal, usage, generation: { mode: "native", attempts: 1 },
    }));
  let count = 0;
  const arbitration = vi.spyOn(StoryRuntimeAgentService.prototype, "arbitrateWorld")
    .mockImplementation(async (_run, _step, req) => {
      const status = statuses[Math.min(count++, statuses.length - 1)]!;
      return {
        value: {
          projectId: "p1", storyUnitDesignDigest: "story-unit:1",
          storyUnitEventId: "event:1", realityFingerprint: req.worldContext.realityFingerprint,
          finalized: status === "feasible", hardContractStatus: status,
          conflicts: status === "infeasible" ? [{
            id: "conflict:1", affectedAgentIds: ["character:medic"],
          }] : [], digest: "arbitration:1",
        } as WorldArbitrationReceipt,
        usage, generation: { mode: "native", attempts: 1 },
      };
    });
  const scenes = vi.spyOn(StorySceneExpansionService.prototype, "expand")
    .mockImplementation(async (_run, _step, req) => ({
      value: sceneExpansion(req.arbitration.realityFingerprint),
      usage, generation: { mode: "native", attempts: 1 },
    }));
  const reader = vi.spyOn(ExpectationNarrativeService.prototype, "allocateSceneReaderTime")
    .mockImplementation(async (_run, _step, req) => ({
      value: readerTime(req.sceneExpansion.realityFingerprint),
      usage, generation: { mode: "native", attempts: 1 },
    }));
  return { arbitration, scenes, reader };
}

// prettier-ignore
function rehearsingRequest(designed: { field: StoryObjectField; storyUnit: StoryUnitDesign }) {
  return {
    field: designed.field, storyUnit: designed.storyUnit,
    storyUnitEventId: "event:1", expectationState: {
      ...expectationState, realityFingerprint: designed.field.realityFingerprint,
    },
    chapterTitle: "重新估值", chapterGoal: "让专业旧认知崩塌",
    povEntityId: "hero", targetCharacters: 1200,
    request: "把复核扩展成多场景", generationId: "g1",
    activeSeedEntityIds: ["medic"],
    stakeBeatByEntityId: { medic: "stake" as const },
  };
}

// prettier-ignore
describe("StoryDirectorPipeline", () => {
  it("connects S04-S08 and only writes the handoff / inherited creative ledgers on adoption", async () => {
    const observations: CharacterObservationPacket[] = [];
    vi.spyOn(ExpectationNarrativeService.prototype, "designExpectation")
      .mockImplementation(async (_run, _step, request) => ({
        value: expectationFor(request), usage, generation: { mode: "native", attempts: 1 },
      }));
    vi.spyOn(StoryAuthoringService.prototype, "designStoryUnit")
      .mockImplementation(async (_run, _step, request) => ({
        value: unitFor(request.field), usage, generation: { mode: "native", attempts: 1 },
      }));
    const agent = vi.spyOn(StoryRuntimeAgentService.prototype, "proposeCharacterAction")
      .mockImplementation(async (_run, _step, observation) => {
        observations.push(observation);
        return { value: {
          projectId: "p1", generationId: observation.generationId,
          round: observation.round, characterId: observation.characterId,
          agentId: observation.agentId, digest: "proposal:1",
        } as CharacterActionProposal, usage, generation: { mode: "native", attempts: 1 } };
      });
    const mocks = rehearsalMocks(["feasible"]);
    // Replace spy with observation-aware spy after the fixture helpers install their defaults.
    agent.mockImplementation(async (_run, _step, observation) => {
      observations.push(observation);
      return { value: {
        projectId: "p1", generationId: observation.generationId,
        round: observation.round, characterId: observation.characterId,
        agentId: observation.agentId, digest: "proposal:1",
      } as CharacterActionProposal, usage, generation: { mode: "native", attempts: 1 } };
    });
    const director = new StoryDirectorPipeline(db, mockModel);
    const designed = await director.designStoryUnitForFrame(run, step, frameRequest(), signal);
    expect(designed.status).toBe("READY");
    expect(designed.usage.calls).toBe(2);
    if (designed.status !== "READY") throw new Error("unexpected block");
    const before = story.requireOutlineNode("p1", "chapter-1");
    expect(before.metadata.storyProductionHandoff).toBeUndefined();
    const rehearsal = await director.rehearseAndBuildHandoff(
      run, step, rehearsingRequest(designed), signal,
    );
    expect(rehearsal.status).toBe("READY");
    expect(observations).toHaveLength(1);
    expect(observations[0]!.authoredDirection).toContain("stake=");
    expect(observations[0]!.authoredDirection).not.toContain("payoff=");
    if (rehearsal.status !== "READY") throw new Error("unexpected conflict");
    expect(story.requireOutlineNode("p1", "chapter-1").metadata.storyProductionHandoff).toBeUndefined();
    const adopted = director.adoptNodeHandoff({
      chapterOutlineNodeId: "chapter-1", storyUnit: designed.storyUnit,
      handoff: rehearsal.handoff, expectationState: rehearsingRequest(designed).expectationState,
      updatedAt: now,
    });
    expect(parseStoryChapterProductionHandoff(
      story.requireOutlineNode("p1", "chapter-1").metadata.storyProductionHandoff,
    )?.digest).toBe(rehearsal.handoff.digest);
    expect(adopted.creativeFrameState.upgradeLedger).toEqual(ledger);
    const next = buildStoryCreativeFrameContext(story.listOutline("p1"), "chapter-2");
    expect(next.inheritedState.latestUpgradeLedger).toEqual(ledger);
    expect(next.inheritedState.activeStakeLedger).toHaveLength(1);
    expect(mocks.scenes).toHaveBeenCalledTimes(1);
    expect(mocks.reader).toHaveBeenCalledTimes(1);
  });

  it("stops on BLOCKED_WORLD_GAP without running S05 or staging anything", async () => {
    vi.spyOn(ExpectationNarrativeService.prototype, "designExpectation")
      .mockImplementation(async (_run, _step, request) => ({
        value: expectationFor(request), usage, generation: { mode: "native", attempts: 1 },
      }));
    vi.spyOn(StoryAuthoringService.prototype, "designStoryUnit")
      .mockImplementation(async (_run, _step, request) => ({
        value: unitFor(request.field, "BLOCKED_WORLD_GAP"),
        usage, generation: { mode: "native", attempts: 1 },
      }));
    const agent = vi.spyOn(StoryRuntimeAgentService.prototype, "proposeCharacterAction");
    const director = new StoryDirectorPipeline(db, mockModel);
    const blocked = await director.designStoryUnitForFrame(run, step, frameRequest(), signal);
    expect(blocked.status).toBe("BLOCKED_WORLD_GAP");
    if (blocked.status !== "BLOCKED_WORLD_GAP") throw new Error("unexpected ready");
    expect(blocked.worldGaps).toHaveLength(1);
    expect(blocked.storyUnit.worldGaps).toBe(blocked.worldGaps);
    expect(agent).not.toHaveBeenCalled();
    expect(story.requireOutlineNode("p1", "chapter-1").metadata).toEqual({});
  });

  it.each([
    { statuses: ["infeasible", "feasible"] as const, expected: "READY" },
    { statuses: ["infeasible", "infeasible"] as const, expected: "CONFLICT_BLOCKED" },
  ])("rehearses only conflicted actors and reports $expected", async ({ statuses, expected }) => {
    const mocks = rehearsalMocks([...statuses]);
    const director = new StoryDirectorPipeline(db, mockModel);
    const field = {
      version: "story-object-field.v1", authority: "speculative", projectId: "p1",
      scale: "S04", realityFingerprint: "r1", storyStateFingerprint: "s1",
      objects: [
        { id: "object:hero", entityId: "hero", kind: "character", name: "秀信",
          surfaces: [{ authority: "confirmed", sourceId: "world-reality:hero", facet: "state", slotKey: "location", value: "木叶医院" }] },
        { id: "object:medic", entityId: "medic", kind: "character", name: "医疗忍者",
          surfaces: [{ authority: "confirmed", sourceId: "world-reality:medic", facet: "state", slotKey: "duty", value: "专业复核" }] },
      ], digest: "field:1",
    } as unknown as StoryObjectField;
    const result = await director.rehearseAndBuildHandoff(run, step, {
      ...rehearsingRequest({ field, storyUnit: unitFor(field) }),
      activeSeedEntityIds: ["medic"],
      maxConflictRetries: 1,
    }, signal);
    expect(result.status).toBe(expected);
    expect(mocks.arbitration).toHaveBeenCalledTimes(2);
    expect(mocks.arbitration.mock.calls[1]![2].round).toBe(2);
    expect(result.usage.calls).toBe(4 + (expected === "READY" ? 2 : 0));
    if (expected === "CONFLICT_BLOCKED") {
      expect(mocks.scenes).not.toHaveBeenCalled();
      expect(mocks.reader).not.toHaveBeenCalled();
    } else {
      expect(mocks.scenes).toHaveBeenCalledOnce();
      expect(mocks.reader).toHaveBeenCalledOnce();
    }
  });
});
