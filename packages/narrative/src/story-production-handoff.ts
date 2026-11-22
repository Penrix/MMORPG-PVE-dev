import { createHash } from "node:crypto";

import type {
  ReaderTimeAllocation,
  StoryReaderTimePlan,
  StoryReaderTimeSceneDecision,
  StorySceneExpansion,
  StoryScenePlan as AuthoredStoryScenePlan,
} from "@narralume/contracts";
import type { SqliteStoryRepository } from "@narralume/persistence";
import { z } from "zod";

import { ScenePlanSchema, type ScenePlan } from "./schemas.js";

const StoryProductionDirectiveSchema = z.object({
  sceneId: z.string().min(1),
  readerOrder: z.number().int().positive(),
  action: z.enum(["background", "seed", "charge", "payoff"]),
  readerTime: z.enum(["mention", "beat", "scene", "chapter"]),
  expectationThreadIds: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1)).min(1),
  embodimentTargets: z.array(z.string().min(1)),
  payoffThreadIds: z.array(z.string().min(1)),
  reactionTargetEntityIds: z.array(z.string().min(1)),
  retainedGainOpportunity: z.string().min(1).nullable(),
  informationReleased: z.string().min(1),
  informationWithheld: z.string().min(1),
  focusShiftThreadIds: z.array(z.string().min(1)),
  nextExpectationSeed: z.string().min(1).nullable(),
  chapterBoundary: z.enum(["continue", "soft_cut", "chapter_end"]),
});

export const StoryChapterProductionHandoffSchema = z.object({
  version: z.literal("story-chapter-production-handoff.v1"),
  authority: z.literal("locked-story-design"),
  projectId: z.string().min(1),
  storySceneExpansionDigest: z.string().min(1),
  storyReaderTimePlanDigest: z.string().min(1),
  realityFingerprint: z.string().min(1),
  chapterTitle: z.string().min(1),
  chapterGoal: z.string().min(1),
  povEntityId: z.string().min(1).nullable(),
  plannedEntityIds: z.array(z.string().min(1)).min(1),
  targetCharacters: z.number().int().min(200),
  sourceSceneIds: z.array(z.string().min(1)).min(1),
  lockedScenePlan: ScenePlanSchema,
  readerTimeDirectives: z.array(StoryProductionDirectiveSchema).min(1),
  digest: z.string().min(1),
});
export type StoryChapterProductionHandoff = z.infer<
  typeof StoryChapterProductionHandoffSchema
>;

export interface BuildStoryChapterProductionHandoffInput {
  expansion: StorySceneExpansion;
  readerTimePlan: StoryReaderTimePlan;
  chapterTitle: string;
  chapterGoal: string;
  povEntityId: string | null;
  targetCharacters: number;
}

const READER_TIME_WEIGHT: Record<
  Exclude<ReaderTimeAllocation, "none">,
  number
> = {
  mention: 1,
  beat: 2,
  scene: 4,
  chapter: 8,
};

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function visibleDecisions(
  plan: StoryReaderTimePlan,
): StoryReaderTimeSceneDecision[] {
  return [...plan.decisions]
    .filter(
      (decision) =>
        decision.action !== "skip" && decision.readerTime !== "none",
    )
    .sort((left, right) => left.readerOrder - right.readerOrder);
}

function allocateCharacters(
  decisions: readonly StoryReaderTimeSceneDecision[],
  total: number,
): number[] {
  const minimum = decisions.length * 200;
  if (!Number.isInteger(total) || total < minimum) {
    throw new Error(
      `story_production.target_characters_too_small:${total}:${minimum}`,
    );
  }
  const weights = decisions.map(
    (decision) =>
      READER_TIME_WEIGHT[
        decision.readerTime as Exclude<ReaderTimeAllocation, "none">
      ],
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const remaining = total - minimum;
  const allocated = weights.map(
    (weight) => 200 + Math.floor((remaining * weight) / weightTotal),
  );
  let delta = total - allocated.reduce((sum, value) => sum + value, 0);
  for (let index = 0; delta > 0; index = (index + 1) % allocated.length) {
    allocated[index] = allocated[index]! + 1;
    delta -= 1;
  }
  return allocated;
}

function sourceScene(
  expansion: StorySceneExpansion,
  sceneId: string,
): AuthoredStoryScenePlan {
  const scene = expansion.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`story_production.unknown_scene:${sceneId}`);
  return scene;
}

function productionScene(
  scene: AuthoredStoryScenePlan,
  decision: StoryReaderTimeSceneDecision,
  targetCharacters: number,
): ScenePlan["scenes"][number] {
  const release = `Reader本拍获得：${decision.informationReleased}`;
  const withheld = `仍保留：${decision.informationWithheld}`;
  const bridge = decision.nextExpectationSeed
    ? `下一期待：${decision.nextExpectationSeed}`
    : decision.focusShiftThreadIds.length > 0
      ? `期待焦点转移：${decision.focusShiftThreadIds.join("、")}`
      : "本拍不新增期待";
  const embodiment =
    decision.embodimentTargets.length > 0
      ? `必须具体演出：${decision.embodimentTargets.join("；")}`
      : "按当前场景动作自然演出";

  return {
    title: scene.title,
    goal: [
      scene.localProblem,
      `期待运动：${scene.expectationMove}`,
      embodiment,
    ].join("；"),
    conflict: [scene.pressure, withheld].join("；"),
    turn: [scene.interaction, release].join("；"),
    outcome: [
      scene.endState,
      bridge,
      `ReaderTime=${decision.readerTime}`,
      `章节边界=${decision.chapterBoundary}`,
    ].join("；"),
    locationId: scene.locationObjectId,
    participants: scene.participantEntityIds,
    targetCharacters,
  };
}

