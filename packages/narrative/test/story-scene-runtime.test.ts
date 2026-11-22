import type {
  StoryUnitDesign,
  WorldArbitrationReceipt,
} from "@narralume/contracts";
import { describe, expect, it } from "vitest";

import { finalizeStorySceneExpansion } from "../src/story-authoring-runtime.js";

function storyUnit(): StoryUnitDesign {
  return {
    version: "story-unit-design.v1",
    authority: "speculative",
    status: "READY",
    projectId: "p1",
    objectFieldDigest: "field:digest",
    sourceSeedIds: ["seed:recheck"],
    expectationDesignDigest: "expectation:digest",
    objectAnchorIds: ["object:xiuxin", "object:medic"],
    groundingSurfaceRefs: ["surface:xiuxin", "surface:medic"],
    storyProblem: "让秀信的异常第一次进入可信专业识货链",
    worldGaps: [],
    campNetwork: [
      {
        entityId: "xiuxin",
        camp: "友方",
        currentGoal: "恢复",
        storyRole: "主角行动来源",
        currentBelief: "自己的训练有效",
      },
      {
        entityId: "medic",
        camp: "中立",
        currentGoal: "按规则处理伤员",
        storyRole: "专业定价",
        currentBelief: "秀信只是普通伤员",
      },
    ],
    reactionTargets: [
      {
        entityId: "medic",
        before: "按普通伤员估值",
        during: "看到异常后自行判断",
        after: "目标是重新估值，不强迫具体反应",
      },
    ],
    campTransitions: [],
    appearanceOrderEntityIds: ["xiuxin", "medic"],
    informationRelease: [
      {
        step: 1,
        readerKnows: "秀信的控制异常",
        charactersKnow: "医疗忍者只看到当前表现",
        withheld: "后续传播尚未发生",
        purpose: "建立认知差",
      },
    ],
    events: [
      {
        id: "event:recovery-test",
        title: "病房恢复测试",
        purpose: "让异常第一次进入可信见证",
        problem: "秀信的异常恢复表现是否会改变医疗忍者对他的专业估值",
        storyPressure: "普通伤员认知与眼前异常结果开始正面冲突",
        castPoolEntityIds: ["xiuxin", "medic"],
        activeSeedEntityIds: ["xiuxin"],
        actorPressures: [
          {
            entityId: "xiuxin",
            pressure: "恢复训练正在暴露自己的真实控制水平",
          },
          {
            entityId: "medic",
            pressure: "眼前恢复结果开始超出普通伤员流程",
          },
        ],
        reactionTargetEntityIds: ["medic"],
        informationReleaseSteps: [1],
        phaseTargets: [
          {
            phase: "before",
            entityIds: ["xiuxin", "medic"],
            authorIntent: "先让普通流程与恢复压力成立",
            expectationMovement: "加深专业固有认知",
          },
          {
            phase: "during",
            entityIds: ["xiuxin", "medic"],
            authorIntent: "让异常真正进入专业观察",
            expectationMovement: "把认知差推到眼前",
          },
          {
            phase: "after",
            entityIds: ["medic"],
            authorIntent: "承接重新估值与后续传播",
            expectationMovement: "留下更高层识货链期待",
          },
        ],
        realityQuestion: "医疗忍者实际会怎样处理这个异常",
        observableStart: "秀信开始恢复训练",
        expectedChange: "产生可被 Reality 裁决的新事实",
        readerExpectation: "等待专业人物如何真实处理异常",
      },
    ],
    mustPreserveAgentAutonomy: true,
    digest: "story-unit:digest",
  };
}

function arbitration(): WorldArbitrationReceipt {
  return {
    version: "world-arbitration-receipt.v1",
    authority: "speculative",
    projectId: "p1",
    generationId: "generation:1",
    round: 1,
    storyUnitDesignDigest: "story-unit:digest",
    storyUnitEventId: "event:recovery-test",
    realityFingerprint: "reality:1",
    worldContextDigest: "world-context:digest",
    proposalDigests: ["proposal:xiuxin", "proposal:medic"],
    resolutions: [
      {
        agentId: "agent:xiuxin",
        characterId: "xiuxin",
        characterName: "秀信",
        proposalDigest: "proposal:xiuxin",
        decision: "继续完成恢复训练",
        intendedAction: "展示稳定而异常的控制结果",
        actionOrder: 1,
        outcome: "success",
        immediateResult: "训练结果明显超过普通恢复标准",
        stateAfter: "异常表现进入医疗忍者的直接观察",
        butterflyEffects: [],
        conflictIds: [],
      },
      {
        agentId: "agent:medic",
        characterId: "medic",
        characterName: "医疗忍者",
        proposalDigest: "proposal:medic",
        decision: "按专业流程复核",
        intendedAction: "重新检查秀信的恢复与控制表现",
        actionOrder: 2,
        outcome: "success",
        immediateResult: "医疗忍者确认结果确实异常",
        stateAfter: "医疗忍者必须重新判断秀信的价值",
        butterflyEffects: [],
        conflictIds: [],
      },
    ],
    conflicts: [],
    hardContractStatus: "feasible",
    hardContractConflicts: [],
    protagonistProjection: null,
    finalized: true,
    generatedAt: "2026-11-22T00:00:00.000Z",
    digest: "arbitration:digest",
  };
}

