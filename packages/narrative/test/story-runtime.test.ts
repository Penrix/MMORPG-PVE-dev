import {
  createCanonEntity,
  createCanonFact,
  createOutlineNode,
  createProject,
} from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRepository,
  SqliteStoryRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  CharacterActionProposal,
  StoryUnitDesign,
  WorldArbitrationContext,
} from "@narralume/contracts";

import {
  CharacterObservationBuilder,
  finalizeCharacterActionProposal,
  finalizeWorldArbitrationReceipt,
  speculativeRealityDeltaFromArbitration,
} from "../src/index.js";

const now = "2026-11-21T14:00:00.000Z";
let database: NodeNarrativeDatabase;
let canon: SqliteCanonRepository;
let state: SqliteNarrativeStateRepository;
let story: SqliteStoryRepository;

beforeEach(() => {
  database = new NodeNarrativeDatabase();
  database.migrate();
  new SqliteProjectRepository(database).insert(
    createProject({ id: "p1", title: "Story Runtime", now }),
  );
  story = new SqliteStoryRepository(database);
  const book = story.insertOutlineNode(
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
      parent: book,
      kind: "chapter",
      ordinal: 0,
      title: "Chapter 1",
      povEntityId: "hero",
      now,
    }),
  );

  canon = new SqliteCanonRepository(database);
  canon.insertEntity(
    createCanonEntity({
      id: "hero",
      projectId: "p1",
      type: "character",
      name: "Hero",
      now,
    }),
  );
  canon.insertEntity(
    createCanonEntity({
      id: "rival",
      projectId: "p1",
      type: "character",
      name: "Rival",
      now,
    }),
  );
  canon.insertFact(
    createCanonFact({
      id: "public-location",
      projectId: "p1",
      subjectId: "hero",
      predicate: "location",
      value: "harbor",
      knowledgeScope: "omniscient",
      authority: "confirmed",
      sourceType: "test",
      now,
    }),
  );
  canon.insertFact(
    createCanonFact({
      id: "hero-goal",
      projectId: "p1",
      subjectId: "hero",
      predicate: "current_goal",
      value: "leave the harbor",
      knowledgeScope: "omniscient",
      authority: "confirmed",
      sourceType: "test",
      now,
    }),
  );
  canon.insertFact(
    createCanonFact({
      id: "hero-key",
      projectId: "p1",
      subjectId: "hero",
      predicate: "has_resource",
      value: "side-gate key",
      knowledgeScope: "omniscient",
      authority: "confirmed",
      sourceType: "test",
      now,
    }),
  );
  canon.insertFact(
    createCanonFact({
      id: "secret-identity",
      projectId: "p1",
      subjectId: "rival",
      predicate: "secretIdentity",
      value: "missing king",
      knowledgeScope: "author_secret",
      authority: "locked",
      sourceType: "test",
      now,
    }),
  );

  state = new SqliteNarrativeStateRepository(database, canon, story);
  state.insertRelationship({
    id: "relationship-1",
    projectId: "p1",
    fromEntityId: "hero",
    toEntityId: "rival",
    relation: "distrusts",
    intensity: 7,
    state: {},
    outlineNodeId: "chapter-1",
    storyTime: null,
    sourceId: "test",
    supersedesEventId: null,
    createdAt: now,
  });
  state.insertTimelineEvent({
    id: "visible-event",
    projectId: "p1",
    title: "Harbor alarm",
    description: "The harbor gate is closing",
    outlineNodeId: "chapter-1",
    storyTimeStart: null,
    storyTimeEnd: null,
    sequence: 1,
    participants: ["hero"],
    causes: [],
    visibility: "omniscient",
    sourceId: "test",
    createdAt: now,
    updatedAt: now,
  });
  state.insertTimelineEvent({
    id: "secret-event",
    projectId: "p1",
    title: "Secret coronation",
    description: "Only the author knows",
    outlineNodeId: "chapter-1",
    storyTimeStart: null,
    storyTimeEnd: null,
    sequence: 2,
    participants: ["rival"],
    causes: [],
    visibility: "author_secret",
    sourceId: "test",
    createdAt: now,
    updatedAt: now,
  });
});

