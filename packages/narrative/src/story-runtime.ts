import {
  CharacterObservationPacketDraftSchema,
  CharacterObservationPacketSchema,
  WorldArbitrationContextDraftSchema,
  WorldArbitrationContextSchema,
  type CharacterObservationEvidence,
  type CharacterObservationPacket,
  type StoryObjectField,
  type StoryUnitDesign,
  type WorldArbitrationContext,
} from "@narralume/contracts";
import { sha256Hex } from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteStoryRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";

import { StoryStatePacketBuilder } from "./story-state-packet.js";

export function worldArbitrationContextFromStoryUnit(
  field: StoryObjectField,
  design: StoryUnitDesign,
  eventId: string,
): WorldArbitrationContext {
  if (
    field.scale !== "S04" ||
    design.status !== "READY" ||
    design.projectId !== field.projectId ||
    design.objectFieldDigest !== field.digest
  ) {
    throw new Error("story_runtime.world_context.story_unit_not_bound");
  }
  const event = design.events.find((candidate) => candidate.id === eventId);
  if (!event) {
    throw new Error(`story_runtime.world_context.unknown_event:${eventId}`);
  }

  const anchorObjectIds = new Set(design.objectAnchorIds);
  const castEntityIds = new Set(event.castPoolEntityIds);
  const surfaces = field.objects.flatMap((object) => {
    if (
      !anchorObjectIds.has(object.id) &&
      !castEntityIds.has(object.entityId)
    ) {
      return [];
    }
    return object.surfaces.flatMap((surface) =>
      surface.authority === "confirmed"
        ? [
            {
              entityId: object.entityId,
              name: object.name,
              kind: object.kind,
              facet: surface.facet,
              slotKey: surface.slotKey,
              value: surface.value,
              sourceId: surface.sourceId,
            },
          ]
        : [],
    );
  });
  if (surfaces.length === 0) {
    throw new Error("story_runtime.world_context.no_confirmed_surfaces");
  }

  const draft = WorldArbitrationContextDraftSchema.parse({
    version: "world-arbitration-context.v1",
    authority: "speculative",
    projectId: field.projectId,
    storyUnitDesignDigest: design.digest,
    storyUnitEventId: event.id,
    realityFingerprint: field.realityFingerprint,
    surfaces,
  });
  return WorldArbitrationContextSchema.parse({
    ...draft,
    digest: sha256Hex(stableJson(draft)),
  });
}

export interface CharacterObservationBuildRequest {
  projectId: string;
  characterId: string;
  generationId: string;
  storyUnitDesign: StoryUnitDesign;
  worldContext: WorldArbitrationContext;
  goalEvidenceRefs?: readonly string[];
  stakeBeat?: "stake" | "escalate" | "payoff";
  round?: number;
  targetOutlineNodeId?: string | null;
  resourceEvidenceRefs?: readonly string[];
}

/**
 * Builds one character-facing execution packet inside an authored Story Node.
 *
 * The writer/director already owns the story function and stake direction.
 * This builder keeps character knowledge subjective so the concrete performance
 * still follows characterization and visible Reality: "the database knows"
 * never means "this character knows".
 */
export class CharacterObservationBuilder {
  private readonly canon: SqliteCanonRepository;
  private readonly state: SqliteNarrativeStateRepository;
  private readonly story: SqliteStoryRepository;
  private readonly storyState: StoryStatePacketBuilder;

  constructor(database: NarrativeDatabase) {
    this.canon = new SqliteCanonRepository(database);
    this.story = new SqliteStoryRepository(database);
    this.state = new SqliteNarrativeStateRepository(
      database,
      this.canon,
      this.story,
    );
    this.storyState = new StoryStatePacketBuilder(
      this.canon,
      this.state,
      this.story,
    );
  }

