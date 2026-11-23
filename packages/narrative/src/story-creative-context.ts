import {
  StoryCreativeContextDraftSchema,
  StoryCreativeContextSchema,
  StoryCreativeFrameContextDraftSchema,
  StoryCreativeFrameContextSchema,
  type StoryCreativeContext,
  type StoryCreativeContextDraft,
  type StoryCreativeFrameContext,
  type StoryCreativeFrameContextDraft,
  type StoryCreativeFrameSnapshot,
  type StoryObjectField,
  type StoryUpgradeLedger,
} from "@narralume/contracts";
import { sha256Hex, type OutlineNode } from "@narralume/domain";

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

  return StoryCreativeFrameContextSchema.parse({
    ...parsed,
    digest: digest(parsed),
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
