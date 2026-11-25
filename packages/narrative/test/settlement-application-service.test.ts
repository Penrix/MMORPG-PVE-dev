import {
  createCanonEntity,
  createCanonFact,
  createOutlineNode,
  createProject,
} from "@narralume/domain";
import { buildChapterRecipe } from "@narralume/harness";
import {
  SqliteCanonRepository,
  SqliteDocumentRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRepository,
  SqliteReviewRepository,
  SqliteRunRepository,
  SqliteStoryRepository,
  WorldAtlasStoryContextBuilder,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import {
  applySettlementToCreativeFrameState,
  buildStoryCreativeFrameContext,
  finalizeStoryCreativeFrameState,
  stageStoryCreativeFrameState,
} from "../src/story-creative-context.js";
import {
  StoryChapterProductionHandoffSchema,
  stageStoryChapterProductionHandoff,
} from "../src/story-production-handoff.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SettlementApplicationService,
  SettlementConflictError,
} from "../src/settlement-application-service.js";

const now = "2026-08-10T00:00:00.000Z";
let database: NodeNarrativeDatabase;
let canon: SqliteCanonRepository;
let state: SqliteNarrativeStateRepository;
let reviews: SqliteReviewRepository;

beforeEach(() => {
  database = new NodeNarrativeDatabase();
  database.migrate();
  new SqliteProjectRepository(database).insert(
    createProject({ id: "p1", title: "Settlement", now }),
  );
  const story = new SqliteStoryRepository(database);
  const root = story.insertOutlineNode(
    createOutlineNode({
      id: "book",
      projectId: "p1",
      parent: null,
      kind: "book",
      ordinal: 0,
      title: "Book",
      now,
    }),
  );
  story.insertOutlineNode(
    createOutlineNode({
      id: "chapter-1",
      projectId: "p1",
      parent: root,
      kind: "chapter",
      ordinal: 0,
      title: "Chapter",
      now,
    }),
  );
  story.insertOutlineNode(
    createOutlineNode({
      id: "chapter-2",
      projectId: "p1",
      parent: root,
      kind: "chapter",
      ordinal: 1,
      title: "Chapter 2",
      now,
    }),
  );
  canon = new SqliteCanonRepository(database);
  for (const [id, name] of [
    ["hero", "Hero"],
    ["rival", "Rival"],
  ] as const) {
    canon.insertEntity(
      createCanonEntity({
        id,
        projectId: "p1",
        type: "character",
        name,
        now,
      }),
    );
  }
  const recipe = buildChapterRecipe("run-1", 0);
  new SqliteRunRepository(database).create({
    id: "run-1",
    projectId: "p1",
    recipe: recipe.name,
    recipeVersion: recipe.version,
    mode: "manual",
    targetOutlineNodeId: "chapter-1",
    policy: {},
    budgetLimit: {
      maxInputTokens: 10_000,
      maxOutputTokens: 10_000,
      maxCalls: 10,
      maxCostUsd: null,
      maxWallTimeMs: 60_000,
    },
    steps: recipe.steps,
    now,
  });
  const secondRecipe = buildChapterRecipe("run-2", 0);
  new SqliteRunRepository(database).create({
    id: "run-2",
    projectId: "p1",
    recipe: secondRecipe.name,
    recipeVersion: secondRecipe.version,
    mode: "manual",
    targetOutlineNodeId: "chapter-2",
    policy: {},
    budgetLimit: {
      maxInputTokens: 10_000,
      maxOutputTokens: 10_000,
      maxCalls: 10,
      maxCostUsd: null,
      maxWallTimeMs: 60_000,
    },
    steps: secondRecipe.steps,
    now,
  });
  state = new SqliteNarrativeStateRepository(database, canon, story);
  reviews = new SqliteReviewRepository(database);
});

afterEach(() => database.close());

