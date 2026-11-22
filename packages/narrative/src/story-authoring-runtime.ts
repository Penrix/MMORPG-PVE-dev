import {
  StoryAuthoringSearchDraftSchema,
  StoryAuthoringSearchSchema,
  StoryObjectFieldDraftSchema,
  StoryObjectFieldSchema,
  StorySceneExpansionDraftSchema,
  StorySceneExpansionSchema,
  StoryUnitDesignDraftSchema,
  StoryUnitDesignSchema,
  type ExpectationDesign,
  type StoryAuthoringSearch,
  type StoryAuthoringSearchDraft,
  type StoryObjectField,
  type StoryObjectFieldDraft,
  type StorySceneExpansion,
  type StorySceneExpansionDraft,
  type StoryUnitDesign,
  type WorldArbitrationReceipt,
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

export function storyObjectSurfaceRef(
  objectId: string,
  surface: {
    sourceId: string;
    facet: string;
    slotKey: string;
    value: unknown;
  },
): string {
  return `surface:${sha256Hex(
    stableJson({
      objectId,
      sourceId: surface.sourceId,
      facet: surface.facet,
      slotKey: surface.slotKey,
      value: surface.value,
    }),
  )}`;
}

function allowedStorySurfaceRefs(field: StoryObjectField): Set<string> {
  return new Set(
    field.objects.flatMap((object) =>
      object.surfaces.map((surface) =>
        storyObjectSurfaceRef(object.id, surface),
      ),
    ),
  );
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
  if (input.context.projectId !== input.projectId) {
    throw new Error("story_authoring.world_context_project_mismatch");
  }
  const draft: StoryObjectFieldDraft = {
    version: "story-object-field.v1",
    authority: "speculative",
    projectId: input.projectId,
    scale: input.scale,
    storyTimeLabel: input.storyTimeLabel,
    realityFingerprint: input.realityFingerprint,
    storyStateFingerprint: input.storyStateFingerprint,
    objects: input.context.objects.map((object) => {
      const surfaces = object.surfaces.filter(
        (surface) =>
          input.scale === "S01" ||
          surface.authority === "confirmed" ||
          (surface.facet === "state" && surface.slotKey === "source_identity"),
      );
      return {
        id: `object:${object.entityId}`,
        entityId: object.entityId,
        name: object.name,
        kind: object.kind,
        aliases: object.aliases,
        surfaces,
        sourceRefs: [...new Set(surfaces.map((surface) => surface.sourceId))],
      };
    }),
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
      if (
        parsed.scale !== "S01" &&
        surface.authority === "reference" &&
        !(surface.facet === "state" && surface.slotKey === "source_identity")
      ) {
        throw new Error(
          `story_authoring.untimeboxed_reference_surface:${object.id}:${surface.facet}:${surface.slotKey}`,
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
    const conceptIds = requireUnique(
      "s01_concept",
      draft.scaleResult.storyConcepts.map((concept) => concept.id),
    );
    const engineIds = requireUnique(
      "s01_engine",
      draft.scaleResult.storyEngines.map((engine) => engine.id),
    );
    for (const [index, concept] of draft.scaleResult.storyConcepts.entries()) {
      requireRefs(`s01_concept_${index}`, concept.objectIds, allowedObjectIds);
    }
    for (const [index, engine] of draft.scaleResult.storyEngines.entries()) {
      requireRefs(`s01_engine_${index}`, engine.objectIds, allowedObjectIds);
    }
    for (const [
      index,
      link,
    ] of draft.scaleResult.conceptEngineLinks.entries()) {
      requireRefs(`s01_link_concept_${index}`, [link.conceptId], conceptIds);
      requireRefs(`s01_link_engine_${index}`, [link.engineId], engineIds);
    }
    return;
  }
  if (draft.scaleResult.scale === "S02") {
    for (const [
      index,
      opportunity,
    ] of draft.scaleResult.stageOpportunities.entries()) {
      requireRefs(
        `s02_stage_${index}`,
        opportunity.objectIds,
        allowedObjectIds,
      );
    }
    return;
  }
  for (const [
    index,
    opportunity,
  ] of draft.scaleResult.opportunityField.entries()) {
    requireRefs(
      `s03_opportunity_${index}`,
      opportunity.objectIds,
      allowedObjectIds,
    );
  }
  for (const [index, movement] of draft.scaleResult.storyMovements.entries()) {
    requireRefs(`s03_movement_${index}`, movement.objectIds, allowedObjectIds);
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
  const allowedObjectIds = new Set(field.objects.map((object) => object.id));
  const allowedSurfaceRefs = allowedStorySurfaceRefs(field);
  requireUnique(
    "world_gap",
    parsed.worldGaps.map((gap) => gap.id),
  );
  for (const [index, gap] of parsed.worldGaps.entries()) {
    requireRefs(
      `world_gap_anchor_${index}`,
      gap.anchorObjectIds,
      allowedObjectIds,
    );
  }
  requireUnique(
    "seed",
    parsed.seeds.map((seed) => seed.id),
  );
  if (parsed.status === "BLOCKED_WORLD_GAP") {
    if (parsed.worldGaps.length === 0) {
      throw new Error("story_authoring.blocked_without_world_gap");
    }
    if (parsed.seeds.length > 0) {
      throw new Error("story_authoring.blocked_search_has_seeds");
    }
  } else {
    if (parsed.seeds.length === 0) {
      throw new Error("story_authoring.ready_without_seed");
    }
    if (parsed.scaleResult.scale === "S01") {
      if (
        parsed.scaleResult.storyConcepts.length === 0 ||
        parsed.scaleResult.storyEngines.length === 0 ||
        parsed.scaleResult.conceptEngineLinks.length === 0
      ) {
        throw new Error("story_authoring.ready_s01_incomplete");
      }
    } else if (parsed.scaleResult.scale === "S02") {
      if (parsed.scaleResult.stageOpportunities.length === 0) {
        throw new Error("story_authoring.ready_s02_incomplete");
      }
    } else if (parsed.scaleResult.opportunityField.length === 0) {
      throw new Error("story_authoring.ready_s03_incomplete");
    }
  }
  for (const [index, focus] of parsed.objectFocus.entries()) {
    requireRefs(`object_focus_${index}`, [focus.objectId], allowedObjectIds);
    requireRefs(
      `object_focus_surface_${index}`,
      focus.surfaceRefs,
      allowedSurfaceRefs,
    );
  }
  for (const [index, seed] of parsed.seeds.entries()) {
    requireRefs(`seed_anchor_${index}`, seed.anchorObjectIds, allowedObjectIds);
    requireRefs(
      `seed_surface_${index}`,
      seed.groundingSurfaceRefs,
      allowedSurfaceRefs,
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
    field.scale !== "S04" ||
    parsed.projectId !== field.projectId ||
    parsed.projectId !== expectationDesign.projectId ||
    parsed.objectFieldDigest !== field.digest ||
    parsed.expectationDesignDigest !== expectationDesign.digest ||
    expectationDesign.realityFingerprint !== field.realityFingerprint ||
    expectationDesign.storyStateFingerprint !== field.storyStateFingerprint
  ) {
    throw new Error("story_authoring.story_unit_not_bound");
  }

  if (parsed.status === "BLOCKED_WORLD_GAP") {
    if (parsed.worldGaps.length === 0) {
      throw new Error("story_authoring.story_unit_blocked_without_world_gap");
    }
    if (parsed.events.length > 0) {
      throw new Error("story_authoring.blocked_story_unit_has_events");
    }
  } else if (
    parsed.objectAnchorIds.length === 0 ||
    parsed.groundingSurfaceRefs.length === 0 ||
    parsed.campNetwork.length === 0 ||
    parsed.events.length === 0
  ) {
    throw new Error("story_authoring.ready_story_unit_incomplete");
  }

  const objectIds = new Set(field.objects.map((object) => object.id));
  const entityIds = new Set(field.objects.map((object) => object.entityId));
  const surfaceRefs = allowedStorySurfaceRefs(field);
  if (!entityIds.has(parsed.upgradeLedger.protagonistEntityId)) {
    throw new Error("story_authoring.upgrade_protagonist_not_in_object_field");
  }
  const upgradeStepIds = requireUnique(
    "upgrade_step",
    parsed.upgradeLedger.steps.map((step) => step.id),
  );
  if (!upgradeStepIds.has(parsed.upgradeLedger.currentStepId)) {
    throw new Error("story_authoring.upgrade_current_step_unknown");
  }
  requireUnique(
    "story_unit_world_gap",
    parsed.worldGaps.map((gap) => gap.id),
  );
  for (const [index, gap] of parsed.worldGaps.entries()) {
    requireRefs(
      `story_unit_world_gap_anchor_${index}`,
      gap.anchorObjectIds,
      objectIds,
    );
  }
  requireUnique("story_unit_object_anchor", parsed.objectAnchorIds);
  requireRefs("story_unit_object_anchor", parsed.objectAnchorIds, objectIds);
  requireUnique("story_unit_surface", parsed.groundingSurfaceRefs);
  requireRefs("story_unit_surface", parsed.groundingSurfaceRefs, surfaceRefs);
  requireUnique("story_unit_source_seed", parsed.sourceSeedIds);
  if (parsed.sourceSeedIds.length > 0) {
    requireRefs(
      "story_unit_source_seed",
      parsed.sourceSeedIds,
      availableSeedIds,
    );
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
  if (!campEntityIds.has(parsed.upgradeLedger.protagonistEntityId)) {
    throw new Error("story_authoring.protagonist_not_in_camp_network");
  }

  const stakeEntryIds = requireUnique(
    "stake_entry",
    parsed.stakeLedger.map((entry) => entry.id),
  );
  requireRefs(
    "stake_entity",
    parsed.stakeLedger.map((entry) => entry.entityId),
    campEntityIds,
  );
  const stakeEntriesByEntity = new Map<string, string[]>();
  for (const entry of parsed.stakeLedger) {
    const ids = stakeEntriesByEntity.get(entry.entityId) ?? [];
    ids.push(entry.id);
    stakeEntriesByEntity.set(entry.entityId, ids);
  }
  for (const member of parsed.campNetwork) {
    if (
      member.entityId !== parsed.upgradeLedger.protagonistEntityId &&
      !stakeEntriesByEntity.has(member.entityId)
    ) {
      throw new Error(
        `story_authoring.camp_member_without_stake:${member.entityId}`,
      );
    }
  }

  requireRefs(
    "reaction_target",
    parsed.reactionTargets.map((target) => target.entityId),
    campEntityIds,
  );
  for (const target of parsed.reactionTargets) {
    if (!stakeEntriesByEntity.has(target.entityId)) {
      throw new Error(
        `story_authoring.reaction_target_without_stake:${target.entityId}`,
      );
    }
  }
  requireRefs(
    "camp_transition",
    parsed.campTransitions.map((transition) => transition.entityId),
    campEntityIds,
  );
  requireUnique("appearance_entity", parsed.appearanceOrderEntityIds);
  requireRefs(
    "appearance_entity",
    parsed.appearanceOrderEntityIds,
    campEntityIds,
  );

  const informationSteps = parsed.informationRelease.map((item) =>
    String(item.step),
  );
  const informationStepSet = requireUnique(
    "information_step",
    informationSteps,
  );
  for (let index = 1; index < parsed.informationRelease.length; index += 1) {
    if (
      parsed.informationRelease[index]!.step <=
      parsed.informationRelease[index - 1]!.step
    ) {
      throw new Error("story_authoring.information_steps_not_ascending");
    }
  }

  const reactionTargetEntityIds = new Set(
    parsed.reactionTargets.map((target) => target.entityId),
  );

  const campState = new Map(
    parsed.campNetwork.map((member) => [member.entityId, member.camp] as const),
  );
  for (const transition of parsed.campTransitions) {
    const current = campState.get(transition.entityId);
    if (current !== transition.from) {
      throw new Error(
        `story_authoring.camp_transition_from_mismatch:${transition.entityId}`,
      );
    }
    campState.set(transition.entityId, transition.to);
  }

  requireUnique(
    "story_event",
    parsed.events.map((event) => event.id),
  );
  for (const event of parsed.events) {
    requireUnique(`event_cast_${event.id}`, event.castPoolEntityIds);
    requireUnique(`event_active_seed_${event.id}`, event.activeSeedEntityIds);
    requireUnique(
      `event_pressure_${event.id}`,
      event.actorPressures.map((item) => item.entityId),
    );
    requireUnique(`event_stake_${event.id}`, event.stakeEntryIds);
    requireRefs("event_stake", event.stakeEntryIds, stakeEntryIds);
    requireRefs("event_cast", event.castPoolEntityIds, entityIds);
    const castPool = new Set(event.castPoolEntityIds);
    requireRefs("event_active_seed", event.activeSeedEntityIds, castPool);
    requireRefs(
      "event_pressure_actor",
      event.actorPressures.map((item) => item.entityId),
      castPool,
    );
    if (
      event.actorPressures.length !== event.castPoolEntityIds.length ||
      event.castPoolEntityIds.some(
        (entityId) =>
          !event.actorPressures.some((item) => item.entityId === entityId),
      )
    ) {
      throw new Error(
        `story_authoring.event_pressure_missing_cast_member:${event.id}`,
      );
    }
    for (const stakeId of event.stakeEntryIds) {
      const stake = parsed.stakeLedger.find((entry) => entry.id === stakeId);
      if (!stake || !castPool.has(stake.entityId)) {
        throw new Error(
          `story_authoring.event_stake_outside_cast:${event.id}:${stakeId}`,
        );
      }
    }

    requireUnique(
      `event_reaction_target_${event.id}`,
      event.reactionTargetEntityIds,
    );
    requireRefs(
      "event_reaction_target",
      event.reactionTargetEntityIds,
      reactionTargetEntityIds,
    );
    requireRefs(
      "event_reaction_target_cast",
      event.reactionTargetEntityIds,
      castPool,
    );
    for (const entityId of event.reactionTargetEntityIds) {
      const activeStakeIds = new Set(event.stakeEntryIds);
      const priced = (stakeEntriesByEntity.get(entityId) ?? []).some((id) =>
        activeStakeIds.has(id),
      );
      if (!priced) {
        throw new Error(
          `story_authoring.event_reaction_without_active_stake:${event.id}:${entityId}`,
        );
      }
    }

    requireUnique(
      `event_information_step_${event.id}`,
      event.informationReleaseSteps.map(String),
    );
    requireRefs(
      "event_information_step",
      event.informationReleaseSteps.map(String),
      informationStepSet,
    );

    const phaseNames = requireUnique(
      `event_phase_${event.id}`,
      event.phaseTargets.map((target) => target.phase),
    );
    if (phaseNames.size !== event.phaseTargets.length) {
      throw new Error(`story_authoring.duplicate_event_phase:${event.id}`);
    }
    for (const target of event.phaseTargets) {
      requireUnique(
        `event_phase_entity_${event.id}_${target.phase}`,
        target.entityIds,
      );
      requireRefs(
        `event_phase_entity_${event.id}_${target.phase}`,
        target.entityIds,
        castPool,
      );
    }
  }

  return StoryUnitDesignSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}

export function realityFocusFromStoryUnitDesign(
  design: StoryUnitDesign,
): StoryUnitRealityFocus {
  if (design.status !== "READY" || design.events.length === 0) {
    throw new Error("story_authoring.reality_focus_requires_ready_story_unit");
  }
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

/**
 * Finalize S06 scene expansion for one S05 Story Node.
 *
 * The arbitration receipt constrains what the characters actually did during
 * S05 rehearsal. S06 is still an author/director expansion: it turns one
 * problem-node into multiple scenes that keep pressure and expectation moving.
 */
export function finalizeStorySceneExpansion(
  draft: StorySceneExpansionDraft,
  storyUnit: StoryUnitDesign,
  arbitration: WorldArbitrationReceipt,
): StorySceneExpansion {
  const parsed = StorySceneExpansionDraftSchema.parse(draft);
  if (storyUnit.status !== "READY") {
    throw new Error("story_scene.requires_ready_story_unit");
  }
  const event = storyUnit.events.find(
    (item) => item.id === parsed.storyUnitEventId,
  );
  if (!event) {
    throw new Error(
      `story_scene.unknown_story_unit_event:${parsed.storyUnitEventId}`,
    );
  }
  if (
    parsed.projectId !== storyUnit.projectId ||
    parsed.storyUnitDesignDigest !== storyUnit.digest ||
    parsed.arbitrationDigest !== arbitration.digest ||
    parsed.realityFingerprint !== arbitration.realityFingerprint ||
    arbitration.projectId !== storyUnit.projectId ||
    arbitration.storyUnitDesignDigest !== storyUnit.digest ||
    arbitration.storyUnitEventId !== event.id
  ) {
    throw new Error("story_scene.not_bound_to_rehearsed_event");
  }
  if (!arbitration.finalized || arbitration.hardContractStatus !== "feasible") {
    throw new Error("story_scene.requires_feasible_finalized_rehearsal");
  }
  if (parsed.eventProblem !== event.problem) {
    throw new Error("story_scene.event_problem_mismatch");
  }

  requireUnique(
    "scene",
    parsed.scenes.map((scene) => scene.id),
  );
  requireUnique(
    "scene_order",
    parsed.scenes.map((scene) => String(scene.order)),
  );
  const castPool = new Set(event.castPoolEntityIds);
  const objectAnchors = new Set(storyUnit.objectAnchorIds);
  for (let index = 0; index < parsed.scenes.length; index += 1) {
    const scene = parsed.scenes[index]!;
    if (index > 0 && scene.order <= parsed.scenes[index - 1]!.order) {
      throw new Error("story_scene.order_not_ascending");
    }
    requireUnique(`scene_participant_${scene.id}`, scene.participantEntityIds);
    requireRefs(
      `scene_participant_${scene.id}`,
      scene.participantEntityIds,
      castPool,
    );
    if (
      scene.locationObjectId !== null &&
      !objectAnchors.has(scene.locationObjectId)
    ) {
      throw new Error(
        `story_scene.unknown_location_object:${scene.id}:${scene.locationObjectId}`,
      );
    }
    if (index < parsed.scenes.length - 1 && scene.nextSceneCause === null) {
      throw new Error(`story_scene.missing_next_scene_cause:${scene.id}`);
    }
  }

  for (const target of event.phaseTargets) {
    const matchingScenes = parsed.scenes.filter(
      (scene) => scene.phase === target.phase,
    );
    if (matchingScenes.length === 0) {
      throw new Error(
        `story_scene.missing_declared_phase:${event.id}:${target.phase}`,
      );
    }
    for (const entityId of target.entityIds) {
      if (
        !matchingScenes.some((scene) =>
          scene.participantEntityIds.includes(entityId),
        )
      ) {
        throw new Error(
          `story_scene.missing_phase_entity:${event.id}:${target.phase}:${entityId}`,
        );
      }
    }
  }

  return StorySceneExpansionSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}
