// prettier-ignore
import { createCanonEntity, createOutlineNode, createProject, type RunBudgetUsage } from "@narralume/domain";
// prettier-ignore
import type { ExpectationDesign, ExpectationState, StoryUnitDesign, StoryObjectField, StorySceneExpansion, StoryReaderTimePlan, WorldArbitrationReceipt, CharacterActionProposal } from "@narralume/contracts";
// prettier-ignore
import { SqliteCanonRepository, SqliteProjectRepository, SqliteStoryRepository, SqliteRunRepository } from "@narralume/persistence";
// prettier-ignore
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
// prettier-ignore
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { ServerConfig } from "../src/config.js";

// prettier-ignore
import type { NarrativeModelClient } from "@narralume/narrative";
// prettier-ignore
import { StoryAuthoringService } from "@narralume/narrative";
// prettier-ignore
import { ExpectationNarrativeService } from "@narralume/narrative";
// prettier-ignore
import { StoryRuntimeAgentService } from "@narralume/narrative";
// prettier-ignore
import { StorySceneExpansionService } from "@narralume/narrative";
// prettier-ignore
import { buildStoryCreativeFrameContext } from "@narralume/narrative";
// prettier-ignore
import { parseStoryChapterProductionHandoff } from "@narralume/narrative";

// prettier-ignore
const now = "2026-11-23T12:00:00.000Z";
// prettier-ignore
const usage: RunBudgetUsage = { inputTokens: 10, outputTokens: 5, calls: 1, costUsd: 0, wallTimeMs: 2 };
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
let app: Awaited<ReturnType<typeof buildApp>> | null = null;
// prettier-ignore
const config: ServerConfig = { dataDirectory: ".", databasePath: ":memory:", host: "127.0.0.1", port: 4317, environment: "test" };

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
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = null;
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
    wishFulfillment: {
      version: "wish-fulfillment-frame.v1" as const,
      authority: "creative-direction" as const,
      mode: "story_current" as const,
      protagonistEntityId: "hero",
      readerFantasy: "看秀信被专业体系重新定价，并由这份认可打开更昂贵的任务圈",
      protagonistDesire: "获得重新估值",
      threads: [
        {
          id: "wish:api:recognition",
          targetRefs: ["object:medic"],
          targetNames: ["医疗忍者"],
          dimension: "relationship",
          readerFantasy: "专业人物亲自改判并认可秀信",
          protagonistDesire: "用真实表现获得认可",
          desiredChange: "医疗忍者从普通估值转为主动认可并上报",
          privatePrivilege: null,
          publicRepricing: "专业体系提高秀信评级",
          upgradeLeverage: ["高价任务资格"],
          phase: "selected" as const,
        },
        {
          id: "wish:api:circle",
          targetRefs: ["object:medic"],
          targetNames: ["高价任务审核圈"],
          dimension: "circle",
          readerFantasy: "这份认可继续把秀信带进更高价圈层",
          protagonistDesire: "进入上层任务体系",
          desiredChange: "从医院伤员变成有资格进入高价任务审核的人",
          privatePrivilege: "获得普通伤员没有的复核入口",
          publicRepricing: null,
          upgradeLeverage: ["上层任务入口"],
          phase: "candidate" as const,
        },
      ],
      bearingRequirements: [{
        id: "bearing:api:medic",
        threadIds: ["wish:api:recognition"],
        kind: "person" as const,
        requirement: "真实专业人物亲自见证并承担改判责任",
        evidenceRefs: [],
        status: "candidate" as const,
        raisesPriceBecause: "专业人物自己改判才让认可变贵",
      }],
      settlementTargets: [{
        threadId: "wish:api:recognition",
        assetKind: "status",
        targetGain: "专业重新估值",
      }],
    },
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
function unitFor(
  field: StoryObjectField,
  status: "READY" | "BLOCKED_WORLD_GAP" = "READY",
): StoryUnitDesign {
  const frame = frameRequest().wishFulfillment;
  return {
    version: "story-unit-design.v1", authority: "speculative", status,
    projectId: "p1", objectFieldDigest: field.digest,
    creativeContextDigest: "creative:1", sourceSeedIds: [],
    expectationDesignDigest: "expectation:1",
    objectAnchorIds: ["object:hero", "object:medic"], groundingSurfaceRefs: [],
    storyProblem: "医疗忍者如何重新估值秀信",
    worldGaps: status === "READY" ? [] : [{
      id: "gap:1",
      kind: "missing_object",
      anchorObjectIds: ["object:medic"],
      need: "补出真实专业人物对男主进行复核与改判的承重",
      reason: "这条认可意淫还缺能承担专业判断责任的真实人物承重",
      productionHint: "people",
      wishFulfillmentThreadIds: ["wish:api:recognition"],
      bearingRequirementIds: ["bearing:api:medic"],
      status: "OPEN",
    }],
    wishFulfillment: {
      ...frame,
      threads: frame.threads.map((thread) =>
        status === "READY" && thread.id === "wish:api:recognition"
          ? { ...thread, phase: "realizing" as const }
          : thread,
      ),
    },
    wishFulfillmentAdvances: status === "READY" ? [{
      threadId: "wish:api:recognition",
      toPhase: "realizing",
      storyMove: "让医疗忍者亲自见证异常并开始改判",
    }] : [],
    bearingEvidenceRefs: status === "READY" ? ["api-test-bearing-surface"] : [],
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
// prettier-ignore
async function awaitCompleted(runId: string) {
  const store = new SqliteRunRepository(db);
  for (let attempt = 0; attempt < 200; attempt++) {
    const snapshot = store.getSnapshot(runId);
    if (snapshot.run.status === "completed") return snapshot;
    if (["failed", "cancelled", "failed_recoverable"].includes(snapshot.run.status)) {
      throw new Error(JSON.stringify(snapshot.steps.map((step) => ({ kind: step.kind, error: step.error }))));
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`story director did not complete: ${runId}`);
}

// prettier-ignore
describe("StoryDirector API dual-host run contract", () => {
  it("runs design, rehearsal and explicit chapter adoption without speculative writes", async () => {
    vi.spyOn(ExpectationNarrativeService.prototype, "designExpectation")
      .mockImplementation(async (_run, _step, request) => ({
        value: expectationFor(request), usage, generation: { mode: "native", attempts: 1 },
      }));
    vi.spyOn(StoryAuthoringService.prototype, "designStoryUnit")
      .mockImplementation(async (_run, _step, request) => {
        expect(request.creativeContext.wishFulfillment?.threads).toHaveLength(2);
        expect(
          request.creativeContext.wishFulfillment?.threads.map((thread) => thread.id),
        ).toEqual(["wish:api:recognition", "wish:api:circle"]);
        return {
          value: unitFor(request.field),
          usage,
          generation: { mode: "native", attempts: 1 },
        };
      });
    rehearsalMocks(["feasible"]);
    app = await buildApp({
      config, database: db, narrativeModelClient: mockModel, enableRunWorker: true, logger: false,
      environment: {
        NARRATIVE_LLM_API_KEY: "test-key",
        NARRATIVE_LLM_BASE_URL: "https://api.example.test/v1",
        NARRATIVE_LLM_MODEL: "mock-story-director",
      },
    });
    const design = await app.inject({
      method: "POST", url: "/api/projects/p1/story-director/design", payload: frameRequest(),
    });
    expect(design.statusCode, design.body).toBe(202);
    const designRun = await awaitCompleted(design.json().runId as string);
    const designed = designRun.steps[0]?.outputArtifact;
    expect(designed?.status).toBe("READY");
    expect(designed?.field).toBeTruthy();
    expect(designed?.storyUnit).toBeTruthy();
    expect(story.requireOutlineNode("p1", "chapter-1").metadata.storyProductionHandoff).toBeUndefined();

    const rehearsing = rehearsingRequest(designed as unknown as { field: StoryObjectField; storyUnit: StoryUnitDesign });
    const rehearse = await app.inject({
      method: "POST", url: "/api/projects/p1/story-director/rehearse", payload: rehearsing,
    });
    expect(rehearse.statusCode, rehearse.body).toBe(202);
    const rehearsalRun = await awaitCompleted(rehearse.json().runId as string);
    const rehearsal = rehearsalRun.steps[0]?.outputArtifact;
    expect(rehearsal?.status).toBe("READY");
    expect(rehearsal?.handoff).toBeTruthy();
    expect(story.requireOutlineNode("p1", "chapter-1").metadata.storyProductionHandoff).toBeUndefined();

    const adopt = await app.inject({
      method: "POST", url: "/api/projects/p1/story-director/adopt-handoff",
      payload: {
        chapterOutlineNodeId: "chapter-1",
        frameOutlineNodeId: "chapter-1",
        storyUnit: designed?.storyUnit,
        handoff: rehearsal?.handoff,
        expectationState: rehearsing.expectationState,
        updatedAt: now,
      },
    });
    expect(adopt.statusCode, adopt.body).toBe(200);
    const chapter = story.requireOutlineNode("p1", "chapter-1");
    expect(parseStoryChapterProductionHandoff(chapter.metadata.storyProductionHandoff)?.digest)
      .toBe((rehearsal?.handoff as { digest: string }).digest);
    expect(chapter.metadata.mmorpgCreativeState).toBeTruthy();
    expect(story.requireOutlineNode("p1", "chapter-2").metadata.storyProductionHandoff).toBeUndefined();
    const next = buildStoryCreativeFrameContext(story.listOutline("p1"), "chapter-2");
    expect(next.inheritedState.latestUpgradeLedger).toEqual(ledger);
    expect(next.inheritedState.latestWishFulfillment?.threads).toHaveLength(2);
    expect(
      next.inheritedState.latestWishFulfillment?.threads.find(
        (thread) => thread.id === "wish:api:recognition",
      )?.phase,
    ).toBe("realizing");
    const outlineResponse = await app.inject({ method: "GET", url: "/api/projects/p1/outline" });
    expect(outlineResponse.statusCode, outlineResponse.body).toBe(200);
    expect(outlineResponse.body).toContain("storyProductionHandoff");
    expect(outlineResponse.body).toContain("mmorpgCreativeState");
  });

  it("returns a concrete Module-1 work order when Story design is blocked by fantasy bearing", async () => {
    vi.spyOn(ExpectationNarrativeService.prototype, "designExpectation")
      .mockImplementation(async (_run, _step, request) => ({
        value: expectationFor(request),
        usage,
        generation: { mode: "native", attempts: 1 },
      }));
    vi.spyOn(StoryAuthoringService.prototype, "designStoryUnit")
      .mockImplementation(async (_run, _step, request) => ({
        value: unitFor(request.field, "BLOCKED_WORLD_GAP"),
        usage,
        generation: { mode: "native", attempts: 1 },
      }));

    app = await buildApp({
      config,
      database: db,
      narrativeModelClient: mockModel,
      enableRunWorker: true,
      logger: false,
      environment: {
        NARRATIVE_LLM_API_KEY: "test-key",
        NARRATIVE_LLM_BASE_URL: "https://api.example.test/v1",
        NARRATIVE_LLM_MODEL: "mock-story-director",
      },
    });

    const design = await app.inject({
      method: "POST",
      url: "/api/projects/p1/story-director/design",
      payload: frameRequest(),
    });
    expect(design.statusCode, design.body).toBe(202);

    const designRun = await awaitCompleted(design.json().runId as string);
    const blocked = designRun.steps[0]?.outputArtifact as
      | {
          status?: string;
          worldGaps?: Array<Record<string, unknown>>;
          worldWorkOrders?: Array<Record<string, unknown>>;
        }
      | undefined;

    expect(blocked?.status).toBe("BLOCKED_WORLD_GAP");
    expect(blocked?.worldGaps).toHaveLength(1);
    expect(blocked?.worldWorkOrders).toHaveLength(1);
    expect(blocked?.worldWorkOrders?.[0]).toMatchObject({
      workshop: "people",
      subjectRef: "canon:medic",
      subjectName: "医疗忍者",
      wishFulfillmentThreadIds: ["wish:api:recognition"],
      bearingRequirementIds: ["bearing:api:medic"],
    });

    expect(
      story.requireOutlineNode("p1", "chapter-1").metadata
        .storyProductionHandoff,
    ).toBeUndefined();
    expect(
      story.requireOutlineNode("p1", "chapter-1").metadata.mmorpgCreativeState,
    ).toBeUndefined();
  });
});
