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
  StoryStakeLedgerEntrySchema,
  StoryWorldGapSchema,
  type ExpectationDesign,
  type StoryAuthoringSearch,
  type StoryCreativeContext,
  type StoryObjectField,
  type StoryUnitDesign,
  type StoryUpgradeLedger,
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
import { assertStoryCreativeContextBound } from "./story-creative-context.js";

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
  stakeLedger: z.array(StoryStakeLedgerEntrySchema),
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
  creativeContext: StoryCreativeContext;
  upgradeLedger: StoryUpgradeLedger;
  request: string;
  readerNeed: string;
  targetEmotion: string;
  protagonistProfile: string;
  methodInstructions?: string;
  /** @deprecated Prefer creativeContext.materialSelections from Module 2. */
  matureStoryMaterials?: string;
}

export interface StoryUnitDesignModelRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  sourceSearch: StoryAuthoringSearch | null;
  sourceSeedIds: readonly string[];
  expectationDesign: ExpectationDesign;
  upgradeLedger: StoryUpgradeLedger;
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
    if (seed.candidateNewObjects.length > 0) {
      issues.push(
        `seed ${seed.id}: candidateNewObjects must be empty; report a worldGap instead`,
      );
    }
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
  const stakeIds = new Set(value.stakeLedger.map((entry) => entry.id));
  const stakesByEntity = new Map<string, string[]>();
  for (const entry of value.stakeLedger) {
    if (!allowedEntities.has(entry.entityId)) {
      issues.push(`stakeLedger: unknown entityId ${entry.entityId}`);
    }
    const ids = stakesByEntity.get(entry.entityId) ?? [];
    ids.push(entry.id);
    stakesByEntity.set(entry.entityId, ids);
  }
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
    if (!stakesByEntity.has(target.entityId)) {
      issues.push(
        `reactionTargets: entity ${target.entityId} has no priced stake`,
      );
    }
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
    for (const stakeId of event.stakeEntryIds) {
      if (!stakeIds.has(stakeId)) {
        issues.push(`event ${event.id}: unknown stakeEntryId ${stakeId}`);
      }
      const stake = value.stakeLedger.find((entry) => entry.id === stakeId);
      if (stake && !cast.has(stake.entityId)) {
        issues.push(
          `event ${event.id}: stake ${stakeId} belongs to ${stake.entityId} outside castPool`,
        );
      }
    }
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
      const activeStakeIds = new Set(event.stakeEntryIds);
      const priced = (stakesByEntity.get(entityId) ?? []).some((stakeId) =>
        activeStakeIds.has(stakeId),
      );
      if (!priced) {
        issues.push(
          `event ${event.id}: reaction target ${entityId} has no active stake`,
        );
      }
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
 * S01-S03 are optional lenses over one inherited creative frame. S04 turns
 * concrete Module-2 objects into an authored story unit around the protagonist.
 * Character execution chooses concrete performance inside the authored line.
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
      !request.field.objects.some(
        (object) =>
          object.entityId === request.upgradeLedger.protagonistEntityId,
      ) ||
      request.request.trim().length === 0 ||
      request.readerNeed.trim().length === 0 ||
      request.targetEmotion.trim().length === 0
    ) {
      throw new Error("story_authoring.invalid_search_request");
    }

    assertStoryCreativeContextBound(
      request.creativeContext,
      request.field,
      request.upgradeLedger,
    );

    const scaleInstruction =
      request.field.scale === "S01"
        ? "S01只是长程视角：围绕既定 Upgrade Ledger 看这条 Road 为什么能持续、哪些现有人物/圈层/资源会成为后续价格阶梯。不要把它当成另一台从零生成 Story Concept 的机器。"
        : request.field.scale === "S02"
          ? "S02只是当前阶段视角：围绕 upgradeLedger.currentStepId / stageGoal，看现有人物网如何给这一层升级定价、设门槛、提供入口。不要脱离升级路线另造一条人生。"
          : "S03只是当前故事视角：围绕当前 stageGoal，从现成人物的认知、利益、关系、正在做的事中寻找可下注、可碰撞、可结算的 Story Seed。不要凭空造新人物，也不要直接写完整 S04。";

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
          "第三模块不负责捏人或补世界。candidateNewObjects 必须为空。若当前 Story 真正缺人物、关系、制度、组织、资源或入口，写入 worldGaps，回 Module 1 / World Builder 生产后再继续。尤其禁止为了‘需要一个识货人/反派/妹妹位’临时造功能NPC。",
          "如果 Object Field 太薄，status 必须返回 BLOCKED_WORLD_GAP。worldGaps 必须结构化写出缺什么、锚在哪些已有对象、为什么缺，并用 productionHint 指向现有 World Builder workshop。此时允许 seeds 与尺度结果为空，不要为了过 schema 用‘神秘高手/反派/美女/商会’占位补洞。",
          "Creative Frame 是当前长篇创作状态：必须继承父层与同层前序区段，不能把当前区段当成新书重新开机。",
          "男主是故事推演的主摄像机。先问 protagonistCamera 中男主现在在哪里、想得到什么、这一步准备主动做什么，再看他的行动会撞到哪些现成人物、资源、组织和规则。",
          "creativeContext.methodInvocations 只承载真正的创作算法；creativeContext.materialSelections 承载从 Module 2 素材空间召回的具体创意对象。M03素材卡不是算法。两类输入都不能自动成为 Canon。",
          "S01/S02/S03 不是 S Framework 本体，更不是三台独立故事生成器，只是同一 Creative Frame / Upgrade Ledger 的长程 / 当前阶段 / 当前故事观察尺度。所有结果必须服务同一条 Road。",
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
                creativeContext: request.creativeContext,
                upgradeLedger: request.upgradeLedger,
                objectField: {
                  digest: request.field.digest,
                  storyTimeLabel: request.field.storyTimeLabel,
                  objects: fieldObjectCatalog(request.field),
                },
                methodInstructions: request.methodInstructions ?? null,
                legacyMatureStoryMaterials:
                  request.matureStoryMaterials ?? null,
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
        creativeContextDigest: request.creativeContext.digest,
        question: result.value.question,
        objectFocus: result.value.objectFocus,
        seeds: result.value.seeds,
        worldGaps: result.value.worldGaps,
        scaleResult: result.value.scaleResult,
      },
      request.field,
      request.creativeContext,
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
      !request.field.objects.some(
        (object) =>
          object.entityId === request.upgradeLedger.protagonistEntityId,
      ) ||
      request.request.trim().length === 0
    ) {
      throw new Error("story_authoring.invalid_story_unit_request");
    }

    assertStoryCreativeContextBound(
      request.creativeContext,
      request.field,
      request.upgradeLedger,
    );

    if (
      request.sourceSearch &&
      (request.sourceSearch.projectId !== request.field.projectId ||
        request.sourceSearch.scale !== "S03" ||
        request.sourceSearch.creativeContextDigest !==
          request.creativeContext.digest)
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
          "Creative Frame 是长期创作状态，不是提示词标题。先继承 parentFrames 与 previousSiblingFrames 已经成立的目标、关系、结果和未结事项，再设计当前区段。",
          "Protagonist Camera 是本轮推演起点。男主不是旁观摄像头，而是主动行动者：围绕 currentGoal / upgradeNeed / activeMove，让他去碰 Module 2 已有的人、资源、组织、制度与高价对象，由这些人的下注与反应形成剧情。",
          "Creative Method Invocations 是横切算法调用。M 系列可以帮助找好处、想金手指/能力、技能进化、关系玩法、战斗解法或新点子，但必须作用在当前 Frame + 男主目标 + 已有世界对象上，不能替代 Reality。",
          "Upgrade Ledger 是这部长篇已经确定的升级路线与当前阶段，不是本轮临时脑洞。StoryUnit 必须服务 currentStepId / stageGoal / settlementTarget，不能等一次互动结束后再问‘下一故事自然长什么’。",
          "Expectation Design 已经给出 Reader 需求、目标情绪、稀缺性方向、固有认知、主角优势、反应与收益方向。不得偷换这笔交易。",
          "三阵营首先是编剧工具：只从 Object Field 中已经存在的人物划分当前友方/敌方/中立/其他利益位置。禁止为了‘需要一个识货人/反派/妹妹位’在第三模块临时造功能NPC。",
          "配角反应是爽点，但反应必须先定价。stakeLedger 是核心：每个关键配角先写 currentBelief/currentInterest，再写他因此做出的 stakeAction、压上的 stakeAssets、撤退成本、后续怎样加注，最后才设计 payoffReaction 与 settlementChange。不是只写‘他觉得主角不行’。",
          "作者/Director可以主动设计震惊、投靠、后悔、误判、犯蠢、变脸、效忠等反应方向。要求不是‘人物不能被作者设计’，而是铺垫、固有认知、利益、人设与下注成立。",
          "appearanceOrderEntityIds 与 informationRelease 负责谁先进入、Reader/人物分别何时知道什么。",
          "events 是有顺序的 S05 Story Node，不是 Agent 模拟结果。每个 Node 必须只有一个清楚的 problem：主线化为节点，每个节点一个问题，这个问题之后会在 S06 影响多个场景。",
          "每个 S05 Node 要写 storyPressure、realityQuestion、readerExpectation；用 phaseTargets 明确 before / during / after 哪些人物线要被展开，用 reactionTargetEntityIds 关联 S04 已设计的反应目标，用 informationReleaseSteps 关联这一节点承接的信息释放步骤。",
          "Cast Pool 是这个 Node 可能卷入的人物池；Active Seed 是第一轮真正被激活的人。actorPressures 为 Cast Pool 每个人写当前刺激条件；stakeEntryIds 必须指向本 Node 正在推进/加注/结算的 Stake Ledger 项。",
          "Character Model + World Arbiter 只是 S05 Node 内部的演法与硬事实检查，不拥有上位编剧权。Director 已经决定人物线的戏剧方向；Character Model 要在这一方向内寻找最符合人设、利益、既有认知与可见 Reality 的具体行动/表达。只有时间、地点、资源、知识、规则等硬事实冲突才允许判定当前演法不可执行，再回 S05 调整演法，而不是取消这条商业男频人物线。",
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
                creativeContext: request.creativeContext,
                selectedSeeds,
                upgradeLedger: request.upgradeLedger,
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
        creativeContextDigest: request.creativeContext.digest,
        sourceSeedIds: [...request.sourceSeedIds],
        expectationDesignDigest: request.expectationDesign.digest,
        objectAnchorIds: result.value.objectAnchorIds,
        groundingSurfaceRefs: result.value.groundingSurfaceRefs,
        storyProblem: result.value.storyProblem,
        worldGaps: result.value.worldGaps,
        upgradeLedger: request.upgradeLedger,
        campNetwork: result.value.campNetwork,
        stakeLedger: result.value.stakeLedger,
        reactionTargets: result.value.reactionTargets,
        campTransitions: result.value.campTransitions,
        appearanceOrderEntityIds: result.value.appearanceOrderEntityIds,
        informationRelease: result.value.informationRelease,
        events: result.value.events,
        directorAuthority: "author-defined-story-line",
        characterExecutionRule: "characterization-constrained-performance",
      },
      request.field,
      request.expectationDesign,
      request.creativeContext,
      availableSeedIds,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }
}
