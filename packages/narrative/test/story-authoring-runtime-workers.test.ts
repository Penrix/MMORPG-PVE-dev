import type { ExpectationDesign, StoryObjectField } from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import { describe, expect, it, vi } from "vitest";

import type { NarrativeModelClient } from "../src/model-client.js";
import {
  StoryAuthoringService,
  finalizeExpectationDesign,
  finalizeStoryCreativeContext,
  finalizeStoryCreativeFrameContext,
  finalizeStoryObjectField,
  storyObjectSurfaceRef,
} from "../src/index.js";

const usage: RunBudgetUsage = {
  inputTokens: 200,
  outputTokens: 120,
  calls: 1,
  costUsd: 0,
  wallTimeMs: 12,
};
const run = { projectId: "p1" } as NarrativeRun;
const step = { id: "story-authoring-step" } as NarrativeRunStep;

function field(scale: StoryObjectField["scale"]): StoryObjectField {
  return finalizeStoryObjectField({
    version: "story-object-field.v1",
    authority: "speculative",
    projectId: "p1",
    scale,
    storyTimeLabel: "第三次忍界大战前后",
    realityFingerprint: "r1",
    storyStateFingerprint: "s1",
    objects: [
      {
        id: "object:xiuxin",
        entityId: "xiuxin",
        name: "秀信",
        kind: "character",
        aliases: [],
        surfaces: [
          {
            authority: "confirmed",
            sourceId: "world-reality:xiuxin",
            facet: "state",
            slotKey: "location",
            value: "木叶医院",
          },
        ],
        sourceRefs: ["world-reality:xiuxin"],
      },
      {
        id: "object:medic",
        entityId: "medic",
        name: "医疗忍者",
        kind: "character",
        aliases: [],
        surfaces: [
          {
            authority: "confirmed",
            sourceId: "world-reality:medic",
            facet: "state",
            slotKey: "duty",
            value: "负责伤员复核",
          },
        ],
        sourceRefs: ["world-reality:medic"],
      },
    ],
  });
}

function surfaceRef(
  currentField: StoryObjectField,
  objectId: string,
  slotKey: string,
): string {
  const object = currentField.objects.find((item) => item.id === objectId)!;
  const surface = object.surfaces.find((item) => item.slotKey === slotKey)!;
  return storyObjectSurfaceRef(object.id, surface);
}

function creativeContext(currentField: StoryObjectField) {
  const frame = finalizeStoryCreativeFrameContext({
    version: "story-creative-frame.v1",
    projectId: "p1",
    targetOutlineNodeId: "arc:hospital",
    currentFrame: {
      outlineNodeId: "arc:hospital",
      parentId: "book:1",
      kind: "arc",
      ordinal: 1,
      title: "木叶医院期",
      summary: "秀信从重伤状态重新进入忍者体系",
      goal: "恢复并取得更高任务入口",
      conflict: null,
      outcome: null,
      storyTime: "第三次忍界大战前后",
      metadata: {},
    },
    parentFrames: [
      {
        outlineNodeId: "book:1",
        parentId: null,
        kind: "book",
        ordinal: 0,
        title: "火影长篇",
        summary: "秀信一路升级进入忍界顶层",
        goal: "成为忍界最强层级之一",
        conflict: null,
        outcome: null,
        storyTime: null,
        metadata: {},
      },
    ],
    previousSiblingFrames: [],
  });
  return finalizeStoryCreativeContext({
    version: "story-creative-context.v1",
    authority: "speculative",
    projectId: "p1",
    frame,
    protagonistCamera: {
      version: "story-protagonist-camera.v1",
      projectId: "p1",
      protagonistEntityId: "xiuxin",
      currentLocation: "木叶医院",
      currentState: "普通重伤忍者，正在恢复，尚未重新取得高价任务资格",
      currentGoal: "恢复战斗力并重新进入任务体系",
      upgradeNeed: "从普通伤员升级为值得高价忍者圈重新估值的人",
      activeMove: "主动用基础忍术训练恢复，并让真实结果进入专业复核链",
      focusObjectIds: currentField.objects.map((object) => object.id),
      advantageRefs: ["world-reality:xiuxin"],
      assetRefs: [],
    },
    methodInvocations: [
      {
        id: "method:m03:story",
        methodFamily: "M03",
        methodId: "M03-recall",
        sourceRef: "Penrix/male-webnovel-cognition/database/m03",
        scope: "story",
        purpose: "从当前世界对象寻找更昂贵的人物互动玩法",
        inputObjectIds: currentField.objects.map((object) => object.id),
        instruction: "只对当前人物和关系做迁移、组合与变奏，不新增功能NPC。",
      },
    ],
  });
}

