import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { NarrativeModelClient } from "../src/model-client.js";
import {
  StoryRuntimeAgentService,
  finalizeCharacterActionProposal,
} from "../src/index.js";
import type {
  CharacterObservationPacket,
  WorldArbitrationContext,
} from "@narralume/contracts";
import { describe, expect, it, vi } from "vitest";

const usage: RunBudgetUsage = {
  inputTokens: 100,
  outputTokens: 50,
  calls: 1,
  costUsd: 0,
  wallTimeMs: 10,
};

const run = { projectId: "p1" } as NarrativeRun;
const step = { id: "runtime-step" } as NarrativeRunStep;

function observation(
  characterId: string,
  name: string,
): CharacterObservationPacket {
  const evidence = [
    {
      id: `${characterId}:fact`,
      kind: "fact" as const,
      text: `${name} sees the gate closing`,
      sourceType: "canon_fact",
    },
  ];
  return {
    version: "character-observation.v1",
    authority: "speculative",
    projectId: "p1",
    generationId: "g1",
    round: 1,
    storyUnitDesignDigest: "story-unit:1",
    storyUnitEventId: "event:gate",
    agentId: `character:${characterId}`,
    characterId,
    characterName: name,
    targetOutlineNodeId: "chapter-1",
    currentGoal: evidence[0]!.text,
    goalEvidenceRefs: [`${characterId}:fact`],
    pressure: "the gate is closing",
    authoredStoryFunction: "perform the authored gate-pressure line",
    authoredStakeIds: characterId === "rival" ? ["stake:rival"] : [],
    authoredDirection:
      characterId === "rival"
        ? "misjudge Hero, commit to blocking the side gate, and escalate in character"
        : "complete the authored escape line in a characterization-consistent way",
    location: "harbor",
    locationEvidenceRefs: [`${characterId}:fact`],
    resources: [`${characterId}:fact`],
    relationships: [],
    knownFacts: evidence,
    perceivedEvents: [],
    memory: [],
    storyStateFingerprint: `story-${characterId}`,
    realityFingerprint: "reality:event:gate",
    sourceIds: ["story-state"],
    digest: `observation-${characterId}`,
  };
}

function proposalFor(current: CharacterObservationPacket) {
  return finalizeCharacterActionProposal(
    {
      version: "character-action-proposal.v1",
      authority: "speculative",
      projectId: current.projectId,
      generationId: current.generationId,
      round: current.round,
      agentId: current.agentId,
      characterId: current.characterId,
      characterName: current.characterName,
      observationDigest: current.digest,
      storyUnitDesignDigest: current.storyUnitDesignDigest,
      storyUnitEventId: current.storyUnitEventId,
      realityFingerprint: current.realityFingerprint,
      location: current.location,
      currentGoal: current.currentGoal,
      pressure: current.pressure,
      resources: [`${current.characterId}:fact`],
      availableOptions: ["wait", "use the key"],
      rejectedOptions: ["wait"],
      decision: "use the key",
      decisionReason: "the gate is closing",
      intendedAction: "unlock the side gate",
      actionDuration: "five minutes",
      knowledgeRefs: [`${current.characterId}:fact`],
      resourceClaims: [`${current.characterId}:fact`],
      constraints: [],
      contingencies: [],
      expectedConsequences: ["leave the harbor"],
      submittedAt: null,
    },
    current,
  );
}

