import {
  StoryAuthoringSearchDraftSchema,
  StoryAuthoringSearchSchema,
  StoryObjectFieldDraftSchema,
  StoryObjectFieldSchema,
  StoryUnitDesignDraftSchema,
  StoryUnitDesignSchema,
  type ExpectationDesign,
  type StoryAuthoringSearch,
  type StoryAuthoringSearchDraft,
  type StoryObjectField,
  type StoryObjectFieldDraft,
  type StoryUnitDesign,
  type StoryUnitDesignDraft,
} from "@narralume/contracts";
import { sha256Hex } from "@narralume/domain";
import type { WorldAtlasStoryContext } from "@narralume/persistence";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return sha256Hex(stableJson(value));
}

function requireUnique(label: string, values: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    if (set.has(value)) {
      throw new Error(`story_authoring.duplicate_${label}:${value}`);
    }
    set.add(value);
  }
  return set;
}

function requireRefs(
  label: string,
  refs: readonly string[],
  allowed: ReadonlySet<string>,
): void {
  for (const ref of refs) {
    if (!allowed.has(ref)) {
      throw new Error(`story_authoring.unknown_${label}:${ref}`);
    }
  }
}

export interface StoryObjectFieldFromWorldContextInput {
  projectId: string;
  scale: StoryObjectFieldDraft["scale"];
  storyTimeLabel: string | null;
  realityFingerprint: string;
  storyStateFingerprint: string;
  context: WorldAtlasStoryContext;
}

/**
 * Build the author-side imagination substrate from Module 2's existing
 * Project Reality / Source Atlas adapter. No new truth is created here.
 */
export function storyObjectFieldFromWorldContext(
  input: StoryObjectFieldFromWorldContextInput,
): StoryObjectField {
  const draft: StoryObjectFieldDraft = {
    version: "story-object-field.v1",
    authority: "speculative",
    projectId: input.projectId,
    scale: input.scale,
    storyTimeLabel: input.storyTimeLabel,
    realityFingerprint: input.realityFingerprint,
    storyStateFingerprint: input.storyStateFingerprint,
    objects: input.context.objects.map((object) => ({
      id: `object:${object.entityId}`,
      entityId: object.entityId,
      name: object.name,
      kind: object.kind,
      aliases: object.aliases,
      surfaces: object.surfaces,
      sourceRefs: object.sourceRefs,
    })),
  };
  return finalizeStoryObjectField(draft);
}

export function finalizeStoryObjectField(
  draft: StoryObjectFieldDraft,
): StoryObjectField {
  const parsed = StoryObjectFieldDraftSchema.parse(draft);
  if (parsed.objects.length === 0) {
    throw new Error("story_authoring.object_field.empty");
  }
  requireUnique(
    "object",
    parsed.objects.map((object) => object.id),
  );
  requireUnique(
    "entity",
    parsed.objects.map((object) => object.entityId),
  );
  for (const object of parsed.objects) {
    if (object.sourceRefs.length === 0 || object.surfaces.length === 0) {
      throw new Error(`story_authoring.object_without_surface:${object.id}`);
    }
    const sourceRefs = new Set(object.sourceRefs);
    for (const surface of object.surfaces) {
      if (!sourceRefs.has(surface.sourceId)) {
        throw new Error(
          `story_authoring.surface_without_source:${object.id}:${surface.sourceId}`,
        );
      }
    }
  }
  return StoryObjectFieldSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}

function validateScaleResult(
  draft: StoryAuthoringSearchDraft,
  allowedObjectIds: ReadonlySet<string>,
): void {
  if (draft.scaleResult.scale !== draft.scale) {
    throw new Error("story_authoring.scale_result_mismatch");
  }
  if (draft.scaleResult.scale === "S01") {
    for (const [index, concept] of draft.scaleResult.storyConcepts.entries()) {
      requireRefs(
        `s01_concept_${index}`,
        concept.objectIds,
        allowedObjectIds,
      );
    }
    for (const [index, engine] of draft.scaleResult.storyEngines.entries()) {
      requireRefs(
        `s01_engine_${index}`,
        engine.objectIds,
        allowedObjectIds,
      );
    }
    return;
  }
  if (draft.scaleResult.scale === "S02") {
    for (const [index, opportunity] of
      draft.scaleResult.stageOpportunities.entries()) {
      requireRefs(
        `s02_stage_${index}`,
        opportunity.objectIds,
        allowedObjectIds,
      );
    }
    return;
  }
  for (const [index, opportunity] of
    draft.scaleResult.opportunityField.entries()) {
    requireRefs(
      `s03_opportunity_${index}`,
      opportunity.objectIds,
      allowedObjectIds,
    );
  }
  for (const [index, movement] of
    draft.scaleResult.storyMovements.entries()) {
    requireRefs(
      `s03_movement_${index}`,
      movement.objectIds,
      allowedObjectIds,
    );
  }
}

