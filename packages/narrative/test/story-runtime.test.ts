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

function observation() {
  return new CharacterObservationBuilder(database).build({
    projectId: "p1",
    characterId: "hero",
    generationId: "generation-1",
    targetOutlineNodeId: "chapter-1",
    currentGoal: "leave the harbor",
    pressure: "the gate is closing",
    resources: ["key"],
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
        location: "harbor",
        currentGoal: "leave the harbor",
        pressure: "the gate is closing",
        resources: ["key"],
        availableOptions: ["wait", "use the key"],
        rejectedOptions: ["wait"],
        decision: "use the key",
        decisionReason: "the gate will close before help arrives",
        intendedAction: "unlock the side gate and leave",
        actionDuration: "five minutes",
        knowledgeRefs: ["public-location", "visible-event"],
        resourceClaims: ["key"],
        constraints: ["do not reveal the key to Rival"],
        contingencies: ["hide if the patrol arrives"],
        expectedConsequences: ["leave the harbor"],
        submittedAt: now,
      },
      current,
    ),
  };
}

describe("Module 3 Story Runtime core", () => {
  it("builds a subjective observation without author-secret leakage", () => {
    const current = observation();
    expect(current.location).toBe("harbor");
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
          location: "harbor",
          currentGoal: "leave the harbor",
          pressure: "the gate is closing",
          resources: ["key"],
          availableOptions: ["wait", "use the key"],
          rejectedOptions: ["wait"],
          decision: "use the key",
          decisionReason: "the secret king will help me",
          intendedAction: "unlock the side gate and leave",
          actionDuration: "five minutes",
          knowledgeRefs: ["secret-identity"],
          resourceClaims: ["key"],
          constraints: [],
          contingencies: [],
          expectedConsequences: ["leave the harbor"],
          submittedAt: now,
        },
        current,
      ),
    ).toThrow("story_runtime.proposal.unavailable_knowledge:secret-identity");
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
      ),
    ).toThrow("story_runtime.arbitration.rewrites_character_intent");
  });
});
