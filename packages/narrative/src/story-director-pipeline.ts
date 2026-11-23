// prettier-ignore
import { sha256Hex, type NarrativeRun, type NarrativeRunStep, type RunBudgetUsage } from "@narralume/domain";
// prettier-ignore
import type {
  CharacterActionProposal,
  CharacterObservationPacket,
  CreativeMaterialSelection,
  CreativeMethodInvocation,
  ExpectationDesign,
  ExpectationDesignEvidence,
  ExpectationState,
  StoryCreativeContext,
  StoryObjectField,
  StoryProtagonistCamera,
  StoryReaderTimePlan,
  StorySceneExpansion,
  StoryUnitDesign,
  StoryUpgradeLedger,
  WorldArbitrationContext,
  WorldArbitrationReceipt,
} from "@narralume/contracts";
// prettier-ignore
import {
  type NarrativeDatabase,
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteStoryRepository,
  WorldAtlasStoryContextBuilder,
} from "@narralume/persistence";

// prettier-ignore
import type { NarrativeModelClient } from "./model-client.js";
// prettier-ignore
import { StoryStatePacketBuilder } from "./story-state-packet.js";
// prettier-ignore
import { storyObjectFieldFromWorldContext, storyObjectSurfaceRef } from "./story-authoring-runtime.js";
// prettier-ignore
import {
  buildStoryCreativeFrameContext,
  finalizeStoryCreativeContext,
  storyCreativeFrameStateFromStoryUnit,
  stageStoryCreativeFrameState,
} from "./story-creative-context.js";
// prettier-ignore
import { ExpectationNarrativeService } from "./expectation-runtime-workers.js";
// prettier-ignore
import { StoryAuthoringService } from "./story-authoring-runtime-workers.js";
// prettier-ignore
import {
  worldArbitrationContextFromStoryUnit,
  CharacterObservationBuilder,
} from "./story-runtime.js";
// prettier-ignore
import { StoryRuntimeAgentService } from "./story-runtime-workers.js";
// prettier-ignore
import { finalizeCharacterActionProposal } from "./vendor/novel-studio/character-agent-protocol.js";
// prettier-ignore
import { StorySceneExpansionService } from "./story-scene-runtime-workers.js";
// prettier-ignore
import {
  buildStoryChapterProductionHandoff,
  stageStoryChapterProductionHandoff,
  type StoryChapterProductionHandoff,
} from "./story-production-handoff.js";

// prettier-ignore
export interface StoryDirectorFrameRequest {
  projectId: string;
  frameOutlineNodeId: string;
  entityIds: readonly string[];
  protagonistCamera: StoryProtagonistCamera;
  upgradeLedger?: StoryUpgradeLedger;
  storyTimeLabel?: string | null;
  request: string;
  readerNeed: string;
  targetEmotion: string;
  expectationDesign?: ExpectationDesign;
  methodInvocations?: readonly CreativeMethodInvocation[];
  materialSelections?: readonly CreativeMaterialSelection[];
  sourceSeedIds?: readonly string[];
}

// prettier-ignore
export type StoryDirectorFrameResult =
  | {
      status: "BLOCKED_WORLD_GAP";
      field: StoryObjectField;
      creativeContext: StoryCreativeContext;
      expectationDesign: ExpectationDesign;
      storyUnit: StoryUnitDesign;
      worldGaps: StoryUnitDesign["worldGaps"];
      usage: RunBudgetUsage;
    }
  | {
      status: "READY";
      field: StoryObjectField;
      creativeContext: StoryCreativeContext;
      expectationDesign: ExpectationDesign;
      storyUnit: StoryUnitDesign;
      usage: RunBudgetUsage;
    };

// prettier-ignore
export interface StoryDirectorRehearsalRequest {
  field: StoryObjectField;
  storyUnit: StoryUnitDesign;
  storyUnitEventId: string;
  expectationState: ExpectationState;
  chapterTitle: string;
  chapterGoal: string;
  povEntityId: string | null;
  targetCharacters: number;
  request: string;
  generationId: string;
  targetOutlineNodeId?: string | null;
  activeSeedEntityIds?: readonly string[];
  hardContracts?: readonly string[];
  stakeBeatByEntityId?: Readonly<Record<string, "stake" | "escalate" | "payoff">>;
  maxConflictRetries?: number;
}