describe("S06 story scene expansion", () => {
  it("expands one S05 problem node into multiple before/during/after scenes", () => {
    const result = finalizeStorySceneExpansion(
      {
        version: "story-scene-expansion.v1",
        authority: "speculative",
        projectId: "p1",
        storyUnitDesignDigest: "story-unit:digest",
        storyUnitEventId: "event:recovery-test",
        arbitrationDigest: "arbitration:digest",
        eventProblem:
          "秀信的异常恢复表现是否会改变医疗忍者对他的专业估值",
        scenes: [
          {
            id: "scene:before",
            order: 1,
            phase: "before",
            title: "普通伤员流程",
            participantEntityIds: ["xiuxin", "medic"],
            locationObjectId: null,
            localProblem: "医疗忍者仍按普通恢复流程处理秀信",
            pressure: "秀信若表现平常，就不会进入更高估值",
            observableStart: "医疗忍者按常规流程检查",
            interaction: "秀信提出继续训练，医疗忍者按职责观察",
            informationMove: "Reader知道异常潜力，医疗忍者尚未确认",
            expectationMove: "固有认知继续被铺实",
            projectedRealityUse: "使用仲裁前提：秀信确实继续训练",
            endState: "训练正式开始，专业观察建立",
            nextSceneCause: "训练结果开始明显偏离普通恢复标准",
          },
          {
            id: "scene:during",
            order: 2,
            phase: "during",
            title: "异常进入眼前",
            participantEntityIds: ["xiuxin", "medic"],
            locationObjectId: null,
            localProblem: "医疗忍者必须判断眼前异常是否真实",
            pressure: "专业常识与直接观察发生冲突",
            observableStart: "秀信做出异常稳定的控制结果",
            interaction: "医疗忍者重新检查并排除普通误差",
            informationMove: "医疗忍者从不知道变成亲眼确认",
            expectationMove: "认知差从铺垫进入兑现边缘",
            projectedRealityUse: "严格使用仲裁给出的成功训练与复核结果",
            endState: "异常被专业确认，但尚未向更高层传播",
            nextSceneCause: "确认异常后必须决定如何重新处理秀信",
          },
          {
            id: "scene:after",
            order: 3,
            phase: "after",
            title: "重新估值",
            participantEntityIds: ["medic"],
            locationObjectId: null,
            localProblem: "医疗忍者如何处理一个超出普通流程的伤员",
            pressure: "若继续按旧估值处理，就与自己刚确认的事实冲突",
            observableStart: "复核结果已经成立",
            interaction: "医疗忍者根据专业职责重新安排后续处理",
            informationMove: "Reader看到第一层重新估值，但更高层仍未知情",
            expectationMove: "本节点局部兑现，同时留下向上识货链的新期待",
            projectedRealityUse: "不改写仲裁，只展开医疗忍者已确认异常后的现实后果",
            endState: "秀信获得新的专业处理位置",
            nextSceneCause: null,
          },
        ],
      },
      storyUnit(),
      arbitration(),
    );

    expect(result.scenes).toHaveLength(3);
    expect(result.scenes.map((scene) => scene.phase)).toEqual([
      "before",
      "during",
      "after",
    ]);
    expect(result.authority).toBe("speculative");
  });

  it("rejects scene plans that skip an authored phase target", () => {
    const unit = storyUnit();
    expect(() =>
      finalizeStorySceneExpansion(
        {
          version: "story-scene-expansion.v1",
          authority: "speculative",
          projectId: "p1",
          storyUnitDesignDigest: unit.digest,
          storyUnitEventId: "event:recovery-test",
          arbitrationDigest: "arbitration:digest",
          eventProblem:
            "秀信的异常恢复表现是否会改变医疗忍者对他的专业估值",
          scenes: [
            {
              id: "scene:during",
              order: 1,
              phase: "during",
              title: "只写高潮",
              participantEntityIds: ["xiuxin", "medic"],
              locationObjectId: null,
              localProblem: "直接看异常",
              pressure: "认知冲突",
              observableStart: "异常已经出现",
              interaction: "医疗忍者检查",
              informationMove: "直接确认",
              expectationMove: "跳过铺垫",
              projectedRealityUse: "使用仲裁结果",
              endState: "异常被确认",
              nextSceneCause: null,
            },
          ],
        },
        unit,
        arbitration(),
      ),
    ).toThrow("story_scene.missing_declared_phase:event:recovery-test:before");
  });

  it("does not expand an infeasible rehearsal into scenes", () => {
    expect(() =>
      finalizeStorySceneExpansion(
        {
          version: "story-scene-expansion.v1",
          authority: "speculative",
          projectId: "p1",
          storyUnitDesignDigest: "story-unit:digest",
          storyUnitEventId: "event:recovery-test",
          arbitrationDigest: "arbitration:broken",
          eventProblem:
            "秀信的异常恢复表现是否会改变医疗忍者对他的专业估值",
          scenes: [
            {
              id: "scene:invalid",
              order: 1,
              phase: "before",
              title: "错误展开",
              participantEntityIds: ["xiuxin", "medic"],
              locationObjectId: null,
              localProblem: "不应进入S06",
              pressure: "无",
              observableStart: "无",
              interaction: "无",
              informationMove: "无",
              expectationMove: "无",
              projectedRealityUse: "无",
              endState: "无",
              nextSceneCause: null,
            },
          ],
        },
        storyUnit(),
        {
          ...arbitration(),
          digest: "arbitration:broken",
          hardContractStatus: "infeasible",
          hardContractConflicts: ["当前Reality不允许这个行动"],
        },
      ),
    ).toThrow("story_scene.requires_feasible_finalized_rehearsal");
  });
});
