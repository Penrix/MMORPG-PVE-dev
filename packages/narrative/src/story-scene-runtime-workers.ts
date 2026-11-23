import { z } from "zod";

import {
  StoryScenePlanSchema,
  type StorySceneExpansion,
  type StoryUnitDesign,
  type WorldArbitrationReceipt,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { JsonSchemaContract } from "@narralume/llm";

import type { NarrativeModelClient } from "./model-client.js";
import { zodValidator } from "./schemas.js";
import { finalizeStorySceneExpansion } from "./story-authoring-runtime.js";

const StorySceneExpansionOutputSchema = z.object({
  scenes: z.array(StoryScenePlanSchema).min(1),
});
type StorySceneExpansionOutput = z.infer<
  typeof StorySceneExpansionOutputSchema
>;

const STORY_SCENE_EXPANSION_CONTRACT: JsonSchemaContract = {
  name: "story_scene_expansion",
  strict: true,
  schema: z.toJSONSchema(StorySceneExpansionOutputSchema),
};

export interface StorySceneExpansionModelRequest {
  storyUnit: StoryUnitDesign;
  storyUnitEventId: string;
  arbitration: WorldArbitrationReceipt;
  request: string;
}

export interface StorySceneExpansionModelResult {
  value: StorySceneExpansion;
  usage: RunBudgetUsage;
  generation: {
    mode: "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

function outputIssues(
  value: StorySceneExpansionOutput,
  storyUnit: StoryUnitDesign,
  eventId: string,
): string[] {
  const issues: string[] = [];
  const event = storyUnit.events.find((item) => item.id === eventId);
  if (!event) {
    return [`unknown event ${eventId}`];
  }

  const cast = new Set(event.castPoolEntityIds);
  const anchors = new Set(storyUnit.objectAnchorIds);
  const order = new Set<number>();

  for (const scene of value.scenes) {
    if (order.has(scene.order)) {
      issues.push(`duplicate scene order ${scene.order}`);
    }
    order.add(scene.order);

    for (const entityId of scene.participantEntityIds) {
      if (!cast.has(entityId)) {
        issues.push(
          `scene ${scene.id}: participant ${entityId} is outside event castPool`,
        );
      }
    }
    if (
      scene.locationObjectId !== null &&
      !anchors.has(scene.locationObjectId)
    ) {
      issues.push(
        `scene ${scene.id}: location ${scene.locationObjectId} is outside StoryUnit object anchors`,
      );
    }
  }

  for (const target of event.phaseTargets) {
    const phaseScenes = value.scenes.filter(
      (scene) => scene.phase === target.phase,
    );
    if (phaseScenes.length === 0) {
      issues.push(`missing declared phase ${target.phase}`);
      continue;
    }
    for (const entityId of target.entityIds) {
      if (
        !phaseScenes.some((scene) =>
          scene.participantEntityIds.includes(entityId),
        )
      ) {
        issues.push(`phase ${target.phase}: entity ${entityId} never appears`);
      }
    }
  }

  return issues;
}

/**
 * S06 Director / Scene Expansion.
 *
 * One authored S05 problem-node expands into multiple scenes. The arbitration
 * receipt is a Reality constraint, not a screenplay. S06 may arrange pressure,
 * interaction and information movement, but must not rewrite the decisions that
 * S05 Character Agents and World Arbiter already projected.
 */
export class StorySceneExpansionService {
  constructor(private readonly model: NarrativeModelClient) {}

  async expand(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StorySceneExpansionModelRequest,
    signal: AbortSignal,
  ): Promise<StorySceneExpansionModelResult> {
    const event = request.storyUnit.events.find(
      (item) => item.id === request.storyUnitEventId,
    );
    if (
      !event ||
      run.projectId !== request.storyUnit.projectId ||
      request.storyUnit.status !== "READY" ||
      request.request.trim().length === 0
    ) {
      throw new Error("story_scene.invalid_expand_request");
    }
    if (
      request.arbitration.projectId !== request.storyUnit.projectId ||
      request.arbitration.storyUnitDesignDigest !== request.storyUnit.digest ||
      request.arbitration.storyUnitEventId !== event.id ||
      !request.arbitration.finalized ||
      request.arbitration.hardContractStatus !== "feasible"
    ) {
      throw new Error("story_scene.invalid_rehearsal");
    }

    const reactionTargets = request.storyUnit.reactionTargets.filter((target) =>
      event.reactionTargetEntityIds.includes(target.entityId),
    );
    const informationRelease = request.storyUnit.informationRelease.filter(
      (item) => event.informationReleaseSteps.includes(item.step),
    );
    const campNetwork = request.storyUnit.campNetwork.filter((member) =>
      event.castPoolEntityIds.includes(member.entityId),
    );

    const result = await this.model.structured(
      run,
      step,
      "story-scene-expansion",
      {
        instructions: [
          "你现在在 S06 做 Scene Expansion。讲师原稿的核心是：主线化为节点，每个节点都有一个问题，这个问题影响多个场景，场景继续给予压力，让 Reader 的期待升级。",
          "输入的 S05 event 已经是作者主动设计的 Story Node。不要重新发明它的目标，不要把它压成一个场景，也不要把 Character Agent / Arbiter 的日志直接改写成正文。",
          "arbitration 只锁定硬 Reality 与已经结算的具体演法：哪些动作成功、部分成功或受阻。S06 必须尊重这些事实，但不能把 arbitration 抬成上位编剧权，更不能用‘人物自主’取消 S04 已设计的 Stake / Reaction / Payoff 方向。",
          "phaseTargets 来自讲师的前/中/后展开。每个声明 phase 至少要有一个场景，声明的人物必须在对应 phase 的场景中实际出现。",
          "场景不是机械记录。每一场都必须继续承担局部问题、压力、人物交互、信息移动、期待变化和因果接续。before 可铺固有认知/压力，during 可让问题真正发生，after 要把作者已定的反应/关系变化演出来。震惊、后悔、投靠、嘴硬、误判、犯蠢、破防都允许，只要前置 Stake 与人设成立；不要只写一个‘震惊’标签，要把反应落成动作、选择、对白、资源与关系变化。",
          "reactionTargets 是 Author / Director 已经定价并准备收割的情绪/关系方向。S06 要在 arbitration 的硬事实边界内寻找最符合人设的具体演法来兑现它，而不是重新讨论‘这个人要不要反应’。",
          "informationRelease 只告诉你这一节点承接哪些信息差动作。S07 才负责全局 Reader Time、章节切点和跨节点信息释放，所以 S06 不要擅自把所有信息一次性结清。",
          "如果一个 Scene 结束后还有下一场，nextSceneCause 必须写清楚现实因果。禁止用‘转场’‘与此同时’之类无因果拼接。",
          "locationObjectId 只能引用 StoryUnit objectAnchorIds；缺乏可靠地点对象时填 null，不要凭空造地点。",
          "projectedRealityUse 要明确指出本场如何使用 arbitration 已确认的行动/结果，而不是再写一个可能发生的版本。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                request: request.request,
                storyUnit: {
                  digest: request.storyUnit.digest,
                  storyProblem: request.storyUnit.storyProblem,
                  objectAnchorIds: request.storyUnit.objectAnchorIds,
                },
                event,
                campNetwork,
                reactionTargets,
                informationRelease,
                arbitration: {
                  digest: request.arbitration.digest,
                  resolutions: request.arbitration.resolutions,
                  conflicts: request.arbitration.conflicts,
                  protagonistProjection:
                    request.arbitration.protagonistProjection,
                },
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "high",
      },
      STORY_SCENE_EXPANSION_CONTRACT,
      zodValidator(StorySceneExpansionOutputSchema, (value) =>
        outputIssues(value, request.storyUnit, event.id),
      ),
      signal,
    );

    const value = finalizeStorySceneExpansion(
      {
        version: "story-scene-expansion.v1",
        authority: "speculative",
        projectId: request.storyUnit.projectId,
        storyUnitDesignDigest: request.storyUnit.digest,
        storyUnitEventId: event.id,
        arbitrationDigest: request.arbitration.digest,
        realityFingerprint: request.arbitration.realityFingerprint,
        eventProblem: event.problem,
        scenes: result.value.scenes,
      },
      request.storyUnit,
      request.arbitration,
    );

    return {
      value,
      usage: result.usage,
      generation: {
        mode: result.mode,
        attempts: result.attempts,
      },
    };
  }
}