describe("SettlementApplicationService", () => {
  it("applies all grounded chapter-state candidates in one transaction", () => {
    seedChangeSet("change-1", settlementPayload("awake"));
    const result = new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-1",
      now,
    });
    expect(result.changeSet.status).toBe("applied");
    expect(canon.listEffectiveFacts("p1")).toEqual([
      expect.objectContaining({
        predicate: "condition",
        value: "awake",
        authority: "confirmed",
      }),
    ]);
    expect(state.listTimeline("p1")).toEqual([
      expect.objectContaining({ title: "Hero wakes" }),
    ]);
    expect(state.listCurrentRelationships("p1")).toEqual([
      expect.objectContaining({ relation: "trusts" }),
    ]);
    expect(state.listForeshadows("p1")).toEqual([
      expect.objectContaining({ title: "Broken key", status: "planted" }),
    ]);
    expect(state.listKnowledge("p1")).toEqual([
      expect.objectContaining({
        knowerType: "character",
        knowerEntityId: "hero",
        factId: "change-1:fact:0",
        belief: "known",
      }),
      expect.objectContaining({
        knowerType: "character",
        knowerEntityId: "rival",
        timelineEventId: "change-1:timeline:0",
        belief: "suspected",
      }),
    ]);
  });

  it("accepted settlement facts are immediately visible through Project Reality without duplicate writes", () => {
    seedChangeSet("change-reality", settlementPayload("awake"));
    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-reality",
      now,
    });

    const context = new WorldAtlasStoryContextBuilder(database).build({
      projectId: "p1",
      entityIds: ["hero"],
    });
    expect(context.current[0]).toMatchObject({
      authority: "confirmed",
      sourceType: "project_reality",
    });
    expect(context.current[0]!.content).toContain('"condition"');
    expect(context.current[0]!.content).toContain('"awake"');
    expect(context.current[0]!.content).toContain('"trusts"');
    expect(context.current[0]!.content).toContain('"Hero wakes"');

    // Settlement remains the single write path. Current Reality projects the
    // accepted Canon fact, native relationship and native timeline event
    // instead of duplicating them into another truth table.
    expect(
      database.raw
        .prepare(
          "SELECT COUNT(*) AS count FROM project_reality_revisions WHERE project_id=?",
        )
        .get("p1"),
    ).toEqual({ count: 0 });
    expect(state.listCurrentRelationships("p1")).toEqual([
      expect.objectContaining({ relation: "trusts" }),
    ]);
  });

  it("updates relationships and foreshadows by stable id and preserves timeline causality", () => {
    seedChangeSet("change-1", settlementPayload("awake"));
    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-1",
      now,
    });
    seedChangeSet(
      "change-3",
      {
        summary: "Trust deepens while the key clue develops.",
        summaryPoints: [
          {
            text: "Trust deepens while the key clue develops.",
            basis: "observed",
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("becomes alert")],
          },
        ],
        stateDelta: [
          {
            key: "hero.condition",
            before: "awake",
            after: "alert",
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("becomes alert")],
          },
        ],
        factCandidates: [
          {
            operation: "supersede",
            factId: "change-1:fact:0",
            subjectId: "hero",
            predicate: "condition",
            objectEntityId: null,
            value: "alert",
            knowledgeScope: "character",
            knowledgeSubjectId: "hero",
            belief: "known",
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("becomes alert")],
          },
        ],
        timelineCandidates: [
          {
            title: "Rival reveals the map",
            description: null,
            storyTime: "noon",
            participantIds: ["hero", "rival"],
            causeEventIds: ["change-1:timeline:0"],
            visibility: "author_secret",
            knownBy: [{ entityId: "hero", belief: "known" }],
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("reveals the map")],
          },
        ],
        relationshipCandidates: [
          {
            action: "update",
            relationshipId: "change-1:relationship:0",
            fromEntityId: "hero",
            toEntityId: "rival",
            relation: "allies",
            change: "mutual trust becomes an alliance",
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("alliance")],
          },
        ],
        foreshadowCandidates: [
          {
            foreshadowId: "change-1:foreshadow:0",
            title: "Broken key",
            action: "develop",
            expectedStatus: "planted",
            importance: 3,
            targetFromNodeId: "chapter-1",
            targetToNodeId: null,
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("key fits the map")],
          },
        ],
      },
      "run-2",
    );

    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-3",
      now: "2026-08-10T00:02:00.000Z",
    });

    expect(state.listCurrentRelationships("p1")).toEqual([
      expect.objectContaining({
        id: "change-3:relationship:0",
        relation: "allies",
        supersedesEventId: "change-1:relationship:0",
      }),
    ]);
    expect(canon.listEffectiveFacts("p1")).toEqual([
      expect.objectContaining({
        id: "change-3:fact:0",
        value: "alert",
        supersedesFactId: "change-1:fact:0",
      }),
    ]);
    expect(state.listTimeline("p1")).toEqual([
      expect.objectContaining({ id: "change-1:timeline:0", causes: [] }),
      expect.objectContaining({
        id: "change-3:timeline:0",
        causes: ["change-1:timeline:0"],
        visibility: "author_secret",
      }),
    ]);
    expect(state.listForeshadows("p1")).toEqual([
      expect.objectContaining({
        id: "change-1:foreshadow:0",
        status: "developing",
        evidenceNodeIds: ["chapter-1", "chapter-2"],
      }),
    ]);
    expect(state.listKnowledge("p1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timelineEventId: "change-3:timeline:0",
          learnedAtNodeId: "chapter-2",
        }),
      ]),
    );

    seedChangeSet(
      "change-5",
      {
        summary: "The broken key clue is resolved.",
        summaryPoints: [
          {
            text: "The broken key clue is resolved.",
            basis: "observed",
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("the key opens the chart case")],
          },
        ],
        stateDelta: [],
        factCandidates: [],
        timelineCandidates: [],
        relationshipCandidates: [],
        foreshadowCandidates: [
          {
            foreshadowId: "change-1:foreshadow:0",
            title: "Broken key",
            action: "resolve",
            expectedStatus: "developing",
            importance: 3,
            targetFromNodeId: "chapter-1",
            targetToNodeId: null,
            evidenceParagraphs: [1],
            evidence: [groundedEvidence("the key opens the chart case")],
          },
        ],
      },
      "run-2",
    );
    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-5",
      now: "2026-08-10T00:03:00.000Z",
    });
    expect(state.listForeshadows("p1")).toEqual([
      expect.objectContaining({
        id: "change-1:foreshadow:0",
        status: "resolved",
        resolutionNodeId: "chapter-2",
      }),
    ]);
  });

  it("rolls back on locked conflicts, then applies an explicitly confirmed supersede", () => {
    canon.insertFact(
      createCanonFact({
        id: "existing-condition",
        projectId: "p1",
        subjectId: "hero",
        predicate: "condition",
        value: "asleep",
        authority: "locked",
        sourceType: "test",
        now,
      }),
    );
    seedChangeSet(
      "change-2",
      settlementPayload("awake", {
        operation: "supersede",
        factId: "existing-condition",
      }),
    );
    const service = new SettlementApplicationService(database);
    expect(() =>
      service.apply({ projectId: "p1", changeSetId: "change-2", now }),
    ).toThrow(SettlementConflictError);
    expect(state.listTimeline("p1")).toHaveLength(0);
    expect(reviews.requireCanonChangeSet("p1", "change-2").status).toBe(
      "candidate",
    );

    const completed = service.apply({
      projectId: "p1",
      changeSetId: "change-2",
      conflictPolicy: "force",
      now: "2026-08-10T00:01:00.000Z",
    });
    expect(completed.changeSet.status).toBe("applied");
    expect(canon.listEffectiveFacts("p1")).toEqual([
      expect.objectContaining({
        value: "awake",
        supersedesFactId: "existing-condition",
      }),
    ]);
    expect(state.listTimeline("p1")).toHaveLength(1);
  });

  it("adds an asserted proposition without guessing a supersession target", () => {
    canon.insertFact(
      createCanonFact({
        id: "existing-condition",
        projectId: "p1",
        subjectId: "hero",
        predicate: "condition",
        value: "asleep",
        authority: "confirmed",
        sourceType: "test",
        now,
      }),
    );
    seedChangeSet("change-4", settlementPayload("awake"));

    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-4",
      now,
    });
    expect(canon.listEffectiveFacts("p1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "existing-condition", value: "asleep" }),
        expect.objectContaining({ id: "change-4:fact:0", value: "awake" }),
      ]),
    );
    expect(state.listTimeline("p1")).toHaveLength(1);
  });

  it("reuses an identical proposition while recording new knowledge", () => {
    seedChangeSet("change-1", settlementPayload("awake"));
    const service = new SettlementApplicationService(database);
    service.apply({ projectId: "p1", changeSetId: "change-1", now });
    seedChangeSet("change-4", settlementPayload("awake"), "run-2");

    service.apply({
      projectId: "p1",
      changeSetId: "change-4",
      now: "2026-08-10T00:01:00.000Z",
    });

    expect(
      canon
        .listEffectiveFacts("p1")
        .filter(
          (fact) => fact.predicate === "condition" && fact.value === "awake",
        ),
    ).toHaveLength(1);
    expect(state.listKnowledge("p1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "change-1:knowledge:fact:0",
          factId: "change-1:fact:0",
        }),
        expect.objectContaining({
          id: "change-4:knowledge:fact:0",
          factId: "change-1:fact:0",
        }),
      ]),
    );
  });
});