function expectation(): ExpectationDesign {
  return finalizeExpectationDesign({
    version: "expectation-design.v1",
    authority: "speculative",
    projectId: "p1",
    protagonistId: "xiuxin",
    readerNeed: "看到低位人物被重新估值",
    targetEmotion: "得意",
    targetOutcome: "异常价值进入更高圈层",
    scarcityIntents: [
      {
        claim: "普通伤员很难体现高价战斗价值",
        subjectRef: null,
        existingEvidenceRefs: ["world-reality:medic"],
        evidenceToEstablish: [],
      },
    ],
    beliefIntents: [
      {
        proposition: "秀信只是普通伤员",
        scope: "character",
        holderEntityIds: ["medic"],
        existingEvidenceRefs: ["world-reality:medic"],
        stakeToCultivate: [],
        breakCondition: "看到不可否认的异常",
      },
    ],
    protagonistAdvantageRefs: ["world-reality:xiuxin"],
    reactionTargetEntityIds: ["medic"],
    retainedGainTarget: "更高任务入口",
    activationEntityIds: ["medic"],
    worldFocusRefs: ["world-reality:medic"],
    designReasons: ["先让专业旧认知成立"],
    realityFingerprint: "r1",
    storyStateFingerprint: "s1",
    directorMayDesignReactionPayoff: true,
    mustGroundPerformanceInCharacterization: true,
  });
}

function upgradeLedger() {
  return {
    protagonistEntityId: "xiuxin",
    road: "从医院低位伤员进入木叶高价任务圈",
    currentStepId: "step:professional-reprice",
    currentPosition: "普通重伤忍者",
    stageGoal: "让异常能力获得第一层专业重新估值",
    settlementTarget: "拿到更高任务圈入口",
    steps: [
      {
        id: "step:professional-reprice",
        title: "专业重新估值",
        targetGain: "医疗与任务体系的新评级",
        gate: "先打破普通伤员的固有认知",
        targetCircle: "医疗与任务审核圈",
      },
      {
        id: "step:elite-mission",
        title: "进入高价任务圈",
        targetGain: "上忍级任务机会",
        gate: "用第一层评级换真实任务",
        targetCircle: "上忍与高价任务圈",
      },
    ],
  };
}