/**
 * Deterministic S07 -> S08 bridge.
 *
 * This is not another story-generation layer. S06 already authored the scenes
 * and S07 already decided Reader Time. The bridge only converts that locked
 * design into NarraLume's existing chapter-production ScenePlan shape while
 * retaining the complete Reader-Time directives as locked metadata.
 */
export function buildStoryChapterProductionHandoff(
  input: BuildStoryChapterProductionHandoffInput,
): StoryChapterProductionHandoff {
  const {
    expansion,
    readerTimePlan,
    chapterTitle,
    chapterGoal,
    povEntityId,
    targetCharacters,
  } = input;

  if (
    expansion.projectId !== readerTimePlan.projectId ||
    readerTimePlan.storySceneExpansionDigest !== expansion.digest ||
    readerTimePlan.realityFingerprint !== expansion.realityFingerprint
  ) {
    throw new Error("story_production.reader_time_not_bound_to_scene_expansion");
  }

  const decisions = visibleDecisions(readerTimePlan);
  if (decisions.length === 0) {
    throw new Error("story_production.no_visible_reader_time");
  }
  const characters = allocateCharacters(decisions, targetCharacters);
  const orderedScenes = decisions.map((decision) =>
    sourceScene(expansion, decision.sceneId),
  );
  const plannedEntityIds = [
    ...new Set(orderedScenes.flatMap((scene) => scene.participantEntityIds)),
  ];
  if (povEntityId && !plannedEntityIds.includes(povEntityId)) {
    plannedEntityIds.push(povEntityId);
  }

  const lockedScenePlan: ScenePlan = ScenePlanSchema.parse({
    chapterGoal,
    povEntityId,
    scenes: orderedScenes.map((scene, index) =>
      productionScene(scene, decisions[index]!, characters[index]!),
    ),
    continuityRisks: orderedScenes.map(
      (scene) =>
        `不得改写S05已验证Reality：${scene.projectedRealityUse}；场后状态必须保持：${scene.endState}`,
    ),
  });

  const readerTimeDirectives = decisions.map((decision) => ({
    sceneId: decision.sceneId,
    readerOrder: decision.readerOrder,
    action: decision.action,
    readerTime: decision.readerTime,
    expectationThreadIds: decision.expectationThreadIds,
    reasons: decision.reasons,
    embodimentTargets: decision.embodimentTargets,
    payoffThreadIds: decision.payoffThreadIds,
    reactionTargetEntityIds: decision.reactionTargetEntityIds,
    retainedGainOpportunity: decision.retainedGainOpportunity,
    informationReleased: decision.informationReleased,
    informationWithheld: decision.informationWithheld,
    focusShiftThreadIds: decision.focusShiftThreadIds,
    nextExpectationSeed: decision.nextExpectationSeed,
    chapterBoundary: decision.chapterBoundary,
  }));

  const draft = {
    version: "story-chapter-production-handoff.v1" as const,
    authority: "locked-story-design" as const,
    projectId: expansion.projectId,
    storySceneExpansionDigest: expansion.digest,
    storyReaderTimePlanDigest: readerTimePlan.digest,
    realityFingerprint: expansion.realityFingerprint,
    chapterTitle,
    chapterGoal,
    povEntityId,
    plannedEntityIds,
    targetCharacters,
    sourceSceneIds: decisions.map((decision) => decision.sceneId),
    lockedScenePlan,
    readerTimeDirectives,
  };

  return StoryChapterProductionHandoffSchema.parse({
    ...draft,
    digest: digest(draft),
  });
}

export function parseStoryChapterProductionHandoff(
  value: unknown,
): StoryChapterProductionHandoff | null {
  const parsed = StoryChapterProductionHandoffSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}


/**
 * Attach an already-built S08 production handoff to a concrete chapter node.
 *
 * This is an explicit staging step. It does not create prose and does not
 * settle Reality. ChapterWorkerSuite will consume the handoff as locked input.
 */
export function stageStoryChapterProductionHandoff(
  story: SqliteStoryRepository,
  chapterId: string,
  handoff: StoryChapterProductionHandoff,
  updatedAt: string,
) {
  const chapter = story.requireOutlineNode(handoff.projectId, chapterId);
  if (chapter.kind !== "chapter") {
    throw new Error("story_production.target_not_chapter");
  }
  if (chapter.title !== handoff.chapterTitle) {
    throw new Error("story_production.chapter_title_mismatch");
  }
  if (
    handoff.povEntityId !== null &&
    chapter.povEntityId !== null &&
    handoff.povEntityId !== chapter.povEntityId
  ) {
    throw new Error("story_production.pov_mismatch");
  }

  const existingPlanned = Array.isArray(chapter.metadata.plannedEntityIds)
    ? chapter.metadata.plannedEntityIds.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return story.updateOutlineDetails(
    handoff.projectId,
    chapterId,
    {
      povEntityId: handoff.povEntityId ?? chapter.povEntityId,
      metadata: {
        ...chapter.metadata,
        plannedEntityIds: [
          ...new Set([...existingPlanned, ...handoff.plannedEntityIds]),
        ],
        storyProductionHandoff: handoff,
      },
    },
    updatedAt,
  );
}