// prettier-ignore
describe("accepted settlement creative-state write-back", () => {
  it("settles payoff stakes, charges open stakes and carries retained gains into chapter two", () => {
    stageCreativeChapter();
    seedChangeSet("change-creative", settlementPayload("awake"));
    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-creative",
      now,
    });

    const story = new SqliteStoryRepository(database);
    const settled = chapterCreativeState();
    expect(settled.status).toBe("settled");
    expect(settled.stakeLedger.map((stake) => stake.state)).toEqual([
      "settled",
      "escalating",
    ]);
    expect(settled.expectationThreads.map((thread) => thread.phase)).toEqual([
      "settled",
      "charging",
    ]);
    expect(settled.retainedAssets).toContain("新的任务资格");
    expect(settled.realityFingerprint).toBe("reality:accepted");

    const next = buildStoryCreativeFrameContext(
      story.listOutline("p1"),
      "chapter-2",
    );
    expect(next.inheritedState.retainedAssets).toContain("新的任务资格");
    expect(next.inheritedState.activeStakeLedger.map((stake) => stake.entityId)).toEqual([
      "hero",
    ]);
    expect(next.inheritedState.openExpectationThreads.map((thread) => thread.id)).toEqual([
      "thread:future",
    ]);
    expect(next.inheritedState.sourceStates.at(-1)?.frameOutlineNodeId).toBe("chapter-1");
  });

  it("resolves a manual settlement run through its linked document", () => {
    stageCreativeChapter();
    const story = new SqliteStoryRepository(database);
    new SqliteDocumentRepository(database).insert({
      id: "document:manual",
      projectId: "p1",
      kind: "chapter",
      title: "Manual chapter",
      outlineNodeId: "chapter-1",
      currentVersionId: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const recipe = buildChapterRecipe("manual-settlement", 0);
    new SqliteRunRepository(database).create({
      id: "manual-settlement",
      projectId: "p1",
      recipe: recipe.name,
      recipeVersion: recipe.version,
      mode: "manual",
      targetOutlineNodeId: null,
      policy: { documentId: "document:manual" },
      budgetLimit: {
        maxInputTokens: 10_000,
        maxOutputTokens: 10_000,
        maxCalls: 10,
        maxCostUsd: null,
        maxWallTimeMs: 60_000,
      },
      steps: recipe.steps,
      now,
    });
    seedChangeSet("change-manual", settlementPayload("awake"), "manual-settlement");
    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-manual",
      now,
    });
    expect(chapterCreativeState().status).toBe("settled");
    expect(story.requireOutlineNode("p1", "chapter-1").metadata.storyProductionHandoff).toBeDefined();
  });

  it("leaves the creative snapshot untouched after rejection or a locked Canon conflict", () => {
    stageCreativeChapter();
    const before = chapterCreativeState();
    seedChangeSet("change-rejected", settlementPayload("awake"));
    const service = new SettlementApplicationService(database);
    service.reject({ projectId: "p1", changeSetId: "change-rejected", now });
    expect(chapterCreativeState()).toEqual(before);

    canon.insertFact(createCanonFact({
      id: "locked-condition-creative",
      projectId: "p1",
      subjectId: "hero",
      predicate: "condition",
      value: "asleep",
      authority: "locked",
      sourceType: "test",
      now,
    }));
    seedChangeSet("change-locked-creative", settlementPayload("awake", {
      operation: "supersede",
      factId: "locked-condition-creative",
    }));
    expect(() => service.apply({
      projectId: "p1",
      changeSetId: "change-locked-creative",
      now,
    })).toThrow(SettlementConflictError);
    expect(chapterCreativeState()).toEqual(before);
    expect(reviews.requireCanonChangeSet("p1", "change-locked-creative").status).toBe("candidate");
  });

  it("keeps ordinary chapters without a handoff compatible", () => {
    seedChangeSet("change-ordinary", settlementPayload("awake"));
    new SettlementApplicationService(database).apply({
      projectId: "p1",
      changeSetId: "change-ordinary",
      now,
    });
    expect(new SqliteStoryRepository(database).requireOutlineNode("p1", "chapter-1").metadata.mmorpgCreativeState).toBeUndefined();
  });

  it("supports inherited states and optional one-step upgrade advancement without mutating input", () => {
    const original = creativeState();
    const handoff = creativeHandoff();
    const next = applySettlementToCreativeFrameState({
      currentState: original,
      handoff,
      frameOutlineNodeId: "chapter-2",
      updatedAt: "2026-08-10T00:05:00.000Z",
      advanceUpgradeStep: true,
    });
    expect(next.frameOutlineNodeId).toBe("chapter-2");
    expect(next.upgradeLedger?.currentStepId).toBe("step:two");
    expect(
      next.wishFulfillment?.threads.find(
        (thread) => thread.id === "wish:settlement:qualification",
      )?.phase,
    ).toBe("retained");
    expect(next.retainedAssets).toContain("新的任务资格");
    expect(original.upgradeLedger?.currentStepId).toBe("step:one");
    expect(
      original.wishFulfillment?.threads.find(
        (thread) => thread.id === "wish:settlement:qualification",
      )?.phase,
    ).toBe("realizing");
    expect(next.digest).not.toBe(original.digest);
  });
});

