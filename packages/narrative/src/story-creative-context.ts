import {
  StoryCreativeContextDraftSchema,
  StoryCreativeContextSchema,
  StoryCreativeFrameContextDraftSchema,
  StoryCreativeFrameContextSchema,
  StoryCreativeFrameStateDraftSchema,
  StoryCreativeFrameStateSchema,
  type StoryCreativeContext,
  type StoryCreativeContextDraft,
  type StoryCreativeFrameContext,
  type StoryCreativeFrameContextDraft,
  type StoryCreativeFrameSnapshot,
  type StoryCreativeFrameState,
  type StoryCreativeFrameStateDraft,
  type ExpectationState,
  type StoryUnitDesign,
  type StoryObjectField,
  type StoryUpgradeLedger,
} from "@narralume/contracts";
import { sha256Hex, type OutlineNode } from "@narralume/domain";
import type { SqliteStoryRepository } from "@narralume/persistence";

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

export const CREATIVE_FRAME_STATE_METADATA_KEY = "mmorpgCreativeState";

function frameCreativeState(
  projectId: string,
  frame: StoryCreativeFrameSnapshot,
): StoryCreativeFrameState | null {
  const raw = frame.metadata[CREATIVE_FRAME_STATE_METADATA_KEY];
  if (raw === undefined) return null;
  const parsed = StoryCreativeFrameStateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `story_creative_frame.invalid_metadata_state:${frame.outlineNodeId}`,
    );
  }
  if (
    parsed.data.projectId !== projectId ||
    parsed.data.frameOutlineNodeId !== frame.outlineNodeId
  ) {
    throw new Error(
      `story_creative_frame.metadata_state_not_bound:${frame.outlineNodeId}`,
    );
  }
  return parsed.data;
}

function inheritedCreativeState(
  projectId: string,
  parentFrames: readonly StoryCreativeFrameSnapshot[],
  previousSiblingFrames: readonly StoryCreativeFrameSnapshot[],
) {
  const sourceStates = [...parentFrames, ...previousSiblingFrames].flatMap(
    (frame) => {
      const state = frameCreativeState(projectId, frame);
      return state ? [state] : [];
    },
  );
  const latest = sourceStates.at(-1) ?? null;
  return {
    sourceFrameIds: sourceStates.map((state) => state.frameOutlineNodeId),
    sourceStateDigests: sourceStates.map((state) => state.digest),
    sourceStates,
    latestUpgradeLedger: latest?.upgradeLedger ?? null,
    activeStakeLedger:
      latest?.stakeLedger.filter((entry) => entry.state !== "settled") ?? [],
    openExpectationThreads:
      latest?.expectationThreads.filter(
        (thread) => thread.phase !== "settled",
      ) ?? [],
    retainedAssets: latest?.retainedAssets ?? [],
    unresolvedQuestions: latest?.unresolvedQuestions ?? [],
  };
}

function snapshot(node: OutlineNode): StoryCreativeFrameSnapshot {
  return {
    outlineNodeId: node.id,
    parentId: node.parentId,
    kind: node.kind,
    ordinal: node.ordinal,
    title: node.title,
    summary: node.summary,
    goal: node.goal,
    conflict: node.conflict,
    outcome: node.outcome,
    storyTime: node.storyTime,
    metadata: { ...node.metadata },
  };
}

/**
 * Compile the fourth-generation S-framework semantics from NarraLume's
 * existing outline tree. This is a projection only: no parallel S database.
 *
 * The current frame reads:
 *   1) all parent frames, root -> immediate parent;
 *   2) earlier same-kind siblings under the same parent.
 */
