import type {
  StoryUnitDesign,
  WorldArbitrationReceipt,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import { describe, expect, it, vi } from "vitest";

import type { NarrativeModelClient } from "../src/model-client.js";
import { StorySceneExpansionService } from "../src/story-scene-runtime-workers.js";

const usage: RunBudgetUsage = {
  inputTokens: 120,
  outputTokens: 80,
  calls: 1,
  costUsd: 0,
  wallTimeMs: 10,
};

const run = { projectId: "p1" } as NarrativeRun;
const step = { id: "scene-expand-step" } as NarrativeRunStep;

function storyUnit(): StoryUnitDesign {
  return {
    version: "story-unit-design.v1",
    authority: "speculative",
    status: "READY",
    projectId: "p1",
    objectFieldDigest: "field:digest",
    creativeContextDigest: "creative:test",
    sourceSeedIds: [],
    expectationDesignDigest: "expectation:digest",
    objectAnchorIds: ["object:xiuxin", "object:medic"],
    groundingSurfaceRefs: ["surface:xiuxin", "surface:medic"],
    storyProblem: "让异常第一次进入可信识货链",
    worldGaps: [],
    upgradeLedger: {
      protagonistEntityId: "xiuxin",
      road: "从医院低位伤员进入木叶高价任务圈",
      currentStepId: "step:professional-reprice",
      currentPosition: "普通重伤忍者",
      stageGoal: "让异常能力获得第一层专业重新估值",
      settlementTarget: "获得更高任务圈入口",
      steps: [
        {
          id: "step:professional-reprice",
          title: "专业重新估值",
          targetGain: "专业评级与任务价值",
          gate: "打破普通伤员固有认知",
          targetCircle: "医疗与任务审核圈",
        },
        {
          id: "step:elite-mission",
          title: "进入高价任务圈",
          targetGain: "上忍级任务机会",
          gate: "用专业评级换真实任务",
          targetCircle: "上忍与高价任务圈",
        },
      ],
    },
    campNetwork: [
      {
        entityId: "xiuxin",
        camp: "友方",
        currentGoal: "恢复",
        storyRole: "主角行动来源",
        currentBelief: "自己的训练有效",
        currentInterest: "恢复并重新取得任务价值",
      },
      {
        entityId: "medic",
        camp: "中立",
        currentGoal: "按规则处理伤员",
        storyRole: "专业定价",
        currentBelief: "秀信只是普通伤员",
        currentInterest: "维护专业判断和资源配置准确性",
      },
    ],
    stakeLedger: [
      {
        id: "stake:medic-rating",
        entityId: "medic",
        currentBelief: "秀信只是普通伤员",
        currentInterest: "维护专业判断和医疗资源配置",
        stakeAction: "继续按普通伤员标准处理并给出专业评级",
        stakeAssets: ["专业判断", "医疗资源配置"],
        commitmentCost: "改判就等于承认此前估值不足",
        escalationPlan: "异常持续时升级复核并留下记录",
        payoffReaction: "亲自改判秀信价值并改变后续处理",
        settlementChange: "秀信进入更高专业估值链",
        state: "committed",
      },
    ],
    reactionTargets: [
      {
        entityId: "medic",
        before: "普通估值",
        during: "自行判断异常",
        after: "目标是重新估值",
      },
    ],
    campTransitions: [],
    appearanceOrderEntityIds: ["xiuxin", "medic"],
    informationRelease: [
      {
        step: 1,
        readerKnows: "秀信的控制异常",
        charactersKnow: "医疗忍者只知道眼前结果",
        withheld: "更高层尚未知情",
        purpose: "建立认知差",
      },
    ],
    events: [
      {
        id: "event:test",
        title: "恢复测试",
        purpose: "让异常进入专业见证",
        problem: "异常是否会改变医疗忍者的专业估值",
        storyPressure: "普通伤员认知与异常结果冲突",
        castPoolEntityIds: ["xiuxin", "medic"],
        activeSeedEntityIds: ["xiuxin"],
        actorPressures: [
          { entityId: "xiuxin", pressure: "继续训练会暴露真实水平" },
          { entityId: "medic", pressure: "专业职责要求处理异常" },
        ],
        stakeEntryIds: ["stake:medic-rating"],
        reactionTargetEntityIds: ["medic"],
        informationReleaseSteps: [1],
        phaseTargets: [
          {
            phase: "before",
            entityIds: ["xiuxin", "medic"],
            authorIntent: "铺普通流程",
            expectationMovement: "加深固有认知",
          },
          {
            phase: "during",
            entityIds: ["xiuxin", "medic"],
            authorIntent: "让异常进入观察",
            expectationMovement: "推进认知差",
          },
          {
            phase: "after",
            entityIds: ["medic"],
            authorIntent: "承接重新估值",
            expectationMovement: "留下向上传播期待",
          },
        ],
        realityQuestion: "医疗忍者实际怎样处理异常",
        observableStart: "秀信开始训练",
        expectedChange: "产生可裁决的新事实",
        readerExpectation: "等待专业人物真实处理",
      },
    ],
    directorAuthority: "author-defined-story-line",
    characterExecutionRule: "characterization-constrained-performance",
    digest: "story-unit:digest",
  };
}

function arbitration(): WorldArbitrationReceipt {
  return {
    version: "world-arbitration-receipt.v1",
    authority: "speculative",
    projectId: "p1",
    generationId: "g1",
    round: 1,
    storyUnitDesignDigest: "story-unit:digest",
    storyUnitEventId: "event:test",
    realityFingerprint: "r1",
    worldContextDigest: "world:digest",
    proposalDigests: ["proposal:1"],
    resolutions: [
      {
        agentId: "agent:xiuxin",
        characterId: "xiuxin",
        characterName: "秀信",
        proposalDigest: "proposal:1",
        decision: "继续训练",
        intendedAction: "完成恢复训练",
        actionOrder: 1,
        outcome: "success",
        immediateResult: "训练表现异常稳定",
        stateAfter: "异常进入医疗忍者观察范围",
        butterflyEffects: [],
        conflictIds: [],
      },
    ],
    conflicts: [],
    hardContractStatus: "feasible",
    hardContractConflicts: [],
    protagonistProjection: null,
    finalized: true,
    generatedAt: null,
    digest: "arb:digest",
  };
}

describe("StorySceneExpansionService", () => {
  it("uses the lecturer Node-to-Scene method instead of replaying simulation logs", async () => {
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-scene-expansion");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("主线化为节点");
          expect(serialized).toContain("每个节点都有一个问题");
          expect(serialized).toContain("硬 Reality");
          expect(serialized).toContain("不能把 arbitration 抬成上位编剧权");
          expect(serialized).toContain("震惊、后悔、投靠");
          const checked = validate({
            scenes: [
              {
                id: "scene:before",
                order: 1,
                phase: "before",
                title: "普通流程",
                participantEntityIds: ["xiuxin", "medic"],
                locationObjectId: null,
                localProblem: "医疗忍者仍按普通流程处理",
                pressure: "异常尚未被专业确认",
                observableStart: "常规检查开始",
                interaction: "秀信提出训练，医疗忍者观察",
                informationMove: "Reader知道潜力，医疗忍者未知",
                expectationMove: "加深固有认知",
                projectedRealityUse: "使用秀信继续训练的仲裁结果",
                endState: "专业观察建立",
                nextSceneCause: "训练表现开始偏离普通标准",
              },
              {
                id: "scene:during",
                order: 2,
                phase: "during",
                title: "异常进入眼前",
                participantEntityIds: ["xiuxin", "medic"],
                locationObjectId: null,
                localProblem: "异常是否真实",
                pressure: "专业常识与眼前结果冲突",
                observableStart: "异常结果出现",
                interaction: "医疗忍者复核",
                informationMove: "医疗忍者开始确认异常",
                expectationMove: "把认知差推到兑现边缘",
                projectedRealityUse: "不改写仲裁，只展开已投影结果",
                endState: "异常被确认",
                nextSceneCause: "确认后必须重新处理秀信",
              },
              {
                id: "scene:after",
                order: 3,
                phase: "after",
                title: "重新估值",
                participantEntityIds: ["medic"],
                locationObjectId: null,
                localProblem: "如何处理超出普通流程的伤员",
                pressure: "旧流程无法解释新事实",
                observableStart: "复核成立",
                interaction: "医疗忍者重新安排处理",
                informationMove: "第一层重新估值出现，更高层仍未知",
                expectationMove: "局部兑现并种下下一层期待",
                projectedRealityUse: "承接仲裁后的状态，不重写人物决定",
                endState: "新的专业处理位置形成",
                nextSceneCause: null,
              },
            ],
          });
          if (!checked.success) throw new Error(checked.issues.join("; "));
          return {
            value: checked.data,
            usage,
            mode: "native" as const,
            attempts: 1,
          };
        },
      ),
    };

    const result = await new StorySceneExpansionService(model).expand(
      run,
      step,
      {
        storyUnit: storyUnit(),
        storyUnitEventId: "event:test",
        arbitration: arbitration(),
        request: "把这个问题节点展开成多个场景",
      },
      new AbortController().signal,
    );

    expect(result.value.scenes).toHaveLength(3);
    expect(result.value.scenes.map((scene) => scene.phase)).toEqual([
      "before",
      "during",
      "after",
    ]);
  });
});