// prettier-ignore
function creativeState() {
  const stake = (id: string, entityId: string) => ({
    id,
    entityId,
    currentBelief: "还没有能力",
    currentInterest: "自己的资格",
    stakeAction: "押注复核",
    stakeAssets: ["资格"],
    commitmentCost: "声誉",
    escalationPlan: "提高下注",
    payoffReaction: "重新估值",
    settlementChange: "实际给出资格",
    state: "seeded" as const,
  });
  const thread = (id: string) => ({
    id,
    targetEmotion: "得意",
    targetOutcome: "主角获得资格",
    readerKnowledgeSummary: "读者知道优势",
    payoffCondition: "专业复核通过",
    reactionTargetEntityIds: ["rival"],
    retainedGainTarget: "新的任务资格",
    phase: "seeding" as const,
  });
  return finalizeStoryCreativeFrameState({
    version: "story-creative-frame-state.v1",
    authority: "creative-state",
    projectId: "p1",
    frameOutlineNodeId: "chapter-1",
    status: "in_progress",
    upgradeLedger: {
      protagonistEntityId: "hero",
      road: "任务升级",
      currentStepId: "step:one",
      currentPosition: "普通忍者",
      stageGoal: "获取资格",
      settlementTarget: "获得任务资格",
      steps: [
        { id: "step:one", title: "复核", targetGain: "资格", gate: "通过复核", targetCircle: "忍者" },
        { id: "step:two", title: "高级任务", targetGain: "高级待遇", gate: "进入任务", targetCircle: "上忍" },
      ],
    },
    wishFulfillment: {
      version: "wish-fulfillment-frame.v1",
      authority: "creative-direction",
      mode: "story_current",
      protagonistEntityId: "hero",
      readerFantasy: "通过专业复核真正拿到新的任务资格",
      protagonistDesire: "获得任务资格",
      threads: [{
        id: "wish:settlement:qualification",
        targetRefs: [],
        targetNames: ["任务资格"],
        dimension: "status",
        readerFantasy: "不是只被夸，而是真正拿到更贵的任务资格",
        protagonistDesire: "取得资格",
        desiredChange: "从普通忍者变成拥有新的任务资格",
        privatePrivilege: "获得此前没有的任务准入",
        publicRepricing: "任务体系正式提高男主价格",
        upgradeLeverage: ["高级任务"],
        phase: "realizing",
      }],
      bearingRequirements: [{
        id: "bearing:settlement:review",
        threadIds: ["wish:settlement:qualification"],
        kind: "qualification",
        requirement: "真实复核与任务体系必须正式承认资格",
        evidenceRefs: ["story-surface:review"],
        status: "grounded",
        raisesPriceBecause: "资格必须由真实体系给出才是资产",
      }],
      settlementTargets: [{
        threadId: "wish:settlement:qualification",
        assetKind: "access",
        targetGain: "新的任务资格",
      }],
    },
    stakeLedger: [stake("stake:payoff", "rival"), stake("stake:charge", "hero")],
    expectationThreads: [thread("thread:payoff"), thread("thread:future")],
    retainedAssets: ["旧资格"],
    unresolvedQuestions: [],
    sourceStoryUnitDigests: ["story-unit:1"],
    realityFingerprint: "reality:before",
    updatedAt: now,
  });
}