describe("StoryAuthoringService", () => {
  it("searches S03 only on concrete Object Field objects", async () => {
    const objectField = field("S03");
    const context = creativeContext(objectField);
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-object-grounded-search");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("所有想象和脑洞必须先有想象对象");
          expect(serialized).toContain("S01/S02/S03 不是三台独立故事生成器");
          expect(serialized).toContain("candidateNewObjects 必须为空");
          expect(serialized).toContain("step:professional-reprice");
          expect(serialized).toContain("object:xiuxin");
          expect(serialized).toContain("world-reality:medic");
          expect(serialized).toContain("protagonistCamera");
          expect(serialized).toContain("methodInvocations");
          expect(serialized).toContain("activeMove");
          const checked = validate({
            status: "READY",
            question: "病房期哪些对象值得继续玩？",
            objectFocus: [
              {
                objectId: "object:medic",
                surfaceRefs: [surfaceRef(objectField, "object:medic", "duty")],
                whyNow: "医疗忍者正在处理秀信",
                valuableSurface: "专业认知与复核权限",
              },
            ],
            seeds: [
              {
                id: "seed:recheck",
                title: "专业复核把异常变贵",
                anchorObjectIds: ["object:xiuxin", "object:medic"],
                groundingSurfaceRefs: [
                  surfaceRef(objectField, "object:xiuxin", "location"),
                  surfaceRef(objectField, "object:medic", "duty"),
                ],
                observation: "秀信与医疗忍者已经处于同一现实处理链",
                searchMove: "把能力异常与专业复核权限交叉",
                idea: "异常不靠随机高手，而先进入可信专业识货链",
                protagonistHook: "秀信继续完成自己的恢复训练",
                readerValue: "低位人物的能力被可信专业体系重新定价",
                newRelationOrChange: "医疗处理关系可能变成价值识别关系",
                candidateNewObjects: [],
                nextQuestion: "什么复核结果足以触发更高层传播",
                status: "CANDIDATE",
              },
            ],
            worldGaps: [],
            scaleResult: {
              scale: "S03",
              periodFocus: "病房恢复与第一次可信识货",
              opportunityField: [
                {
                  objectIds: ["object:xiuxin", "object:medic"],
                  opportunity: "异常恢复结果进入专业复核",
                  whyAlive: "两人当前就在同一医疗流程中",
                },
              ],
              storyMovements: [
                {
                  id: "movement:recheck",
                  name: "医疗复核重新估价",
                  objectIds: ["object:xiuxin", "object:medic"],
                  state: "主导",
                  currentMotion: "医疗忍者正在处理秀信的恢复",
                  nextPressure: "是否按规则升级复核",
                },
              ],
            },
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

    const result = await new StoryAuthoringService(model).search(
      run,
      step,
      {
        field: objectField,
        creativeContext: context,
        upgradeLedger: upgradeLedger(),
        request: "寻找当前这一阵子真正值得玩的故事机会",
        readerNeed: "看低位人物凭真实能力被重新估值",
        targetEmotion: "得意",
        protagonistProfile: "秀信：低位、主动、用基础能力解决现实问题",
      },
      new AbortController().signal,
    );

    expect(result.value.scaleResult.scale).toBe("S03");
    expect(result.value.seeds[0]!.anchorObjectIds).toEqual([
      "object:xiuxin",
      "object:medic",
    ]);
    expect(result.value.authority).toBe("speculative");
  });

  it("designs S04 as a writers room before Character Agent runtime", async () => {
    const objectField = field("S04");
    const exp = expectation();
    const context = creativeContext(objectField);
    const sourceSearch = {
      version: "story-authoring-search.v1" as const,
      authority: "speculative" as const,
      status: "READY" as const,
      projectId: "p1",
      scale: "S03" as const,
      objectFieldDigest: "prior-field",
      creativeContextDigest: context.digest,
      question: "上一层机会",
      objectFocus: [],
      seeds: [
        {
          id: "seed:recheck",
          title: "专业复核",
          anchorObjectIds: ["object:xiuxin", "object:medic"],
          groundingSurfaceRefs: [
            surfaceRef(objectField, "object:xiuxin", "location"),
            surfaceRef(objectField, "object:medic", "duty"),
          ],
          observation: "两人正在同一医疗流程",
          searchMove: "能力异常 × 专业复核",
          idea: "先进入可信识货链",
          protagonistHook: "秀信继续恢复训练",
          readerValue: "重新估值",
          newRelationOrChange: "医疗关系变化",
          candidateNewObjects: [],
          nextQuestion: "如何编成一出戏",
          status: "CANDIDATE" as const,
        },
      ],
      worldGaps: [],
      scaleResult: {
        scale: "S03" as const,
        periodFocus: "病房期",
        opportunityField: [
          {
            objectIds: ["object:xiuxin", "object:medic"],
            opportunity: "专业复核",
            whyAlive: "当前就在发生",
          },
        ],
        storyMovements: [],
      },
      digest: "search:digest",
    };

    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-unit-design");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("小说不是世界自转后的监控录像");
          expect(serialized).toContain("Cast Pool");
          expect(serialized).toContain("Active Seed");
          expect(serialized).toContain("配角反应是爽点");
          expect(serialized).toContain("stakeLedger");
          expect(serialized).toContain("Upgrade Ledger");
          expect(serialized).toContain("Creative Frame");
          expect(serialized).toContain("Protagonist Camera");
          expect(serialized).toContain("methodInvocations");
          const checked = validate({
            status: "READY",
            objectAnchorIds: ["object:xiuxin", "object:medic"],
            groundingSurfaceRefs: [
              surfaceRef(objectField, "object:xiuxin", "location"),
              surfaceRef(objectField, "object:medic", "duty"),
            ],
            storyProblem: "让秀信的异常第一次进入可信专业识货链",
            worldGaps: [],
            campNetwork: [
              {
                entityId: "xiuxin",
                camp: "友方",
                currentGoal: "恢复",
                storyRole: "主角行动来源",
                currentBelief: "自己的训练有效",
                currentInterest: "恢复战斗力并重新获得任务价值",
              },
              {
                entityId: "medic",
                camp: "中立",
                currentGoal: "按规则处理伤员",
                storyRole: "专业定价",
                currentBelief: "秀信是普通伤员",
                currentInterest: "维护自己的专业判断与资源配置准确性",
              },
            ],
            stakeLedger: [
              {
                id: "stake:medic-rating",
                entityId: "medic",
                currentBelief: "秀信是普通伤员",
                currentInterest: "维护专业判断与医疗资源配置",
                stakeAction: "继续按普通伤员标准处理并给出专业评级",
                stakeAssets: ["专业判断", "资源配置"],
                commitmentCost: "改判意味着承认此前估值不足",
                escalationPlan: "异常持续时进行更严格复核并留下记录",
                payoffReaction: "亲自改判秀信的专业价值",
                settlementChange: "秀信获得第一层可信专业估值",
                state: "committed",
              },
            ],
            reactionTargets: [
              {
                entityId: "medic",
                before: "普通估值",
                during: "看到异常后自行判断",
                after: "目标是重新估值，不写死具体反应",
              },
            ],
            campTransitions: [],
            appearanceOrderEntityIds: ["xiuxin", "medic"],
            informationRelease: [
              {
                step: 1,
                readerKnows: "秀信训练有效",
                charactersKnow: "医疗忍者只知道眼前结果",
                withheld: "后续传播尚未发生",
                purpose: "建立认知差",
              },
            ],
            events: [
              {
                id: "event:recovery-test",
                title: "恢复测试",
                purpose: "让异常进入专业见证",
                problem: "秀信的异常恢复表现是否会改变医疗忍者对他的专业估值",
                storyPressure: "普通伤员认知与眼前异常结果开始正面冲突",
                castPoolEntityIds: ["xiuxin", "medic"],
                activeSeedEntityIds: ["xiuxin"],
                actorPressures: [
                  {
                    entityId: "xiuxin",
                    pressure: "恢复期内必须判断当前身体能否承受继续训练",
                  },
                  {
                    entityId: "medic",
                    pressure: "按医疗职责处理眼前出现的异常恢复表现",
                  },
                ],
                stakeEntryIds: ["stake:medic-rating"],
                reactionTargetEntityIds: ["medic"],
                informationReleaseSteps: [1],
                phaseTargets: [
                  {
                    phase: "before",
                    entityIds: ["xiuxin", "medic"],
                    authorIntent: "先让普通伤员流程与恢复压力成立",
                    expectationMovement: "加深 Reader 对专业固有认知的把握",
                  },
                  {
                    phase: "during",
                    entityIds: ["xiuxin", "medic"],
                    authorIntent: "让异常表现真正进入专业观察",
                    expectationMovement: "把认知差推到眼前",
                  },
                  {
                    phase: "after",
                    entityIds: ["medic"],
                    authorIntent: "承接重新估值与后续传播可能",
                    expectationMovement: "留下更高层识货链的下一笔期待",
                  },
                ],
                realityQuestion:
                  "按当前医疗规则与人物认知，医疗忍者实际会怎样处理这个异常",
                observableStart: "秀信开始训练",
                expectedChange: "产生可被 Reality 裁决的新事实",
                readerExpectation: "等医疗忍者真实处理异常",
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

    const result = await new StoryAuthoringService(model).designStoryUnit(
      run,
      step,
      {
        field: objectField,
        creativeContext: context,
        sourceSearch,
        sourceSeedIds: ["seed:recheck"],
        expectationDesign: exp,
        upgradeLedger: upgradeLedger(),
        request: "把这颗机会编成第一出真正值得看的故事",
      },
      new AbortController().signal,
    );

    expect(result.value.events[0]!.activeSeedEntityIds).toEqual(["xiuxin"]);
    expect(result.value.directorAuthority).toBe("author-defined-story-line");
    expect(result.value.stakeLedger[0]?.stakeAction).toContain("普通伤员");
    expect(result.value.authority).toBe("speculative");
  });
});