afterEach(() => database.close());

function storyUnitDesignFixture(): StoryUnitDesign {
  return {
    version: "story-unit-design.v1",
    authority: "speculative",
    status: "READY",
    projectId: "p1",
    objectFieldDigest: "field:gate",
    sourceSeedIds: [],
    expectationDesignDigest: "expectation:gate",
    objectAnchorIds: ["object:hero"],
    groundingSurfaceRefs: ["surface:hero-location"],
    storyProblem: "Hero must decide how to leave before the gate closes",
    worldGaps: [],
    upgradeLedger: {
      protagonistEntityId: "hero",
      road: "escape the harbor and advance to the next circle",
      currentStepId: "step:escape",
      currentPosition: "trapped inside the harbor",
      stageGoal: "leave before the gate closes",
      settlementTarget: "reach the next safe area with the key retained",
      steps: [
        {
          id: "step:escape",
          title: "Escape the harbor",
          targetGain: "freedom of movement",
          gate: "the side gate is closing",
          targetCircle: "outside harbor",
        },
      ],
    },
    campNetwork: [
      {
        entityId: "hero",
        camp: "友方",
        currentGoal: "leave the harbor",
        storyRole: "protagonist action source",
        currentBelief: "the side gate may still be usable",
        currentInterest: "escape before the harbor closes",
      },
    ],
    stakeLedger: [],
    reactionTargets: [],
    campTransitions: [],
    appearanceOrderEntityIds: ["hero"],
    informationRelease: [],
    events: [
      {
        id: "event:gate",
        title: "Closing side gate",
        purpose: "force a concrete choice",
        problem: "Hero must choose how to leave before the side gate closes",
        storyPressure: "the closing gate turns delay into a concrete cost",
        castPoolEntityIds: ["hero"],
        activeSeedEntityIds: ["hero"],
        actorPressures: [
          {
            entityId: "hero",
            pressure: "the gate is closing",
          },
        ],
        stakeEntryIds: [],
        reactionTargetEntityIds: [],
        informationReleaseSteps: [],
        phaseTargets: [
          {
            phase: "during",
            entityIds: ["hero"],
            authorIntent: "force the decision under visible time pressure",
            expectationMovement:
              "move the escape question toward a real choice",
          },
        ],
        realityQuestion:
          "what does Hero actually choose with the visible gate and available key",
        observableStart: "the gate begins to close",
        expectedChange: "Hero chooses a real action",
        readerExpectation: "whether Hero can leave in time",
      },
    ],
    directorAuthority: "author-defined-story-line",
    characterExecutionRule: "characterization-constrained-performance",
    digest: "story-unit:1",
  };
}

function worldContextFixture(
  design: StoryUnitDesign = storyUnitDesignFixture(),
): WorldArbitrationContext {
  return {
    version: "world-arbitration-context.v1",
    authority: "speculative",
    projectId: "p1",
    storyUnitDesignDigest: design.digest,
    storyUnitEventId: "event:gate",
    realityFingerprint: "reality:event:gate",
    surfaces: [
      {
        entityId: "hero",
        name: "Hero",
        kind: "character",
        facet: "state",
        slotKey: "location",
        value: "harbor",
        sourceId: "world-reality:hero",
      },
    ],
    digest: "world-context:gate",
  };
}

function observation() {
  const design = storyUnitDesignFixture();
  return new CharacterObservationBuilder(database).build({
    projectId: "p1",
    characterId: "hero",
    generationId: "generation-1",
    storyUnitDesign: design,
    worldContext: worldContextFixture(design),
    targetOutlineNodeId: "chapter-1",
    goalEvidenceRefs: ["hero-goal"],
    resourceEvidenceRefs: ["hero-key"],
  });
}