// prettier-ignore
export type StoryDirectorRehearsalResult =
  | {
      status: "CONFLICT_BLOCKED";
      worldContext: WorldArbitrationContext;
      observations: CharacterObservationPacket[];
      proposals: CharacterActionProposal[];
      arbitration: WorldArbitrationReceipt;
      usage: RunBudgetUsage;
    }
  | {
      status: "READY";
      worldContext: WorldArbitrationContext;
      observations: CharacterObservationPacket[];
      proposals: CharacterActionProposal[];
      arbitration: WorldArbitrationReceipt;
      sceneExpansion: StorySceneExpansion;
      readerTimePlan: StoryReaderTimePlan;
      handoff: StoryChapterProductionHandoff;
      usage: RunBudgetUsage;
    };

// prettier-ignore
export interface StoryDirectorAdoptionInput {
  chapterOutlineNodeId: string;
  frameOutlineNodeId?: string;
  handoff: StoryChapterProductionHandoff;
  storyUnit: StoryUnitDesign;
  expectationState?: ExpectationState | null;
  updatedAt: string;
}

// prettier-ignore
function emptyUsage(): RunBudgetUsage {
  return { inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0, wallTimeMs: 0 };
}

// prettier-ignore
function addUsage(total: RunBudgetUsage, next: RunBudgetUsage): RunBudgetUsage {
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    calls: total.calls + next.calls,
    costUsd: total.costUsd + next.costUsd,
    wallTimeMs: total.wallTimeMs + next.wallTimeMs,
  };
}

/** S01-S08 coordination only. The speculative methods never stage data. */
// prettier-ignore
export class StoryDirectorPipeline {
  private readonly story: SqliteStoryRepository;
  private readonly canon: SqliteCanonRepository;
  private readonly state: SqliteNarrativeStateRepository;
  private readonly atlas: WorldAtlasStoryContextBuilder;
  private readonly observations: CharacterObservationBuilder;
  private readonly expectations: ExpectationNarrativeService;
  private readonly authoring: StoryAuthoringService;
  private readonly runtime: StoryRuntimeAgentService;
  private readonly scenes: StorySceneExpansionService;

  constructor(database: NarrativeDatabase, model: NarrativeModelClient) {
    this.story = new SqliteStoryRepository(database);
    this.canon = new SqliteCanonRepository(database);
    this.state = new SqliteNarrativeStateRepository(database, this.canon, this.story);
    this.atlas = new WorldAtlasStoryContextBuilder(database);
    this.observations = new CharacterObservationBuilder(database);
    this.expectations = new ExpectationNarrativeService(model);
    this.authoring = new StoryAuthoringService(model);
    this.runtime = new StoryRuntimeAgentService(model);
    this.scenes = new StorySceneExpansionService(model);
  }