// prettier-ignore
function creativeHandoff() {
  const directive = (action: "payoff" | "charge", order: number) => ({
    sceneId: `scene:${order}`,
    readerOrder: order,
    action,
    readerTime: "scene" as const,
    expectationThreadIds: action === "charge" ? ["thread:future"] : ["thread:payoff"],
    reasons: ["推进故事"],
    embodimentTargets: ["实际动作"],
    payoffThreadIds: action === "payoff" ? ["thread:payoff"] : [],
    reactionTargetEntityIds: action === "payoff" ? ["rival"] : ["hero"],
    retainedGainOpportunity: action === "payoff" ? "新的任务资格" : null,
    informationReleased: "读者得知结果",
    informationWithheld: "下一步仍未揭晓",
    focusShiftThreadIds: [],
    nextExpectationSeed: null,
    chapterBoundary: "continue" as const,
  });
  return StoryChapterProductionHandoffSchema.parse({
    version: "story-chapter-production-handoff.v1",
    authority: "locked-story-design",
    projectId: "p1",
    storySceneExpansionDigest: "expansion:1",
    storyReaderTimePlanDigest: "reader:1",
    realityFingerprint: "reality:accepted",
    chapterTitle: "Chapter",
    chapterGoal: "资格复核",
    povEntityId: "hero",
    plannedEntityIds: ["hero", "rival"],
    targetCharacters: 800,
    sourceSceneIds: ["scene:1", "scene:2"],
    lockedScenePlan: {
      chapterGoal: "资格复核",
      povEntityId: "hero",
      scenes: [{
        title: "结算",
        goal: "资格",
        conflict: "旧认知",
        turn: "事实出现",
        outcome: "资格取得",
        locationId: null,
        participants: ["hero", "rival"],
        targetCharacters: 800,
      }],
      continuityRisks: [],
    },
    readerTimeDirectives: [directive("payoff", 1), directive("charge", 2)],
    digest: "handoff:1",
  });
}

