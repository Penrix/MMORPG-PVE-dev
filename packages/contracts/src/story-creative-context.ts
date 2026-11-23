import { z } from "zod";

export const StoryCreativeFrameKindSchema = z.enum([
  "book",
  "volume",
  "arc",
  "chapter",
  "scene",
  "beat",
]);
export type StoryCreativeFrameKind = z.infer<typeof StoryCreativeFrameKindSchema>;

export const StoryCreativeFrameSnapshotSchema = z.object({
  outlineNodeId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  kind: StoryCreativeFrameKindSchema,
  ordinal: z.number().int().nonnegative(),
  title: z.string().min(1),
  summary: z.string().nullable(),
  goal: z.string().nullable(),
  conflict: z.string().nullable(),
  outcome: z.string().nullable(),
  storyTime: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type StoryCreativeFrameSnapshot = z.infer<
  typeof StoryCreativeFrameSnapshotSchema
>;

export const StoryCreativeFrameContextSchema = z.object({
  version: z.literal("story-creative-frame.v1"),
  projectId: z.string().min(1),
  targetOutlineNodeId: z.string().min(1),
  currentFrame: StoryCreativeFrameSnapshotSchema,
  parentFrames: z.array(StoryCreativeFrameSnapshotSchema),
  previousSiblingFrames: z.array(StoryCreativeFrameSnapshotSchema),
  digest: z.string().min(1),
});
export type StoryCreativeFrameContext = z.infer<
  typeof StoryCreativeFrameContextSchema
>;
export const StoryCreativeFrameContextDraftSchema =
  StoryCreativeFrameContextSchema.omit({ digest: true });
export type StoryCreativeFrameContextDraft = z.infer<
  typeof StoryCreativeFrameContextDraftSchema
>;

export const CreativeMethodScopeSchema = z.enum([
  "world",
  "protagonist_build",
  "ability",
  "resource",
  "relationship",
  "story",
  "scene",
  "combat",
  "information",
  "other",
]);
export type CreativeMethodScope = z.infer<typeof CreativeMethodScopeSchema>;

export const CreativeMethodInvocationSchema = z.object({
  id: z.string().min(1),
  methodFamily: z.string().min(1),
  methodId: z.string().min(1),
  sourceRef: z.string().min(1).nullable(),
  scope: CreativeMethodScopeSchema,
  purpose: z.string().min(1),
  inputObjectIds: z.array(z.string().min(1)),
  instruction: z.string().min(1),
});
export type CreativeMethodInvocation = z.infer<
  typeof CreativeMethodInvocationSchema
>;

export const StoryProtagonistCameraSchema = z.object({
  version: z.literal("story-protagonist-camera.v1"),
  projectId: z.string().min(1),
  protagonistEntityId: z.string().min(1),
  currentPosition: z.string().min(1),
  currentGoal: z.string().min(1),
  upgradeNeed: z.string().min(1),
  activeMove: z.string().min(1),
  focusObjectIds: z.array(z.string().min(1)),
  advantageRefs: z.array(z.string().min(1)),
});
export type StoryProtagonistCamera = z.infer<
  typeof StoryProtagonistCameraSchema
>;

export const StoryCreativeContextSchema = z.object({
  version: z.literal("story-creative-context.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  frame: StoryCreativeFrameContextSchema,
  protagonistCamera: StoryProtagonistCameraSchema,
  methodInvocations: z.array(CreativeMethodInvocationSchema),
  digest: z.string().min(1),
});
export type StoryCreativeContext = z.infer<typeof StoryCreativeContextSchema>;
export const StoryCreativeContextDraftSchema = StoryCreativeContextSchema.omit({
  digest: true,
});
export type StoryCreativeContextDraft = z.infer<
  typeof StoryCreativeContextDraftSchema
>;