  async designStoryUnitForFrame(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryDirectorFrameRequest,
    signal: AbortSignal,
  ): Promise<StoryDirectorFrameResult> {
    if (run.projectId !== request.projectId ||
      request.protagonistCamera.projectId !== request.projectId) {
      throw new Error("story_director.project_mismatch");
    }
    const outline = this.story.listOutline(request.projectId);
    const frame = buildStoryCreativeFrameContext(outline, request.frameOutlineNodeId);
    const world = this.atlas.build({
      projectId: request.projectId,
      entityIds: [...new Set([...request.entityIds, request.protagonistCamera.protagonistEntityId])],
    });
    const packet = new StoryStatePacketBuilder(this.canon, this.state, this.story).build({
      projectId: request.projectId,
      audience: "author",
      targetOutlineNodeId: request.frameOutlineNodeId,
      focalEntityIds: request.entityIds,
    });
    const field = storyObjectFieldFromWorldContext({
      projectId: request.projectId,
      scale: "S04",
      storyTimeLabel: request.storyTimeLabel ?? frame.currentFrame.storyTime ?? null,
      realityFingerprint: sha256Hex(JSON.stringify(world.current)),
      storyStateFingerprint: packet.fingerprint,
      context: world,
    });
    const creativeContext = finalizeStoryCreativeContext({
      version: "story-creative-context.v1",
      authority: "speculative",
      projectId: request.projectId,
      frame,
      protagonistCamera: request.protagonistCamera,
      methodInvocations: [...(request.methodInvocations ?? [])],
      materialSelections: [...(request.materialSelections ?? [])],
    });
    const upgradeLedger = request.upgradeLedger ?? frame.inheritedState.latestUpgradeLedger;
    if (!upgradeLedger) throw new Error("story_director.missing_upgrade_ledger");
    let usage = emptyUsage();
    let expectationDesign = request.expectationDesign;
    if (!expectationDesign) {
      const evidence: ExpectationDesignEvidence[] = field.objects.flatMap((object) =>
        object.surfaces.map((surface) => ({
          ref: storyObjectSurfaceRef(object.id, surface),
          kind: surface.facet === "relationship" ? "relationship" as const
            : surface.facet === "ability" || surface.facet === "value" ? "resource" as const
            : surface.facet === "history" ? "history" as const
            : surface.facet === "rule" ? "rule" as const
            : surface.facet === "identity" ? "people" as const
            : "reality" as const,
          summary: `${object.name} / ${surface.facet} / ${surface.slotKey}: ${JSON.stringify(surface.value) ?? "null"}`,
          entityIds: [object.entityId],
        })),
      );
      const result = await this.expectations.designExpectation(run, step, {
        projectId: request.projectId,
        protagonistId: request.protagonistCamera.protagonistEntityId,
        readerNeed: request.readerNeed,
        targetEmotion: request.targetEmotion,
        realityFingerprint: field.realityFingerprint,
        storyStateFingerprint: field.storyStateFingerprint,
        evidence,
      }, signal);
      expectationDesign = result.value;
      usage = addUsage(usage, result.usage);
    }
    const designed = await this.authoring.designStoryUnit(run, step, {
      field,
      creativeContext,
      sourceSearch: null,
      sourceSeedIds: request.sourceSeedIds ?? [],
      expectationDesign,
      upgradeLedger,
      request: request.request,
    }, signal);
    usage = addUsage(usage, designed.usage);
    const storyUnit = designed.value;
    if (storyUnit.status === "BLOCKED_WORLD_GAP") {
      return {
        status: "BLOCKED_WORLD_GAP",
        field, creativeContext, expectationDesign, storyUnit,
        worldGaps: storyUnit.worldGaps,
        usage,
      };
    }
    return { status: "READY", field, creativeContext, expectationDesign, storyUnit, usage };
  }