function proposal() {
  const current = observation();
  return {
    observation: current,
    proposal: finalizeCharacterActionProposal(
      {
        version: "character-action-proposal.v1",
        authority: "speculative",
        projectId: "p1",
        generationId: "generation-1",
        round: 1,
        agentId: current.agentId,
        characterId: "hero",
        characterName: "Hero",
        observationDigest: current.digest,
        storyUnitDesignDigest: current.storyUnitDesignDigest,
        storyUnitEventId: current.storyUnitEventId,
        realityFingerprint: current.realityFingerprint,
        location: "harbor",
        currentGoal: current.currentGoal,
        pressure: "the gate is closing",
        resources: ["hero-key"],
        availableOptions: ["wait", "use the key"],
        rejectedOptions: ["wait"],
        decision: "use the key",
        decisionReason: "the gate will close before help arrives",
        intendedAction: "unlock the side gate and leave",
        actionDuration: "five minutes",
        knowledgeRefs: ["public-location", "visible-event"],
        resourceClaims: ["hero-key"],
        constraints: ["do not reveal the key to Rival"],
        contingencies: ["hide if the patrol arrives"],
        expectedConsequences: ["leave the harbor"],
        submittedAt: now,
      },
      current,
    ),
  };
}

function arbitrationContextFor(
  proposal: CharacterActionProposal,
): WorldArbitrationContext {
  const context = worldContextFixture();
  return {
    ...context,
    projectId: proposal.projectId,
    storyUnitDesignDigest: proposal.storyUnitDesignDigest,
    storyUnitEventId: proposal.storyUnitEventId,
    realityFingerprint: proposal.realityFingerprint,
  };
}

