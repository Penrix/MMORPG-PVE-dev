import type { CanonEntity, TimelineEvent } from "@narralume/domain";

import { deriveBeliefs } from "./vendor/sneq/core/derive-beliefs.js";
import type { NarrativeEvent } from "./vendor/sneq/domain/event.js";
import type {
  GroupHolder,
  IndividualHolder,
} from "./vendor/sneq/domain/holder.js";
import type {
  CampaignId,
  EntityID,
  EventId,
  HolderId,
} from "./vendor/sneq/domain/ids.js";

/**
 * SNEQ adapter: its upstream pure belief projection runs on NarraLume's
 * accepted timeline. Event participation yields WITNESSED knowledge; a
 * non-participant is never given omniscient knowledge by this projection.
 *
 * NarraLume owns Canon and explicit knowledge_records. This function does
 * not create a second truth store, infer unrecorded rumors, or fabricate
 * media dispatches. Timeline.sequence is a strictly ordered relative
 * projection coordinate, not a claimed real-world number of days.
 */
export function projectNpcWitnessedEvents(input: {
  projectId: string;
  characters: readonly CanonEntity[];
  timeline: readonly TimelineEvent[];
  maxCharacters?: number;
  maxEventsPerCharacter?: number;
}): Array<{
  entityId: string;
  events: Array<{
    timelineEventId: string;
    circumstance: string;
    salience: number;
    learnedAtSequence: number;
  }>;
}> {
  const campaignId = input.projectId as CampaignId;
  const groupId = `${input.projectId}:witness-default` as HolderId;
  const placeId = `${input.projectId}:witness-place` as EntityID;
  const characters = input.characters
    .filter(
      (entity) => entity.type === "character" && entity.status === "active",
    )
    .slice(0, input.maxCharacters ?? 24);
  const group: GroupHolder = {
    kind: "GROUP",
    holderId: groupId,
    campaignId,
    community: "world-witness-projection",
    stratum: "unassigned",
    realmId: placeId,
    placeId,
    standing: 0,
  };
  const holders: Array<GroupHolder | IndividualHolder> = [
    group,
    ...characters.map((entity): IndividualHolder => ({
      kind: "INDIVIDUAL",
      holderId: entity.id as HolderId,
      campaignId,
      entityId: entity.id as EntityID,
      baseGroupId: groupId,
      derogationReason: "PARTICIPANT",
    })),
  ];
  const timeline = [...input.timeline].sort((a, b) => a.sequence - b.sequence);
  const events: NarrativeEvent[] = timeline.map((event) => ({
    eventId: event.id as EventId,
    campaignId,
    day: event.sequence,
    turn: event.sequence,
    gravity: event.causes.length ? 2 : 1,
    acts: [],
    circumstance: event.description ?? event.title,
    participants: [...event.participants] as EntityID[],
    surfaceTokens: [],
  }));
  const latest = timeline.at(-1)?.sequence ?? 0;
  const world = {
    events,
    records: [],
    carriages: [],
    carriageEffects: [],
    holders,
    defaultGroupId: groupId,
  };
  return characters.map((entity) => ({
    entityId: entity.id,
    events: deriveBeliefs(world, entity.id as HolderId, latest)
      .filter((belief) => belief.subject.kind === "EVENT")
      .slice(0, input.maxEventsPerCharacter ?? 16)
      .map((belief) => ({
        timelineEventId: belief.subject.id,
        circumstance: belief.content,
        salience: belief.salience,
        learnedAtSequence: belief.learnedOnDay,
      })),
  }));
}