  build(request: CharacterObservationBuildRequest): CharacterObservationPacket {
    const design = request.storyUnitDesign;
    const worldContext = request.worldContext;
    if (
      design.status !== "READY" ||
      design.projectId !== request.projectId ||
      worldContext.projectId !== request.projectId ||
      worldContext.storyUnitDesignDigest !== design.digest
    ) {
      throw new Error("story_runtime.observation.story_unit_not_bound");
    }
    const event = design.events.find(
      (candidate) => candidate.id === worldContext.storyUnitEventId,
    );
    if (!event || !event.castPoolEntityIds.includes(request.characterId)) {
      throw new Error(
        `story_runtime.observation.character_not_in_event_cast:${request.characterId}`,
      );
    }
    const actorPressure = event.actorPressures.find(
      (item) => item.entityId === request.characterId,
    );
    if (!actorPressure) {
      throw new Error(
        `story_runtime.observation.missing_actor_pressure:${request.characterId}`,
      );
    }
    const campMember = design.campNetwork.find(
      (member) => member.entityId === request.characterId,
    );
    if (!campMember) {
      throw new Error(
        `story_runtime.observation.character_not_in_authored_line:${request.characterId}`,
      );
    }
    const activeStakeIds = new Set(event.stakeEntryIds);
    const authoredStakes = design.stakeLedger.filter(
      (entry) =>
        entry.entityId === request.characterId && activeStakeIds.has(entry.id),
    );
    const isPayoff = event.reactionTargetEntityIds.includes(
      request.characterId,
    );
    const isEscalated = authoredStakes.some((entry) =>
      ["escalated", "escalating"].includes(entry.state),
    );
    let stakeBeat: "stake" | "escalate" | "payoff" = "stake";
    if (request.stakeBeat) {
      stakeBeat = request.stakeBeat;
    } else if (isPayoff) {
      stakeBeat = "payoff";
    } else if (isEscalated) {
      stakeBeat = "escalate";
    }
    const authoredDirection = [
      `storyRole=${campMember.storyRole}`,
      `belief=${campMember.currentBelief}`,
      `interest=${campMember.currentInterest}`,
      `nodePurpose=${event.purpose}`,
      ...authoredStakes.map((entry) =>
        stakeBeat === "payoff"
          ? `stake=${entry.stakeAction}; escalation=${entry.escalationPlan}; payoff=${entry.payoffReaction}`
          : stakeBeat === "escalate"
            ? `stake=${entry.stakeAction}; escalation=${entry.escalationPlan}; cost=${entry.commitmentCost}`
            : `stake=${entry.stakeAction}; cost=${entry.commitmentCost}`,
      ),
    ].join(" ; ");

    const character = this.canon.requireEntity(
      request.projectId,
      request.characterId,
    );
    if (character.type !== "character") {
      throw new Error("story_runtime.observation.entity_not_character");
    }

    const target =
      request.targetOutlineNodeId === null ||
      request.targetOutlineNodeId === undefined
        ? {}
        : { targetOutlineNodeId: request.targetOutlineNodeId };
    const stateRequest = {
      projectId: request.projectId,
      audience: "character" as const,
      characterId: request.characterId,
      ...target,
    };
    const snapshot = this.storyState.snapshot(stateRequest);
    const packet = this.storyState.build({
      ...stateRequest,
      focalEntityIds: [request.characterId],
    });
    const knownFacts: CharacterObservationEvidence[] = snapshot.facts.map(
      (fact) =>
        evidence({
          id: fact.id,
          kind: "fact",
          text: [
            fact.subjectId,
            fact.predicate,
            fact.objectEntityId ?? stringifyValue(fact.value),
          ]
            .filter(Boolean)
            .join(" | "),
          sourceType: fact.sourceType || "canon_fact",
          visibility: fact.knowledgeScope ?? null,
        }),
    );

    const relationships: CharacterObservationEvidence[] = snapshot.relationships
      .filter(
        (item) =>
          item.fromEntityId === request.characterId ||
          item.toEntityId === request.characterId,
      )
      .map((item) =>
        evidence({
          id: item.id,
          kind: "relationship",
          text: [
            item.fromEntityId,
            item.relation,
            item.toEntityId,
            `intensity=${item.intensity}`,
          ].join(" | "),
          sourceType: "relationship_event",
        }),
      );

    const perceivedEvents: CharacterObservationEvidence[] =
      snapshot.timeline.map((item) =>
        evidence({
          id: item.id,
          kind: "event",
          text: [
            item.title,
            item.description,
            item.storyTimeStart ? `storyTime=${item.storyTimeStart}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          sourceType: "timeline_event",
          visibility: item.visibility,
        }),
      );

    const memory: CharacterObservationEvidence[] = snapshot.knowledge.map(
      (item) => {
        const targetId =
          item.record.factId ?? item.record.timelineEventId ?? "unknown";
        return evidence({
          id: item.record.id,
          kind: "memory",
          text: [
            `belief=${item.record.belief}`,
            `target=${targetId}`,
            item.fact
              ? `fact=${item.fact.predicate}:${stringifyValue(
                  item.fact.objectEntityId ?? item.fact.value,
                )}`
              : null,
            item.event ? `event=${item.event.title}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          sourceType: "knowledge_record",
        });
      },
    );

    const visibleEvidence = new Map(
      [...knownFacts, ...relationships, ...perceivedEvents, ...memory].map(
        (item) => [item.id, item] as const,
      ),
    );
    const goalEvidenceRefs = normalizeStrings(request.goalEvidenceRefs ?? []);
    if (goalEvidenceRefs.length === 0) {
      const baselineId = `camp-baseline:${character.id}`;
      const baseline = evidence({
        id: baselineId,
        kind: "fact",
        text: `character=${character.name} | belief=${campMember.currentBelief} | goal=${campMember.currentGoal}`,
        sourceType: "authored_camp_baseline",
      });
      knownFacts.push(baseline);
      visibleEvidence.set(baselineId, baseline);
      goalEvidenceRefs.push(baselineId);
    }
    for (const ref of goalEvidenceRefs) {
      if (!visibleEvidence.has(ref)) {
        throw new Error(
          `story_runtime.observation.goal_evidence_not_visible:${ref}`,
        );
      }
    }
    const currentGoal = goalEvidenceRefs
      .map((ref) => visibleEvidence.get(ref)!.text)
      .join(" ; ");

    const resources = normalizeStrings(request.resourceEvidenceRefs ?? []);
    for (const ref of resources) {
      if (!visibleEvidence.has(ref)) {
        throw new Error(
          `story_runtime.observation.resource_evidence_not_visible:${ref}`,
        );
      }
    }

    const inferredLocation = locationFromVisibleFacts(snapshot.facts);
    const sourceIds = normalizeStrings(
      packet.sources.map((source) => source.id),
    );

    const withoutDigest = CharacterObservationPacketDraftSchema.parse({
      version: "character-observation.v1",
      authority: "speculative",
      projectId: request.projectId,
      generationId: request.generationId,
      round: request.round ?? 1,
      storyUnitDesignDigest: design.digest,
      storyUnitEventId: event.id,
      agentId: characterAgentId(request.characterId),
      characterId: request.characterId,
      characterName: character.name,
      targetOutlineNodeId: request.targetOutlineNodeId ?? null,
      currentGoal,
      goalEvidenceRefs,
      pressure: actorPressure.pressure.trim(),
      authoredStoryFunction: campMember.storyRole,
      authoredStakeIds: authoredStakes.map((entry) => entry.id),
      authoredDirection,
      location: inferredLocation.value,
      locationEvidenceRefs: inferredLocation.evidenceRefs,
      resources,
      relationships,
      knownFacts,
      perceivedEvents,
      memory,
      storyStateFingerprint: packet.fingerprint,
      realityFingerprint: worldContext.realityFingerprint,
      sourceIds,
    });

    return CharacterObservationPacketSchema.parse({
      ...withoutDigest,
      digest: sha256Hex(stableJson(withoutDigest)),
    });
  }
}

export function characterAgentId(characterId: string): string {
  const id = characterId.trim();
  if (!id) throw new Error("story_runtime.agent.character_id_empty");
  return `character:${id}`;
}

function locationFromVisibleFacts(
  facts: ReturnType<StoryStatePacketBuilder["snapshot"]>["facts"],
): { value: string | null; evidenceRefs: string[] } {
  const predicates = new Set([
    "location",
    "current_location",
    "currentlocation",
    "当前位置",
    "所在地",
    "位于",
  ]);
  for (const fact of [...facts].reverse()) {
    if (!predicates.has(fact.predicate.toLowerCase())) continue;
    const value = fact.objectEntityId ?? fact.value;
    if (typeof value === "string" && value.trim()) {
      return { value: value.trim(), evidenceRefs: [fact.id] };
    }
  }
  return { value: null, evidenceRefs: [] };
}

function evidence(input: {
  id: string;
  kind: CharacterObservationEvidence["kind"];
  text: string;
  sourceType: string;
  visibility?: string | null;
}): CharacterObservationEvidence {
  return {
    id: input.id,
    kind: input.kind,
    text: input.text,
    sourceType: input.sourceType,
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
  };
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? "null";
}

function normalizeStrings(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
