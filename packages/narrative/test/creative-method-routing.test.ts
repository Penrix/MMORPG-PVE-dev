import type { StoryObjectField } from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import { describe, expect, it, vi } from "vitest";

import type { NarrativeModelClient } from "../src/model-client.js";
import {
  CreativeOperatorInvocationService,
  StoryAuthoringService,
  finalizeStoryCreativeContext,
  finalizeStoryCreativeFrameContext,
  finalizeStoryObjectField,
  storyObjectSurfaceRef,
  module2CreativeOperatorDefinitions,
} from "../src/index.js";

const usage: RunBudgetUsage = {
  inputTokens: 100,
  outputTokens: 50,
  calls: 1,
  costUsd: 0,
  wallTimeMs: 5,
};

const run = { projectId: "p1" } as NarrativeRun;
const step = { id: "method-route-step" } as NarrativeRunStep;

function field(): StoryObjectField {
  return finalizeStoryObjectField({
    version: "story-object-field.v1",
    authority: "speculative",
    projectId: "p1",
    scale: "S03",
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

function context(currentField: StoryObjectField) {
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
      currentState: "普通重伤忍者，尚未重新取得高价任务资格",
      currentGoal: "恢复战斗力并重新进入任务体系",
      upgradeNeed: "取得可信专业估值",
      activeMove: "主动训练基础忍术，让结果进入医疗复核链",
      focusObjectIds: currentField.objects.map((object) => object.id),
      advantageRefs: ["world-reality:xiuxin"],
      assetRefs: [],
    },
    methodInvocations: [],
    materialSelections: [],
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
    ],
  };
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

function readySearchDraft(currentField: StoryObjectField) {
  return {
    status: "READY" as const,
    question: "医院期还有哪些机制不同的可玩关系？",
    objectFocus: [
      {
        objectId: "object:medic",
        surfaceRefs: [surfaceRef(currentField, "object:medic", "duty")],
        whyNow: "医疗忍者正在处理秀信",
        valuableSurface: "专业权限与重新估值入口",
      },
    ],
    seeds: [
      {
        id: "seed:hospital-branch",
        title: "专业估值继续变价",
        anchorObjectIds: ["object:xiuxin", "object:medic"],
        groundingSurfaceRefs: [
          surfaceRef(currentField, "object:xiuxin", "location"),
          surfaceRef(currentField, "object:medic", "duty"),
        ],
        observation: "两人已经在同一医疗处理链",
        searchMove: "从当前人物行动继续追升级、人物下一手与Reader等待",
        idea: "让真实复核动作把普通医疗关系推向更贵的专业估值",
        protagonistHook: "秀信主动让训练结果进入专业观察",
        readerValue: "Reader能看见价格正在被重新评估",
        newRelationOrChange: "医疗关系出现可升级的专业定价接口",
        candidateNewObjects: [],
        nextQuestion: "谁会基于这次结果继续下注",
        status: "CANDIDATE" as const,
      },
    ],
    worldGaps: [],
    scaleResult: {
      scale: "S03" as const,
      periodFocus: "病房恢复与专业重新估值",
      opportunityField: [
        {
          objectIds: ["object:xiuxin", "object:medic"],
          opportunity: "已有复核关系可以继续变价",
          whyAlive: "两人当前就在同一Reality处理链",
        },
      ],
      storyMovements: [],
    },
  };
}

describe("M-series creative operator runtime", () => {
  it("keeps M01B embedded while exposing other methods as Module-2 operators", () => {
    const ids = module2CreativeOperatorDefinitions({
      materials: [],
      hasPriorStoryState: false,
    }).map((method) => method.methodId);

    expect(ids).toContain("m01a-playability");
    expect(ids).toContain("m02-six-chain");
    expect(ids).toContain("m04-mature-story-prototype");
    expect(ids).not.toContain("m01b-three-consciousness");
    expect(ids).not.toContain("m03-compose");
    expect(ids).not.toContain("m05-play-variation");
  });

  it("invokes a named Module-2 operator explicitly without automatic routing", () => {
    const currentField = field();
    const result = new CreativeOperatorInvocationService().invoke({
      field: currentField,
      creativeContext: context(currentField),
      upgradeLedger: upgradeLedger(),
      methodId: "m02-six-chain",
      purpose: "当前答案太像，改一次搜索运动",
      inputObjectIds: ["object:xiuxin", "object:medic"],
    });

    expect(result.definition.placement).toBe("module2-operator");
    expect(result.invocation.methodId).toBe("m02-six-chain");
    expect(result.creativeContext.methodInvocations).toHaveLength(1);
  });

  it("rejects M01B as a callable operator because it is embedded in Module 3", () => {
    const currentField = field();
    expect(() =>
      new CreativeOperatorInvocationService().invoke({
        field: currentField,
        creativeContext: context(currentField),
        upgradeLedger: upgradeLedger(),
        methodId: "m01b-three-consciousness",
        purpose: "不应这样调用",
        inputObjectIds: ["object:xiuxin"],
      }),
    ).toThrow("creative_operator.embedded_not_callable");
  });

  it("runs Story Search with embedded M01B and does not auto-pick an operator", async () => {
    const currentField = field();
    const creativeContext = context(currentField);
    let calls = 0;
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          calls += 1;
          expect(purpose).toBe("story-object-grounded-search");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("M01B不是可选methodInvocation");
          expect(serialized).toContain("embedded-always-on");
          expect(serialized).toContain("upgradeFront");
          expect(serialized).toContain("actorFront");
          expect(serialized).toContain("readerFront");
          const checked = validate(readySearchDraft(currentField));
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

    const result = await new StoryAuthoringService(model).searchWithCreativeMethods(
      run,
      step,
      {
        field: currentField,
        creativeContext,
        upgradeLedger: upgradeLedger(),
        request: "沿当前医院故事继续往深处挖",
        readerNeed: "看低位人物被重新估值",
        targetEmotion: "得意",
        protagonistProfile: "秀信：主动用真实成果打开入口",
      },
      new AbortController().signal,
    );

    expect(calls).toBe(1);
    expect(result.routing.plan.mode).toBe("manual");
    expect(result.routing.plan.selections).toHaveLength(0);
    expect(result.routing.creativeContext.methodInvocations).toHaveLength(0);
  });

  it("preserves an explicitly invoked operator inside Story Search", async () => {
    const currentField = field();
    const invoked = new CreativeOperatorInvocationService().invoke({
      field: currentField,
      creativeContext: context(currentField),
      upgradeLedger: upgradeLedger(),
      methodId: "m02-six-chain",
      purpose: "改变当前局部搜索运动",
      inputObjectIds: ["object:xiuxin", "object:medic"],
    });

    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-object-grounded-search");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("m02-six-chain");
          expect(serialized).toContain("按需显式调用的算子");
          expect(serialized).toContain("M01B不是可选methodInvocation");
          const checked = validate(readySearchDraft(currentField));
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

    const result = await new StoryAuthoringService(model).searchWithCreativeMethods(
      run,
      step,
      {
        field: currentField,
        creativeContext: invoked.creativeContext,
        upgradeLedger: upgradeLedger(),
        request: "这次明确用M02继续发散",
        readerNeed: "看低位人物被重新估值",
        targetEmotion: "得意",
        protagonistProfile: "秀信：主动用真实成果打开入口",
      },
      new AbortController().signal,
    );

    expect(result.routing.plan.selections).toHaveLength(1);
    expect(result.routing.plan.selections[0]?.invocation.methodId).toBe(
      "m02-six-chain",
    );
    expect(result.search.value.seeds).toHaveLength(1);
  });
});