function worldContextFor(
  proposal: ReturnType<typeof proposalFor>,
): WorldArbitrationContext {
  return {
    version: "world-arbitration-context.v1",
    authority: "speculative",
    projectId: proposal.projectId,
    storyUnitDesignDigest: proposal.storyUnitDesignDigest,
    storyUnitEventId: proposal.storyUnitEventId,
    realityFingerprint: proposal.realityFingerprint,
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

describe("StoryRuntimeAgentService", () => {
  it("binds model character decisions back to the host observation", async () => {
    const current = observation("hero", "Hero");
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-character-action-plan");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("Hero");
          expect(serialized).toContain("authoredStoryFunction");
          expect(serialized).toContain("不是来决定");
          expect(serialized).toContain("严禁流露出任何‘预知自己会被主角打脸’的违和感");
          const checked = validate({
            resources: [`${current.characterId}:fact`],
            availableOptions: ["wait", "use the key"],
            rejectedOptions: ["wait"],
            decision: "use the key",
            decisionReason: "the gate is closing",
            intendedAction: "unlock the side gate",
            actionDuration: "five minutes",
            knowledgeRefs: ["hero:fact"],
            resourceClaims: [`${current.characterId}:fact`],
            constraints: [],
            contingencies: [],
            expectedConsequences: ["leave the harbor"],
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
    const service = new StoryRuntimeAgentService(model);
    const result = await service.proposeCharacterAction(
      run,
      step,
      current,
      new AbortController().signal,
    );
    expect(result.value.agentId).toBe("character:hero");
    expect(result.value.observationDigest).toBe(current.digest);
    expect(result.value.decision).toBe("use the key");
    expect(result.value.authority).toBe("speculative");
  });

  it("arbitrates all proposals while host-binding original intent", async () => {
    const hero = proposalFor(observation("hero", "Hero"));
    const rivalObservation = observation("rival", "Rival");
    const rival = finalizeCharacterActionProposal(
      {
        version: "character-action-proposal.v1",
        authority: "speculative",
        projectId: "p1",
        generationId: "g1",
        round: 1,
        agentId: rivalObservation.agentId,
        characterId: "rival",
        characterName: "Rival",
        observationDigest: rivalObservation.digest,
        storyUnitDesignDigest: rivalObservation.storyUnitDesignDigest,
        storyUnitEventId: rivalObservation.storyUnitEventId,
        realityFingerprint: rivalObservation.realityFingerprint,
        location: "harbor",
        currentGoal: rivalObservation.currentGoal,
        pressure: rivalObservation.pressure,
        resources: ["rival:fact"],
        availableOptions: ["wait", "block the side gate"],
        rejectedOptions: ["wait"],
        decision: "block the side gate",
        decisionReason: "prevent Hero from leaving",
        intendedAction: "stand in front of the side gate",
        actionDuration: "five minutes",
        knowledgeRefs: ["rival:fact"],
        resourceClaims: [],
        constraints: [],
        contingencies: [],
        expectedConsequences: ["Hero cannot leave freely"],
        submittedAt: null,
      },
      rivalObservation,
    );

    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, _request, _contract, validate) => {
          expect(purpose).toBe("story-world-arbitration-plan");
          const checked = validate({
            resolutions: [
              {
                agentId: "character:hero",
                actionOrder: 1,
                outcome: "partial",
                immediateResult: "Hero unlocks the gate but finds Rival there",
                stateAfter: "Hero remains inside the gate facing Rival",
                butterflyEffects: [
                  {
                    effect: "the delay gives the patrol time to approach",
                    transmissionPath: "time",
                    arrivalHorizon: 1,
                    protagonistImpact: "escape pressure rises",
                  },
                ],
                conflictIds: ["collision-1"],
              },
              {
                agentId: "character:rival",
                actionOrder: 2,
                outcome: "success",
                immediateResult: "Rival occupies the side gate",
                stateAfter: "Rival blocks Hero's route",
                butterflyEffects: [
                  {
                    effect: "Hero must deal with Rival before leaving",
                    transmissionPath: "direct collision",
                    arrivalHorizon: 0,
                    protagonistImpact: "new immediate confrontation",
                  },
                ],
                conflictIds: ["collision-1"],
              },
            ],
            conflicts: [
              {
                id: "collision-1",
                kind: "collision",
                affectedAgentIds: ["character:hero", "character:rival"],
                feedback: "both actions target the same side gate",
                resolved: true,
              },
            ],
            hardContractStatus: "feasible",
            hardContractConflicts: [],
            protagonistProjection: {
              characterId: "hero",
              planConstraints: ["Rival currently blocks the route"],
              causalChain: [
                "Hero opens gate",
                "Rival blocks gate",
                "confrontation occurs",
              ],
            },
            finalized: true,
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
    const result = await new StoryRuntimeAgentService(model).arbitrateWorld(
      run,
      step,
      {
        projectId: "p1",
        generationId: "g1",
        round: 1,
        proposals: [hero, rival],
        worldContext: worldContextFor(hero),
        protagonistCharacterId: "hero",
      },
      new AbortController().signal,
    );

    const heroResolution = result.value.resolutions.find(
      (item) => item.agentId === "character:hero",
    );
    expect(heroResolution?.decision).toBe(hero.decision);
    expect(heroResolution?.intendedAction).toBe(hero.intendedAction);
    expect(result.value.protagonistProjection?.chosenDecision).toBe(
      hero.decision,
    );
    expect(result.value.authority).toBe("speculative");
  });

  it("rejects a protagonist projection for the wrong character", async () => {
    const hero = proposalFor(observation("hero", "Hero"));
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, _purpose, _request, _contract, validate) => {
          const checked = validate({
            resolutions: [
              {
                agentId: "character:hero",
                actionOrder: 1,
                outcome: "success",
                immediateResult: "Hero leaves",
                stateAfter: "Hero is outside",
                butterflyEffects: [],
                conflictIds: [],
              },
            ],
            conflicts: [],
            hardContractStatus: "feasible",
            hardContractConflicts: [],
            protagonistProjection: {
              characterId: "rival",
              planConstraints: ["wrong character"],
              causalChain: ["wrong projection"],
            },
            finalized: true,
          });
          if (!checked.success) throw new Error(checked.issues.join("; "));
          throw new Error("unexpected validation success");
        },
      ),
    };

    await expect(
      new StoryRuntimeAgentService(model).arbitrateWorld(
        run,
        step,
        {
          projectId: "p1",
          generationId: "g1",
          round: 1,
          proposals: [hero],
          worldContext: worldContextFor(hero),
          protagonistCharacterId: "hero",
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow(
      "protagonistProjection.characterId must equal requested protagonist hero",
    );
  });

  it("rejects an arbitration model output that omits an active character", async () => {
    const hero = proposalFor(observation("hero", "Hero"));
    const rival = proposalFor(observation("rival", "Rival"));
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, _purpose, _request, _contract, validate) => {
          const checked = validate({
            resolutions: [
              {
                agentId: "character:hero",
                actionOrder: 1,
                outcome: "success",
                immediateResult: "Hero leaves",
                stateAfter: "Hero is outside",
                butterflyEffects: [
                  {
                    effect: "the patrol follows",
                    transmissionPath: "report",
                    arrivalHorizon: 1,
                    protagonistImpact: "future pursuit",
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
          });
          if (!checked.success) throw new Error(checked.issues.join("; "));
          throw new Error("unexpected validation success");
        },
      ),
    };

    await expect(
      new StoryRuntimeAgentService(model).arbitrateWorld(
        run,
        step,
        {
          projectId: "p1",
          generationId: "g1",
          round: 1,
          proposals: [hero, rival],
          worldContext: worldContextFor(hero),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("missing agentId character:rival");
  });
});
