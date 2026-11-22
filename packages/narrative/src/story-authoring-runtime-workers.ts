import { z } from "zod";

import {
  StoryObjectFocusSchema,
  StoryOpportunitySeedSchema,
  StoryScaleSearchResultSchema,
  StoryUnitCampMemberSchema,
  StoryUnitCampTransitionSchema,
  StoryUnitEventDesignSchema,
  StoryUnitInformationReleaseSchema,
  StoryUnitReactionTargetSchema,
  StoryWorldGapSchema,
  type ExpectationDesign,
  type StoryAuthoringSearch,
  type StoryObjectField,
  type StoryUnitDesign,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { JsonSchemaContract } from "@narralume/llm";

import type { NarrativeModelClient } from "./model-client.js";
import { zodValidator } from "./schemas.js";
import {
  finalizeStoryAuthoringSearch,
  finalizeStoryUnitDesign,
  storyObjectSurfaceRef,
} from "./story-authoring-runtime.js";

const StoryAuthoringSearchOutputSchema = z.object({
  status: z.enum(["READY", "BLOCKED_WORLD_GAP"]),
  question: z.string().min(1),
  objectFocus: z.array(StoryObjectFocusSchema),
  seeds: z.array(StoryOpportunitySeedSchema),
  worldGaps: z.array(StoryWorldGapSchema),
  scaleResult: StoryScaleSearchResultSchema,
});
type StoryAuthoringSearchOutput = z.infer<
  typeof StoryAuthoringSearchOutputSchema
>;

const STORY_AUTHORING_SEARCH_CONTRACT: JsonSchemaContract = {
  name: "story_object_grounded_search",
  strict: true,
  schema: z.toJSONSchema(StoryAuthoringSearchOutputSchema),
};

const StoryUnitDesignOutputSchema = z.object({
  status: z.enum(["READY", "BLOCKED_WORLD_GAP"]),
  objectAnchorIds: z.array(z.string().min(1)),
  groundingSurfaceRefs: z.array(z.string().min(1)),
  storyProblem: z.string().min(1),
  worldGaps: z.array(StoryWorldGapSchema),
  campNetwork: z.array(StoryUnitCampMemberSchema),
  reactionTargets: z.array(StoryUnitReactionTargetSchema),
  campTransitions: z.array(StoryUnitCampTransitionSchema),
  appearanceOrderEntityIds: z.array(z.string().min(1)),
  informationRelease: z.array(StoryUnitInformationReleaseSchema),
  events: z.array(StoryUnitEventDesignSchema),
});
type StoryUnitDesignOutput = z.infer<typeof StoryUnitDesignOutputSchema>;

const STORY_UNIT_DESIGN_CONTRACT: JsonSchemaContract = {
  name: "story_unit_design",
  strict: true,
  schema: z.toJSONSchema(StoryUnitDesignOutputSchema),
};

export interface StoryAuthoringSearchModelRequest {
  field: StoryObjectField;
  request: string;
  readerNeed: string;
  targetEmotion: string;
  protagonistProfile: string;
  methodInstructions?: string;
  matureStoryMaterials?: string;
}

export interface StoryUnitDesignModelRequest {
  field: StoryObjectField;
  sourceSearch: StoryAuthoringSearch | null;
  sourceSeedIds: readonly string[];
  expectationDesign: ExpectationDesign;
  request: string;
}

export interface StoryAuthoringModelResult<T> {
  value: T;
  usage: RunBudgetUsage;
  generation: {
    mode: "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

function fieldObjectCatalog(field: StoryObjectField) {
  return field.objects.map((object) => ({
    id: object.id,
    entityId: object.entityId,
    name: object.name,
    kind: object.kind,
    aliases: object.aliases,
    surfaces: object.surfaces.map((surface) => ({
      ...surface,
      ref: storyObjectSurfaceRef(object.id, surface),
    })),
    sourceRefs: object.sourceRefs,
  }));
}

function searchOutputIssues(
  value: StoryAuthoringSearchOutput,
  field: StoryObjectField,
): string[] {
  const issues: string[] = [];
  const allowed = new Set(field.objects.map((object) => object.id));
  const allowedSurfaces = new Set(
    field.objects.flatMap((object) =>
      object.surfaces.map((surface) =>
        storyObjectSurfaceRef(object.id, surface),
      ),
    ),
  );
  if (value.scaleResult.scale !== field.scale) {
    issues.push(
      `scaleResult.scale must equal field.scale (${field.scale}), got ${value.scaleResult.scale}`,
    );
  }
  for (const focus of value.objectFocus) {
    if (!allowed.has(focus.objectId)) {
      issues.push(`objectFocus: unknown objectId ${focus.objectId}`);
    }
    for (const surfaceRef of focus.surfaceRefs) {
      if (!allowedSurfaces.has(surfaceRef)) {
        issues.push(`objectFocus: unknown surfaceRef ${surfaceRef}`);
      }
    }
  }
  for (const seed of value.seeds) {
    for (const objectId of seed.anchorObjectIds) {
      if (!allowed.has(objectId)) {
        issues.push(`seed ${seed.id}: unknown anchorObjectId ${objectId}`);
      }
    }
    for (const surfaceRef of seed.groundingSurfaceRefs) {
      if (!allowedSurfaces.has(surfaceRef)) {
        issues.push(
          `seed ${seed.id}: unknown groundingSurfaceRef ${surfaceRef}`,
        );
      }
    }
  }
  return issues;
}

function storyUnitOutputIssues(
  value: StoryUnitDesignOutput,
  field: StoryObjectField,
): string[] {
  const issues: string[] = [];
  const allowedObjects = new Set(field.objects.map((object) => object.id));
  const allowedSurfaces = new Set(
    field.objects.flatMap((object) =>
      object.surfaces.map((surface) =>
        storyObjectSurfaceRef(object.id, surface),
      ),
    ),
  );
  const allowedEntities = new Set(
    field.objects.map((object) => object.entityId),
  );
  const campEntities = new Set(
    value.campNetwork.map((member) => member.entityId),
  );
  const reactionTargetEntities = new Set(
    value.reactionTargets.map((target) => target.entityId),
  );
  const informationSteps = new Set(
    value.informationRelease.map((item) => item.step),
  );

  for (const objectId of value.objectAnchorIds) {
    if (!allowedObjects.has(objectId)) {
      issues.push(`objectAnchorIds: unknown objectId ${objectId}`);
    }
  }
  for (const surfaceRef of value.groundingSurfaceRefs) {
    if (!allowedSurfaces.has(surfaceRef)) {
      issues.push(`groundingSurfaceRefs: unknown surfaceRef ${surfaceRef}`);
    }
  }
  for (const member of value.campNetwork) {
    if (!allowedEntities.has(member.entityId)) {
      issues.push(`campNetwork: unknown entityId ${member.entityId}`);
    }
  }
  for (const target of value.reactionTargets) {
    if (!campEntities.has(target.entityId)) {
      issues.push(
        `reactionTargets: entity ${target.entityId} is not in campNetwork`,
      );
    }
  }
  for (const transition of value.campTransitions) {
    if (!campEntities.has(transition.entityId)) {
      issues.push(
        `campTransitions: entity ${transition.entityId} is not in campNetwork`,
      );
    }
  }
  for (const entityId of value.appearanceOrderEntityIds) {
    if (!campEntities.has(entityId)) {
      issues.push(
        `appearanceOrderEntityIds: entity ${entityId} is not in campNetwork`,
      );
    }
  }
  for (const event of value.events) {
    const cast = new Set(event.castPoolEntityIds);
    for (const entityId of event.castPoolEntityIds) {
      if (!allowedEntities.has(entityId)) {
        issues.push(`event ${event.id}: unknown castPool entityId ${entityId}`);
      }
    }
    for (const entityId of event.activeSeedEntityIds) {
      if (!cast.has(entityId)) {
        issues.push(
          `event ${event.id}: activeSeed ${entityId} is outside castPool`,
        );
      }
    }
    const pressureActors = new Set(
      event.actorPressures.map((item) => item.entityId),
    );
    for (const entityId of event.castPoolEntityIds) {
      if (!pressureActors.has(entityId)) {
        issues.push(
          `event ${event.id}: missing actorPressure for cast entity ${entityId}`,
        );
      }
    }
    for (const entityId of pressureActors) {
      if (!cast.has(entityId)) {
        issues.push(
          `event ${event.id}: actorPressure entity ${entityId} is outside castPool`,
        );
      }
    }
    for (const entityId of event.reactionTargetEntityIds) {
      if (!reactionTargetEntities.has(entityId)) {
        issues.push(
          `event ${event.id}: reaction target ${entityId} has no S04 reactionTarget`,
        );
      }
      if (!cast.has(entityId)) {
        issues.push(
          `event ${event.id}: reaction target ${entityId} is outside castPool`,
        );
      }
    }
    for (const step of event.informationReleaseSteps) {
      if (!informationSteps.has(step)) {
        issues.push(
          `event ${event.id}: unknown informationRelease step ${step}`,
        );
      }
    }
    const phaseNames = new Set<string>();
    for (const target of event.phaseTargets) {
      if (phaseNames.has(target.phase)) {
        issues.push(`event ${event.id}: duplicate phaseTarget ${target.phase}`);
      }
      phaseNames.add(target.phase);
      for (const entityId of target.entityIds) {
        if (!cast.has(entityId)) {
          issues.push(
            `event ${event.id}: phase ${target.phase} entity ${entityId} is outside castPool`,
          );
        }
      }
    }
  }
  return issues;
}

/**
 * Author-side writers' room service.
 *
 * S01-S03 search on concrete world objects. S04 turns selected objects into a
 * designed story unit. Neither path can mutate Reality or predetermine actor
 * decisions.
 */
export class StoryAuthoringService {
  constructor(private readonly model: NarrativeModelClient) {}

  async search(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryAuthoringSearchModelRequest,
    signal: AbortSignal,
  ): Promise<StoryAuthoringModelResult<StoryAuthoringSearch>> {
    if (
      run.projectId !== request.field.projectId ||
      !["S01", "S02", "S03"].includes(request.field.scale) ||
      request.field.objects.length === 0 ||
      request.request.trim().length === 0 ||
      request.readerNeed.trim().length === 0 ||
      request.targetEmotion.trim().length === 0
    ) {
      throw new Error("story_authoring.invalid_search_request");
    }

    const scaleInstruction =
      request.field.scale === "S01"
        ? "S01必须同时形成 Story Concept 与 Story Engine，并解释 Engine 如何持续生产这种人生。不要提前排大卷。"
        : request.field.scale === "S02"
          ? "S02必须从 Current S0 和当前可达对象寻找真正的新生活 / Stage Opportunity。不要把父层目标拆成办事步骤。"
          : "S03必须形成这一阵子的 Story Opportunity Field 与仍在运动的 Story Movement，再给出可交 S04 的 Story Seeds。不要直接写完整 S04。";

    const result = await this.model.structured(
      run,
      step,
      "story-object-grounded-search",
      {
        instructions: [
          "你在作者侧 Writers' Room 工作。所有想象和脑洞必须先有想象对象。",
          "输入 Object Field 来自 Module 2 的 Project Reality / Source Atlas 投影。它是想象底座，不是背景装饰。",
          "禁止先想一个熟悉套路，再回来给套路贴世界名词。先看具体对象当前是谁、拥有什么、缺什么、和谁相连、什么规则给它定价，再做连接、交叉、对立、变奏、因果追踪或成熟故事迁移。",
          "每颗 Story Seed 的 anchorObjectIds 必须引用 Object Field 中真实 object.id，groundingSurfaceRefs 必须引用对象 surfaces 中提供的 ref。Observation 必须能从这些具体 surfaces 推出来，不能只借两个真名字编一条不存在的关系。",
          "允许真实对象碰撞后长出新人物/机构/用途，但只能放 candidateNewObjects，status 必须是 CANDIDATE，不能冒充 Reality。",
          "如果 Object Field 太薄，status 必须返回 BLOCKED_WORLD_GAP。worldGaps 必须结构化写出缺什么、锚在哪些已有对象、为什么缺，并用 productionHint 指向现有 World Builder workshop。此时允许 seeds 与尺度结果为空，不要为了过 schema 用‘神秘高手/反派/美女/商会’占位补洞。",
          "M 方法只是搜索运动，不提供搜索对象。成熟故事材料只是 prior，不是本书 Reality。",
          "候选可以分叉、回返和失败；不要为了尽快交付而把第一条可行答案冒充完成。",
          scaleInstruction,
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                scale: request.field.scale,
                request: request.request,
                readerNeed: request.readerNeed,
                targetEmotion: request.targetEmotion,
                protagonistProfile: request.protagonistProfile,
                objectField: {
                  digest: request.field.digest,
                  storyTimeLabel: request.field.storyTimeLabel,
                  objects: fieldObjectCatalog(request.field),
                },
                methodInstructions: request.methodInstructions ?? null,
                matureStoryMaterials: request.matureStoryMaterials ?? null,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      STORY_AUTHORING_SEARCH_CONTRACT,
      zodValidator(StoryAuthoringSearchOutputSchema, (value) =>
        searchOutputIssues(value, request.field),
      ),
      signal,
    );

    const value = finalizeStoryAuthoringSearch(
      {
        version: "story-authoring-search.v1",
        authority: "speculative",
        status: result.value.status,
        projectId: request.field.projectId,
        scale: request.field.scale as "S01" | "S02" | "S03",
        objectFieldDigest: request.field.digest,
        question: result.value.question,
        objectFocus: result.value.objectFocus,
        seeds: result.value.seeds,
        worldGaps: result.value.worldGaps,
        scaleResult: result.value.scaleResult,
      },
      request.field,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }

  async designStoryUnit(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryUnitDesignModelRequest,
    signal: AbortSignal,
  ): Promise<StoryAuthoringModelResult<StoryUnitDesign>> {
    if (
      run.projectId !== request.field.projectId ||
      request.field.scale !== "S04" ||
      request.expectationDesign.projectId !== request.field.projectId ||
      request.request.trim().length === 0
    ) {
      throw new Error("story_authoring.invalid_story_unit_request");
    }

    if (
      request.sourceSearch &&
      (request.sourceSearch.projectId !== request.field.projectId ||
        request.sourceSearch.scale !== "S03")
    ) {
      throw new Error("story_authoring.source_search_not_bound");
    }

    const availableSeedIds = new Set(
      request.sourceSearch?.seeds.map((seed) => seed.id) ?? [],
    );
    const currentObjectIds = new Set(
      request.field.objects.map((object) => object.id),
    );
    for (const seedId of request.sourceSeedIds) {
      if (!availableSeedIds.has(seedId)) {
        throw new Error(`story_authoring.unknown_source_seed:${seedId}`);
      }
      const seed = request.sourceSearch?.seeds.find(
        (candidate) => candidate.id === seedId,
      );
      const currentSurfaceRefs = new Set(
        request.field.objects.flatMap((object) =>
          object.surfaces.map((surface) =>
            storyObjectSurfaceRef(object.id, surface),
          ),
        ),
      );
      if (
        !seed ||
        seed.anchorObjectIds.some(
          (objectId) => !currentObjectIds.has(objectId),
        ) ||
        seed.groundingSurfaceRefs.some(
          (surfaceRef) => !currentSurfaceRefs.has(surfaceRef),
        )
      ) {
        throw new Error(`story_authoring.stale_source_seed:${seedId}`);
      }
    }

    const selectedSeeds =
      request.sourceSearch?.seeds.filter((seed) =>
        request.sourceSeedIds.includes(seed.id),
      ) ?? [];

    const result = await this.model.structured(
      run,
      step,
      "story-unit-design",
      {
        instructions: [
          "你在 S04 Writers' Room 设计一出故事。小说不是世界自转后的监控录像，也不是让 Character Agents 随机生活后再捡精彩片段。",
          "先从给定 Object Field 与已选 Story Seeds 选择具体对象，再设计为什么这些对象现在要撞在一起。READY 时 groundingSurfaceRefs 必须指出这出 Story 具体踩在哪些 Object surfaces 上，不能只引用对象名。",
          "Expectation Design 已经给出 Reader 需求、目标情绪、稀缺性方向、固有认知、主角优势、反应与收益方向。不得偷换这笔交易。",
          "三阵营首先是编剧工具：作者主动选择哪些真实人物承担压力、定价、连接、未来反应与阵营转化，但不能预写他们实际一定震惊、投靠、认输或降智。",
          "appearanceOrderEntityIds 与 informationRelease 负责谁先进入、Reader/人物分别何时知道什么。",
          "events 是有顺序的 S05 Story Node，不是 Agent 模拟结果。每个 Node 必须只有一个清楚的 problem：主线化为节点，每个节点一个问题，这个问题之后会在 S06 影响多个场景。",
          "每个 S05 Node 要写 storyPressure、realityQuestion、readerExpectation；用 phaseTargets 明确 before / during / after 哪些人物线要被展开，用 reactionTargetEntityIds 关联 S04 已设计的反应目标，用 informationReleaseSteps 关联这一节点承接的信息释放步骤。",
          "Cast Pool 是这个 Node 可能卷入的人物池；Active Seed 是 Reality Rehearsal 第一轮真正行动/被触发的人。绝不能默认第一轮全员开机。actorPressures 必须为 Cast Pool 每个人各写一条当前场面压力/刺激条件，它是编剧搭的戏台，不是替角色决定反应。",
          "Character Agent + World Arbiter 只是 S05 Node 内部的 Reality Rehearsal / Adjudication 子程序，不是 S05 本体，也不是场景生成算法。它们只回答人物实际会不会这么做、Reality 是否允许；若撞坏 soft route，就回 S05/S04 改未来，不改演员。",
          "S06 会把通过 Reality 约束的一个 Node 展开为多个 Scene，所以这里不要把 event 写成单一场景摘要，也不要提前把 scene 数量压成一个动作结果。",
          "如果当前对象不够支撑这出戏，status 必须返回 BLOCKED_WORLD_GAP，把缺口结构化写入 worldGaps，并用 productionHint 指向现有 World Builder workshop，events 为空；不要为了过 schema 凭空造人物、关系或事件。对象足够时返回 READY。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                request: request.request,
                objectField: {
                  digest: request.field.digest,
                  storyTimeLabel: request.field.storyTimeLabel,
                  objects: fieldObjectCatalog(request.field),
                },
                selectedSeeds,
                expectationDesign: request.expectationDesign,
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      STORY_UNIT_DESIGN_CONTRACT,
      zodValidator(StoryUnitDesignOutputSchema, (value) =>
        storyUnitOutputIssues(value, request.field),
      ),
      signal,
    );

    const value = finalizeStoryUnitDesign(
      {
        version: "story-unit-design.v1",
        authority: "speculative",
        status: result.value.status,
        projectId: request.field.projectId,
        objectFieldDigest: request.field.digest,
        sourceSeedIds: [...request.sourceSeedIds],
        expectationDesignDigest: request.expectationDesign.digest,
        objectAnchorIds: result.value.objectAnchorIds,
        groundingSurfaceRefs: result.value.groundingSurfaceRefs,
        storyProblem: result.value.storyProblem,
        worldGaps: result.value.worldGaps,
        campNetwork: result.value.campNetwork,
        reactionTargets: result.value.reactionTargets,
        campTransitions: result.value.campTransitions,
        appearanceOrderEntityIds: result.value.appearanceOrderEntityIds,
        informationRelease: result.value.informationRelease,
        events: result.value.events,
        mustPreserveAgentAutonomy: true,
      },
      request.field,
      request.expectationDesign,
      availableSeedIds,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }
}