// prettier-ignore
function stageCreativeChapter(): void {
  const story = new SqliteStoryRepository(database);
  stageStoryChapterProductionHandoff(story, "chapter-1", creativeHandoff(), now);
  stageStoryCreativeFrameState(story, creativeState(), now);
}

// prettier-ignore
function chapterCreativeState() {
  const node = new SqliteStoryRepository(database).requireOutlineNode("p1", "chapter-1");
  return node.metadata.mmorpgCreativeState as ReturnType<typeof creativeState>;
}

function seedChangeSet(
  id: string,
  changes: Record<string, unknown>,
  runId = "run-1",
): void {
  reviews.insertCanonChangeSet({
    id,
    projectId: "p1",
    runId,
    stepId: `${runId}:commit`,
    changes,
    status: "candidate",
    createdAt: now,
  });
}

function settlementPayload(
  value: string,
  factOperation: {
    operation: "assert" | "supersede";
    factId: string | null;
  } = {
    operation: "assert",
    factId: null,
  },
): Record<string, unknown> {
  return {
    summary: "The hero wakes and trusts the rival.",
    summaryPoints: [
      {
        text: "The hero wakes and trusts the rival.",
        basis: "observed",
        evidenceParagraphs: [1],
        evidence: [groundedEvidence("wakes")],
      },
    ],
    stateDelta: [
      {
        key: "hero.condition",
        before: "asleep",
        after: value,
        evidenceParagraphs: [1],
        evidence: [groundedEvidence("wakes")],
      },
    ],
    factCandidates: [
      {
        ...factOperation,
        subjectId: "hero",
        predicate: "condition",
        objectEntityId: null,
        value,
        knowledgeScope: "character",
        knowledgeSubjectId: "hero",
        belief: "known",
        evidenceParagraphs: [1],
        evidence: [groundedEvidence("wakes")],
      },
    ],
    timelineCandidates: [
      {
        title: "Hero wakes",
        description: null,
        storyTime: "dawn",
        participantIds: ["hero"],
        causeEventIds: [],
        visibility: "reader",
        knownBy: [{ entityId: "rival", belief: "suspected" }],
        evidenceParagraphs: [1],
        evidence: [groundedEvidence("wakes")],
      },
    ],
    relationshipCandidates: [
      {
        action: "start",
        relationshipId: null,
        fromEntityId: "hero",
        toEntityId: "rival",
        relation: "trusts",
        change: "trust increases",
        evidenceParagraphs: [1],
        evidence: [groundedEvidence("trusts")],
      },
    ],
    foreshadowCandidates: [
      {
        foreshadowId: null,
        title: "Broken key",
        action: "plant",
        expectedStatus: null,
        importance: 3,
        targetFromNodeId: "chapter-1",
        targetToNodeId: null,
        evidenceParagraphs: [1],
        evidence: [groundedEvidence("broken key")],
      },
    ],
  };
}

function groundedEvidence(quote: string) {
  return {
    quote,
    start: 0,
    end: quote.length,
    documentVersionId: null,
    contentHash: "a".repeat(64),
    paragraphOrdinal: 1,
  };
}