export function buildStoryCreativeFrameContext(
  outline: readonly OutlineNode[],
  targetOutlineNodeId: string,
): StoryCreativeFrameContext {
  const byId = new Map(outline.map((node) => [node.id, node]));
  const target = byId.get(targetOutlineNodeId);
  if (!target) {
    throw new Error(
      `story_creative_frame.target_not_found:${targetOutlineNodeId}`,
    );
  }

  const parents: OutlineNode[] = [];
  let cursor = target.parentId ? byId.get(target.parentId) : undefined;
  while (cursor) {
    parents.push(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  parents.reverse();

  const previousSiblings = outline
    .filter(
      (node) =>
        node.projectId === target.projectId &&
        node.parentId === target.parentId &&
        node.kind === target.kind &&
        node.ordinal < target.ordinal &&
        node.status !== "abandoned",
    )
    .sort(
      (a, b) => a.ordinal - b.ordinal || a.createdAt.localeCompare(b.createdAt),
    );

  return finalizeStoryCreativeFrameContext({
    version: "story-creative-frame.v1",
    projectId: target.projectId,
    targetOutlineNodeId: target.id,
    currentFrame: snapshot(target),
    parentFrames: parents.map(snapshot),
    previousSiblingFrames: previousSiblings.map(snapshot),
  });
}

export function finalizeStoryCreativeFrameContext(
  draft: StoryCreativeFrameContextDraft,
): StoryCreativeFrameContext {
  const parsed = StoryCreativeFrameContextDraftSchema.parse(draft);
  if (
    parsed.currentFrame.outlineNodeId !== parsed.targetOutlineNodeId ||
    parsed.parentFrames.some(
      (frame) => frame.outlineNodeId === parsed.targetOutlineNodeId,
    ) ||
    parsed.previousSiblingFrames.some(
      (frame) => frame.outlineNodeId === parsed.targetOutlineNodeId,
    )
  ) {
    throw new Error("story_creative_frame.invalid_projection");
  }

  if (parsed.parentFrames.length === 0) {
    if (parsed.currentFrame.parentId !== null) {
      throw new Error("story_creative_frame.missing_parent_chain");
    }
  } else {
    for (let index = 0; index < parsed.parentFrames.length; index += 1) {
      const frame = parsed.parentFrames[index]!;
      const expectedParentId =
        index === 0 ? null : parsed.parentFrames[index - 1]!.outlineNodeId;
      if (frame.parentId !== expectedParentId) {
        throw new Error("story_creative_frame.invalid_parent_chain");
      }
    }
    if (
      parsed.currentFrame.parentId !== parsed.parentFrames.at(-1)!.outlineNodeId
    ) {
      throw new Error("story_creative_frame.current_parent_mismatch");
    }
  }

  const siblingIds = new Set<string>();
  let previousOrdinal = -1;
  for (const frame of parsed.previousSiblingFrames) {
    if (
      frame.parentId !== parsed.currentFrame.parentId ||
      frame.kind !== parsed.currentFrame.kind ||
      frame.ordinal >= parsed.currentFrame.ordinal
    ) {
      throw new Error("story_creative_frame.invalid_previous_sibling");
    }
    if (siblingIds.has(frame.outlineNodeId)) {
      throw new Error("story_creative_frame.duplicate_previous_sibling");
    }
    siblingIds.add(frame.outlineNodeId);
    if (frame.ordinal < previousOrdinal) {
      throw new Error("story_creative_frame.previous_siblings_out_of_order");
    }
    previousOrdinal = frame.ordinal;
  }

  const withInheritedState = {
    ...parsed,
    inheritedState: inheritedCreativeState(
      parsed.projectId,
      parsed.parentFrames,
      parsed.previousSiblingFrames,
    ),
  };
  return StoryCreativeFrameContextSchema.parse({
    ...withInheritedState,
    digest: digest(withInheritedState),
  });
}

export function finalizeStoryCreativeContext(
  draft: StoryCreativeContextDraft,
): StoryCreativeContext {
  const parsed = StoryCreativeContextDraftSchema.parse(draft);
  if (
    parsed.frame.projectId !== parsed.projectId ||
    parsed.protagonistCamera.projectId !== parsed.projectId
  ) {
    throw new Error("story_creative_context.project_mismatch");
  }

  if (
    !parsed.protagonistCamera.focusObjectIds.some((id) => id.trim().length > 0)
  ) {
    throw new Error("story_creative_context.empty_camera_focus");
  }

  const invocationIds = new Set<string>();
  for (const invocation of parsed.methodInvocations) {
    if (invocationIds.has(invocation.id)) {
      throw new Error(
        `story_creative_context.duplicate_method_invocation:${invocation.id}`,
      );
    }
    invocationIds.add(invocation.id);
  }

  return StoryCreativeContextSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}

/**
 * Bind creative state to the concrete Module-2 object field and the same
 * protagonist upgrade ledger. M methods may think with world objects, but may
 * not smuggle in objects outside the current field.
 */
export function assertStoryCreativeContextBound(
  context: StoryCreativeContext,
  field: StoryObjectField,
  upgradeLedger: StoryUpgradeLedger,
): void {
  if (
    context.projectId !== field.projectId ||
    context.protagonistCamera.protagonistEntityId !==
      upgradeLedger.protagonistEntityId
  ) {
    throw new Error("story_creative_context.not_bound");
  }

  const allowedObjectIds = new Set(field.objects.map((object) => object.id));
  const protagonistObject = field.objects.find(
    (object) =>
      object.entityId === context.protagonistCamera.protagonistEntityId,
  );
  if (!protagonistObject) {
    throw new Error("story_creative_context.protagonist_not_in_object_field");
  }
  if (
    !context.protagonistCamera.focusObjectIds.includes(protagonistObject.id)
  ) {
    throw new Error("story_creative_context.protagonist_not_in_camera_focus");
  }

  for (const objectId of context.protagonistCamera.focusObjectIds) {
    if (!allowedObjectIds.has(objectId)) {
      throw new Error(
        `story_creative_context.unknown_camera_object:${objectId}`,
      );
    }
  }
  for (const invocation of context.methodInvocations) {
    for (const objectId of invocation.inputObjectIds) {
      if (!allowedObjectIds.has(objectId)) {
        throw new Error(
          `story_creative_context.unknown_method_object:${invocation.id}:${objectId}`,
        );
      }
    }
  }
}

export function finalizeStoryCreativeFrameState(
  draft: StoryCreativeFrameStateDraft,
): StoryCreativeFrameState {
  const parsed = StoryCreativeFrameStateDraftSchema.parse(draft);
  const stakeIds = new Set<string>();
  for (const entry of parsed.stakeLedger) {
    if (stakeIds.has(entry.id)) {
      throw new Error(`story_creative_frame_state.duplicate_stake:${entry.id}`);
    }
    stakeIds.add(entry.id);
  }
  const threadIds = new Set<string>();
  for (const thread of parsed.expectationThreads) {
    if (threadIds.has(thread.id)) {
      throw new Error(
        `story_creative_frame_state.duplicate_expectation:${thread.id}`,
      );
    }
    threadIds.add(thread.id);
  }
  const sourceStoryUnitDigests = [...new Set(parsed.sourceStoryUnitDigests)];
  return StoryCreativeFrameStateSchema.parse({
    ...parsed,
    sourceStoryUnitDigests,
    retainedAssets: [...new Set(parsed.retainedAssets)],
    unresolvedQuestions: [...new Set(parsed.unresolvedQuestions)],
    digest: digest({
      ...parsed,
      sourceStoryUnitDigests,
      retainedAssets: [...new Set(parsed.retainedAssets)],
      unresolvedQuestions: [...new Set(parsed.unresolvedQuestions)],
    }),
  });
}

export interface StoryCreativeFrameStateFromStoryUnitInput {
  frameOutlineNodeId: string;
  storyUnit: StoryUnitDesign;
  expectationState?: ExpectationState | null;
  status?: StoryCreativeFrameState["status"];
  retainedAssets?: readonly string[];
  unresolvedQuestions?: readonly string[];
  realityFingerprint?: string | null;
  updatedAt: string;
}

/**
 * Build a complete creative-state snapshot for one S frame.
 *
 * This is author memory, not Project Reality. Callers should carry forward all
 * still-active stakes / expectations they want the next frame to inherit.
 */
export function storyCreativeFrameStateFromStoryUnit(
  input: StoryCreativeFrameStateFromStoryUnitInput,
): StoryCreativeFrameState {
  if (
    input.expectationState &&
    input.expectationState.projectId !== input.storyUnit.projectId
  ) {
    throw new Error("story_creative_frame_state.expectation_project_mismatch");
  }
  return finalizeStoryCreativeFrameState({
    version: "story-creative-frame-state.v1",
    authority: "creative-state",
    projectId: input.storyUnit.projectId,
    frameOutlineNodeId: input.frameOutlineNodeId,
    status: input.status ?? "in_progress",
    upgradeLedger: input.storyUnit.upgradeLedger,
    stakeLedger: input.storyUnit.stakeLedger,
    expectationThreads:
      input.expectationState?.threads.map((thread) => ({
        id: thread.id,
        targetEmotion: thread.targetEmotion,
        targetOutcome: thread.targetOutcome,
        readerKnowledgeSummary: thread.readerKnowledgeSummary,
        payoffCondition: thread.payoffCondition,
        reactionTargetEntityIds: thread.reactionTargetEntityIds,
        retainedGainTarget: thread.retainedGainTarget,
        phase: thread.phase,
      })) ?? [],
    retainedAssets: [...(input.retainedAssets ?? [])],
    unresolvedQuestions: [...(input.unresolvedQuestions ?? [])],
    sourceStoryUnitDigests: [input.storyUnit.digest],
    realityFingerprint:
      input.realityFingerprint ??
      input.expectationState?.realityFingerprint ??
      null,
    updatedAt: input.updatedAt,
  });
}

/**
 * Persist the creative-state snapshot in the existing outline metadata.
 * No database migration and no second Canon/Reality store are introduced.
 */
export function stageStoryCreativeFrameState(
  story: SqliteStoryRepository,
  state: StoryCreativeFrameState,
  updatedAt: string,
): OutlineNode {
  const frame = story.requireOutlineNode(
    state.projectId,
    state.frameOutlineNodeId,
  );
  return story.updateOutlineDetails(
    state.projectId,
    state.frameOutlineNodeId,
    {
      metadata: {
        ...frame.metadata,
        [CREATIVE_FRAME_STATE_METADATA_KEY]: state,
      },
    },
    updatedAt,
  );
}
