import {
  CharacterObservationPacketDraftSchema,
  CharacterObservationPacketSchema,
  type CharacterObservationEvidence,
  type CharacterObservationPacket,
} from "@narralume/contracts";
import { sha256Hex } from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRealityRepository,
  SqliteStoryRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";

import { StoryStatePacketBuilder } from "./story-state-packet.js";

export interface CharacterObservationBuildRequest {
  projectId: string;
  characterId: string;
  generationId: string;
  currentGoal: string;
  pressure: string;
  round?: number;
  targetOutlineNodeId?: string | null;
  location?: string | null;
  resources?: readonly string[];
}

/**
 * Builds the subjective input for one autonomous character.
 *
 * The host may fingerprint omniscient Project Reality to invalidate stale
 * simulations, but the character-facing evidence itself comes only from the
 * character-filtered StoryState projection. This is the core safety boundary:
 * "the database knows" never means "this character knows".
 */
export class CharacterObservationBuilder {
  private readonly canon: SqliteCanonRepository;
  private readonly state: SqliteNarrativeStateRepository;
  private readonly story: SqliteStoryRepository;
  private readonly storyState: StoryStatePacketBuilder;
  private readonly reality: SqliteProjectRealityRepository;

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
    this.reality = new SqliteProjectRealityRepository(database);
  }

  build(request: CharacterObservationBuildRequest): CharacterObservationPacket {
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
    const reality = this.reality.getEntityReality(
      request.projectId,
      request.characterId,
    );

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

    const inferredLocation =
      request.location === undefined
        ? locationFromVisibleFacts(snapshot.facts)
        : request.location;
    const resources = normalizeStrings(request.resources ?? []);
    const sourceIds = normalizeStrings(
      packet.sources.map((source) => source.id),
    );

    const realityFingerprint = sha256Hex(
      stableJson({
        entity: {
          id: reality.entity.id,
          type: reality.entity.type,
          name: reality.entity.name,
          status: reality.entity.status,
        },
        slots: reality.effectiveSlots.map((slot) => ({
          facet: slot.facet,
          slotKey: slot.slotKey,
          value: slot.value,
          origin: slot.origin,
          revisionId: slot.revisionId,
          sourceCorpusId: slot.sourceCorpusId,
          sourceKey: slot.sourceKey,
        })),
      }),
    );

    const withoutDigest = CharacterObservationPacketDraftSchema.parse({
      version: "character-observation.v1",
      authority: "confirmed",
      projectId: request.projectId,
      generationId: request.generationId,
      round: request.round ?? 1,
      agentId: characterAgentId(request.characterId),
      characterId: request.characterId,
      characterName: character.name,
      targetOutlineNodeId: request.targetOutlineNodeId ?? null,
      currentGoal: request.currentGoal.trim(),
      pressure: request.pressure.trim(),
      location: inferredLocation,
      resources,
      relationships,
      knownFacts,
      perceivedEvents,
      memory,
      storyStateFingerprint: packet.fingerprint,
      realityFingerprint,
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
): string | null {
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
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
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