describe("Module 3 Story Runtime core", () => {
  it("builds a subjective observation without author-secret leakage", () => {
    const current = observation();
    expect(current.location).toBe("harbor");
    expect(current.authority).toBe("speculative");
    expect(current.storyUnitDesignDigest).toBe("story-unit:1");
    expect(current.storyUnitEventId).toBe("event:gate");
    expect(current.goalEvidenceRefs).toEqual(["hero-goal"]);
    expect(current.authoredStoryFunction).toBe("protagonist action source");
    expect(current.authoredDirection).toContain("escape");
    expect(current.authoredStakeIds).toEqual([]);
    expect(current.locationEvidenceRefs).toEqual(["public-location"]);
    expect(current.resources).toEqual(["hero-key"]);
    expect(current.knownFacts.map((item) => item.id)).toContain(
      "public-location",
    );
    expect(current.knownFacts.map((item) => item.id)).not.toContain(
      "secret-identity",
    );
    expect(current.perceivedEvents.map((item) => item.id)).toContain(
      "visible-event",
    );
    expect(current.perceivedEvents.map((item) => item.id)).not.toContain(
      "secret-event",
    );
    expect(current.relationships.map((item) => item.id)).toContain(
      "relationship-1",
    );
    expect(current.storyStateFingerprint).toBeTruthy();
    expect(current.realityFingerprint).toBeTruthy();
  });

  it("rejects actor state that is not grounded in visible evidence", () => {
    expect(() =>
      new CharacterObservationBuilder(database).build({
        projectId: "p1",
        characterId: "hero",
        generationId: "generation-1",
        storyUnitDesign: storyUnitDesignFixture(),
        worldContext: worldContextFixture(),
        targetOutlineNodeId: "chapter-1",
        goalEvidenceRefs: ["secret-identity"],
        resourceEvidenceRefs: ["hero-key"],
      }),
    ).toThrow(
      "story_runtime.observation.goal_evidence_not_visible:secret-identity",
    );

    expect(() =>
      new CharacterObservationBuilder(database).build({
        projectId: "p1",
        characterId: "hero",
        generationId: "generation-1",
        storyUnitDesign: storyUnitDesignFixture(),
        worldContext: worldContextFixture(),
        targetOutlineNodeId: "chapter-1",
        goalEvidenceRefs: ["hero-goal"],
        resourceEvidenceRefs: ["invented-key"],
      }),
    ).toThrow(
      "story_runtime.observation.resource_evidence_not_visible:invented-key",
    );
  });

  it("rejects a character proposal that cites unavailable knowledge", () => {
    const current = observation();
    expect(() =>
      finalizeCharacterActionProposal(
        {
          version: "character-action-proposal.v1",
          authority: "speculative",
          projectId: "p1",
          generationId: "generation-1",
          round: 1,
          agentId: current.agentId,
          characterId: "hero",
          characterName: "Hero",
          observationDigest: current.digest,
          storyUnitDesignDigest: current.storyUnitDesignDigest,
          storyUnitEventId: current.storyUnitEventId,
          realityFingerprint: current.realityFingerprint,
          location: "harbor",
          currentGoal: current.currentGoal,
          pressure: "the gate is closing",
          resources: ["hero-key"],
          availableOptions: ["wait", "use the key"],
          rejectedOptions: ["wait"],
          decision: "use the key",
          decisionReason: "the secret king will help me",
          intendedAction: "unlock the side gate and leave",
          actionDuration: "five minutes",
          knowledgeRefs: ["secret-identity"],
          resourceClaims: ["hero-key"],
          constraints: [],
          contingencies: [],
          expectedConsequences: ["leave the harbor"],
          submittedAt: now,
        },
        current,
      ),
    ).toThrow("story_runtime.proposal.unavailable_knowledge:secret-identity");
  });

  it("rejects a resource claim that is not in the character's available resources", () => {
    const current = observation();
    expect(() =>
      finalizeCharacterActionProposal(
        {
          version: "character-action-proposal.v1",
          authority: "speculative",
          projectId: "p1",
          generationId: "generation-1",
          round: 1,
          agentId: current.agentId,
          characterId: "hero",
          characterName: "Hero",
          observationDigest: current.digest,
          storyUnitDesignDigest: current.storyUnitDesignDigest,
          storyUnitEventId: current.storyUnitEventId,
          realityFingerprint: current.realityFingerprint,
          location: "harbor",
          currentGoal: current.currentGoal,
          pressure: "the gate is closing",
          resources: ["hero-key"],
          availableOptions: ["wait", "use the key"],
          rejectedOptions: ["wait"],
          decision: "use the key",
          decisionReason: "the gate is closing",
          intendedAction: "unlock the side gate",
          actionDuration: "five minutes",
          knowledgeRefs: ["public-location"],
          resourceClaims: ["nuclear-weapon"],
          constraints: [],
          contingencies: [],
          expectedConsequences: [],
          submittedAt: now,
        },
        current,
      ),
    ).toThrow(
      "story_runtime.proposal.unavailable_resource_claim:nuclear-weapon",
    );
  });

  it("rejects arbitration when the world context belongs to another event", () => {
    const { proposal: current } = proposal();
    const context = {
      ...arbitrationContextFor(current),
      storyUnitEventId: "event:other",
      digest: "world-context:other",
    };
    expect(() =>
      finalizeWorldArbitrationReceipt(
        {
          version: "world-arbitration-receipt.v1",
          authority: "speculative",
          projectId: "p1",
          generationId: "generation-1",
          round: 1,
          storyUnitDesignDigest: current.storyUnitDesignDigest,
          storyUnitEventId: current.storyUnitEventId,
          realityFingerprint: current.realityFingerprint,
          worldContextDigest: context.digest,
          proposalDigests: [current.digest],
          resolutions: [
            {
              agentId: current.agentId,
              characterId: current.characterId,
              characterName: current.characterName,
              proposalDigest: current.digest,
              decision: current.decision,
              intendedAction: current.intendedAction,
              actionOrder: 1,
              outcome: "blocked",
              immediateResult: "no settlement",
              stateAfter: "unchanged",
              butterflyEffects: [],
              conflictIds: [],
            },
          ],
          conflicts: [],
          hardContractStatus: "feasible",
          hardContractConflicts: [],
          protagonistProjection: null,
          finalized: true,
          generatedAt: now,
        },
        [current],
        context,
      ),
    ).toThrow("story_runtime.arbitration.world_context_mismatch");
  });

  it("allows a resolved action with no butterfly effect instead of forcing invention", () => {
    const { proposal: current } = proposal();
    const receipt = finalizeWorldArbitrationReceipt(
      {
        version: "world-arbitration-receipt.v1",
        authority: "speculative",
        projectId: "p1",
        generationId: "generation-1",
        round: 1,
        storyUnitDesignDigest: current.storyUnitDesignDigest,
        storyUnitEventId: current.storyUnitEventId,
        realityFingerprint: current.realityFingerprint,
        worldContextDigest: arbitrationContextFor(current).digest,
        proposalDigests: [current.digest],
        resolutions: [
          {
            agentId: current.agentId,
            characterId: current.characterId,
            characterName: current.characterName,
            proposalDigest: current.digest,
            decision: current.decision,
            intendedAction: current.intendedAction,
            actionOrder: 1,
            outcome: "blocked",
            immediateResult: "the lock does not move",
            stateAfter: "Hero remains where he is",
            butterflyEffects: [],
            conflictIds: [],
          },
        ],
        conflicts: [],
        hardContractStatus: "feasible",
        hardContractConflicts: [],
        protagonistProjection: null,
        finalized: true,
        generatedAt: now,
      },
      [current],
      arbitrationContextFor(current),
    );
    expect(receipt.resolutions[0]!.butterflyEffects).toEqual([]);
  });

  it("binds arbitration to original character intent and keeps its delta speculative", () => {
    const { proposal: current } = proposal();
    const receipt = finalizeWorldArbitrationReceipt(
      {
        version: "world-arbitration-receipt.v1",
        authority: "speculative",
        projectId: "p1",
        generationId: "generation-1",
        round: 1,
        storyUnitDesignDigest: current.storyUnitDesignDigest,
        storyUnitEventId: current.storyUnitEventId,
        realityFingerprint: current.realityFingerprint,
        worldContextDigest: arbitrationContextFor(current).digest,
        proposalDigests: [current.digest],
        resolutions: [
          {
            agentId: current.agentId,
            characterId: "hero",
            characterName: "Hero",
            proposalDigest: current.digest,
            decision: current.decision,
            intendedAction: current.intendedAction,
            actionOrder: 1,
            outcome: "success",
            immediateResult: "the side gate opens",
            stateAfter: "Hero is outside the harbor",
            butterflyEffects: [
              {
                effect: "the patrol notices the opened side gate",
                transmissionPath: "patrol report",
                arrivalHorizon: 1,
                protagonistImpact: "pursuit may begin later",
              },
            ],
            conflictIds: [],
          },
        ],
        conflicts: [],
        hardContractStatus: "feasible",
        hardContractConflicts: [],
        protagonistProjection: {
          characterId: "hero",
          chosenDecision: current.decision,
          availableOptions: current.availableOptions,
          decisionReason: current.decisionReason,
          planConstraints: ["the key remains hidden"],
          causalChain: ["key -> side gate -> escape"],
        },
        finalized: true,
        generatedAt: now,
      },
      [current],
      arbitrationContextFor(current),
    );

    const delta = speculativeRealityDeltaFromArbitration(receipt);
    expect(delta.authority).toBe("speculative");
    expect(delta.warning).toContain("Do not write to Canon");
    expect(delta.mutations[0]?.stateAfter).toBe("Hero is outside the harbor");
    expect(canon.getFact("p1", "runtime-created-fact")).toBeNull();
    expect(state.listTimeline("p1")).toHaveLength(2);
  });

  it("rejects an Arbiter that rewrites a character decision", () => {
    const { proposal: current } = proposal();
    expect(() =>
      finalizeWorldArbitrationReceipt(
        {
          version: "world-arbitration-receipt.v1",
          authority: "speculative",
          projectId: "p1",
          generationId: "generation-1",
          round: 1,
          storyUnitDesignDigest: current.storyUnitDesignDigest,
          storyUnitEventId: current.storyUnitEventId,
          realityFingerprint: current.realityFingerprint,
          worldContextDigest: arbitrationContextFor(current).digest,
          proposalDigests: [current.digest],
          resolutions: [
            {
              agentId: current.agentId,
              characterId: "hero",
              characterName: "Hero",
              proposalDigest: current.digest,
              decision: "wait",
              intendedAction: current.intendedAction,
              actionOrder: 1,
              outcome: "blocked",
              immediateResult: "nothing happens",
              stateAfter: "Hero waits",
              butterflyEffects: [
                {
                  effect: "the gate closes",
                  transmissionPath: "direct observation",
                  arrivalHorizon: 0,
                  protagonistImpact: "escape becomes harder",
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
          generatedAt: now,
        },
        [current],
        arbitrationContextFor(current),
      ),
    ).toThrow("story_runtime.arbitration.rewrites_character_intent");
  });
});