export function finalizeStoryAuthoringSearch(
  draft: StoryAuthoringSearchDraft,
  field: StoryObjectField,
): StoryAuthoringSearch {
  const parsed = StoryAuthoringSearchDraftSchema.parse(draft);
  if (
    parsed.projectId !== field.projectId ||
    parsed.objectFieldDigest !== field.digest ||
    parsed.scale !== field.scale
  ) {
    throw new Error("story_authoring.search_not_bound_to_object_field");
  }
  if (parsed.scale === "S04") {
    throw new Error("story_authoring.s04_uses_story_unit_design");
  }

  const allowedObjectIds = new Set(field.objects.map((object) => object.id));
  requireUnique(
    "seed",
    parsed.seeds.map((seed) => seed.id),
  );
  for (const [index, focus] of parsed.objectFocus.entries()) {
    requireRefs(
      `object_focus_${index}`,
      [focus.objectId],
      allowedObjectIds,
    );
  }
  for (const [index, seed] of parsed.seeds.entries()) {
    requireRefs(
      `seed_anchor_${index}`,
      seed.anchorObjectIds,
      allowedObjectIds,
    );
  }
  validateScaleResult(parsed, allowedObjectIds);

  return StoryAuthoringSearchSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}

export interface StoryUnitRealityFocus {
  projectId: string;
  storyUnitDesignDigest: string;
  priorityEntityIds: readonly string[];
  firstEventCastPoolEntityIds: readonly string[];
  firstEventActiveSeedEntityIds: readonly string[];
}

/**
 * S04 is the writer's room. It designs the play and activation conditions, but
 * the Character Agent / Arbiter runtime still owns actual character choices.
 */
export function finalizeStoryUnitDesign(
  draft: StoryUnitDesignDraft,
  field: StoryObjectField,
  expectationDesign: ExpectationDesign,
  availableSeedIds: ReadonlySet<string> = new Set(),
): StoryUnitDesign {
  const parsed = StoryUnitDesignDraftSchema.parse(draft);
  if (
    parsed.projectId !== field.projectId ||
    parsed.projectId !== expectationDesign.projectId ||
    parsed.objectFieldDigest !== field.digest ||
    parsed.expectationDesignDigest !== expectationDesign.digest
  ) {
    throw new Error("story_authoring.story_unit_not_bound");
  }

  const objectIds = new Set(field.objects.map((object) => object.id));
  const entityIds = new Set(field.objects.map((object) => object.entityId));
  requireRefs("story_unit_object_anchor", parsed.objectAnchorIds, objectIds);
  if (availableSeedIds.size > 0) {
    requireRefs("story_unit_source_seed", parsed.sourceSeedIds, availableSeedIds);
  }

  const campEntityIds = requireUnique(
    "camp_entity",
    parsed.campNetwork.map((member) => member.entityId),
  );
  requireRefs(
    "camp_entity",
    parsed.campNetwork.map((member) => member.entityId),
    entityIds,
  );
  requireRefs(
    "reaction_target",
    parsed.reactionTargets.map((target) => target.entityId),
    campEntityIds,
  );
  requireRefs(
    "camp_transition",
    parsed.campTransitions.map((transition) => transition.entityId),
    campEntityIds,
  );
  requireRefs(
    "appearance_entity",
    parsed.appearanceOrderEntityIds,
    campEntityIds,
  );

  requireUnique(
    "story_event",
    parsed.events.map((event) => event.id),
  );
  for (const event of parsed.events) {
    requireRefs("event_cast", event.castPoolEntityIds, entityIds);
    const castPool = new Set(event.castPoolEntityIds);
    requireRefs("event_active_seed", event.activeSeedEntityIds, castPool);
  }

  return StoryUnitDesignSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}

export function realityFocusFromStoryUnitDesign(
  design: StoryUnitDesign,
): StoryUnitRealityFocus {
  const firstEvent = design.events[0]!;
  return {
    projectId: design.projectId,
    storyUnitDesignDigest: design.digest,
    priorityEntityIds: [
      ...new Set(design.events.flatMap((event) => event.castPoolEntityIds)),
    ],
    firstEventCastPoolEntityIds: [...firstEvent.castPoolEntityIds],
    firstEventActiveSeedEntityIds: [...firstEvent.activeSeedEntityIds],
  };
}