  async rehearseAndBuildHandoff(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryDirectorRehearsalRequest,
    signal: AbortSignal,
  ): Promise<StoryDirectorRehearsalResult> {
    const { field, storyUnit } = request;
    if (storyUnit.status !== "READY" || run.projectId !== field.projectId ||
      request.expectationState.projectId !== field.projectId) {
      throw new Error("story_director.rehearsal_requires_ready_story_unit");
    }
    const worldContext = worldArbitrationContextFromStoryUnit(
      field, storyUnit, request.storyUnitEventId,
    );
    const event = storyUnit.events.find((item) => item.id === request.storyUnitEventId)!;
    const characterIds = request.activeSeedEntityIds
      ?? event.castPoolEntityIds.filter((id) => field.objects.some(
        (object) => object.entityId === id && object.kind === "character",
      ));
    if (characterIds.length === 0) throw new Error("story_director.no_active_characters");
    let usage = emptyUsage();
    let observations: CharacterObservationPacket[] = [];
    let proposals: CharacterActionProposal[] = [];
    let arbitration!: WorldArbitrationReceipt;
    const retries = Math.max(0, Math.trunc(request.maxConflictRetries ?? 1));
    let affected = new Set(characterIds);
    for (let round = 1; round <= retries + 1; round++) {
      const nextObservations: CharacterObservationPacket[] = [];
      const nextProposals: CharacterActionProposal[] = [];
      for (const characterId of characterIds) {
        const observation = this.observations.build({
          projectId: field.projectId,
          characterId,
          generationId: request.generationId,
          storyUnitDesign: storyUnit,
          worldContext,
          targetOutlineNodeId: request.targetOutlineNodeId ?? null,
          ...(request.stakeBeatByEntityId?.[characterId]
            ? { stakeBeat: request.stakeBeatByEntityId[characterId] }
            : {}),
          round,
        });
        nextObservations.push(observation);
        const old = proposals.find((item) => item.characterId === characterId);
        if (round > 1 && !affected.has(characterId) && old) {
          // The arbiter requires a uniform round; retain the unaffected decision.
          const { digest: _digest, ...draft } = old;
          void _digest;
          nextProposals.push(finalizeCharacterActionProposal({
            ...draft, round, observationDigest: observation.digest,
          }, observation));
        } else {
          const result = await this.runtime.proposeCharacterAction(run, step, observation, signal);
          nextProposals.push(result.value);
          usage = addUsage(usage, result.usage);
        }
      }
      observations = nextObservations;
      proposals = nextProposals;
      const result = await this.runtime.arbitrateWorld(run, step, {
        projectId: field.projectId,
        generationId: request.generationId,
        round,
        proposals,
        worldContext,
        ...(request.hardContracts ? { hardContracts: request.hardContracts } : {}),
        protagonistCharacterId: request.povEntityId,
      }, signal);
      arbitration = result.value;
      usage = addUsage(usage, result.usage);
      if (arbitration.finalized && arbitration.hardContractStatus === "feasible") break;
      affected = new Set(
        arbitration.conflicts.flatMap((conflict) => conflict.affectedAgentIds)
          .filter((id) => characterIds.some((characterId) => id === `character:${characterId}`))
          .map((id) => id.slice("character:".length)),
      );
      if (affected.size === 0) affected = new Set(characterIds);
    }
    if (!arbitration.finalized || arbitration.hardContractStatus !== "feasible") {
      return { status: "CONFLICT_BLOCKED", worldContext, observations, proposals, arbitration, usage };
    }
    const sceneResult = await this.scenes.expand(run, step, {
      storyUnit,
      storyUnitEventId: request.storyUnitEventId,
      arbitration,
      request: request.request,
    }, signal);
    usage = addUsage(usage, sceneResult.usage);
    const sceneExpansion = sceneResult.value;
    const readerTime = await this.expectations.allocateSceneReaderTime(run, step, {
      state: request.expectationState,
      sceneExpansion,
    }, signal);
    usage = addUsage(usage, readerTime.usage);
    const readerTimePlan = readerTime.value;
    const handoff = buildStoryChapterProductionHandoff({
      expansion: sceneExpansion,
      readerTimePlan,
      chapterTitle: request.chapterTitle,
      chapterGoal: request.chapterGoal,
      povEntityId: request.povEntityId,
      targetCharacters: request.targetCharacters,
    });
    return {
      status: "READY", worldContext, observations, proposals, arbitration,
      sceneExpansion, readerTimePlan, handoff, usage,
    };
  }

  adoptNodeHandoff(input: StoryDirectorAdoptionInput) {
    if (input.storyUnit.status !== "READY" || input.storyUnit.projectId !== input.handoff.projectId) {
      throw new Error("story_director.adoption_requires_ready_story_unit");
    }
    const chapter = stageStoryChapterProductionHandoff(
      this.story, input.chapterOutlineNodeId, input.handoff, input.updatedAt,
    );
    const creativeFrameState = storyCreativeFrameStateFromStoryUnit({
      frameOutlineNodeId: input.frameOutlineNodeId ?? input.chapterOutlineNodeId,
      storyUnit: input.storyUnit,
      ...(input.expectationState !== undefined
        ? { expectationState: input.expectationState }
        : {}),
      updatedAt: input.updatedAt,
    });
    const frame = stageStoryCreativeFrameState(this.story, creativeFrameState, input.updatedAt);
    return {
      chapter: input.frameOutlineNodeId && input.frameOutlineNodeId !== input.chapterOutlineNodeId
        ? chapter : frame,
      frame,
      creativeFrameState,
    };
  }
}
