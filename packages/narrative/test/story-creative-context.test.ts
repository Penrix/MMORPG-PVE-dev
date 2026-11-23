import { createOutlineNode, type OutlineNode } from "@narralume/domain";
import { describe, expect, it } from "vitest";

import {
  assertStoryCreativeContextBound,
  buildStoryCreativeFrameContext,
  finalizeStoryCreativeContext,
  finalizeStoryCreativeFrameContext,
  finalizeStoryObjectField,
} from "../src/index.js";

const now = "2026-11-23T00:00:00.000Z";

function outlineFixture(): OutlineNode[] {
  const book = createOutlineNode({
    id: "book:1",
    projectId: "p1",
    parent: null,
    kind: "book",
    ordinal: 0,
    title: "火影长篇",
    goal: "秀信一路升级进入忍界顶层",
    now,
  });
  const volume = createOutlineNode({
    id: "volume:1",
    projectId: "p1",
    parent: book,
    kind: "volume",
    ordinal: 0,
    title: "木叶起步卷",
    goal: "从低位伤员重新进入高价忍者体系",
    now,
  });
  const previous = {
    ...createOutlineNode({
      id: "arc:0",
      projectId: "p1",
      parent: volume,
      kind: "arc",
      ordinal: 0,
      title: "病床开局",
      goal: "建立当前伤势与普通估值",
      outcome: "秀信开始恢复训练",
      now,
    }),
    status: "committed" as const,
  };
  const abandoned = {
    ...createOutlineNode({
      id: "arc:1",
      projectId: "p1",
      parent: volume,
      kind: "arc",
      ordinal: 1,
      title: "废弃路线",
      goal: "不应进入后续创作状态",
      now,
    }),
    status: "abandoned" as const,
  };
  const target = createOutlineNode({
    id: "arc:2",
    projectId: "p1",
    parent: volume,
    kind: "arc",
    ordinal: 2,
    title: "专业重新估值",
    goal: "让异常能力进入可信识货链",
    now,
  });
  return [book, volume, previous, abandoned, target];
}

describe("StoryCreativeFrameContext", () => {
  it("inherits parent frames and earlier same-level segments without a parallel S store", () => {
    const context = buildStoryCreativeFrameContext(outlineFixture(), "arc:2");

    expect(context.currentFrame.title).toBe("专业重新估值");
    expect(context.parentFrames.map((frame) => frame.outlineNodeId)).toEqual([
      "book:1",
      "volume:1",
    ]);
    expect(
      context.previousSiblingFrames.map((frame) => frame.outlineNodeId),
    ).toEqual(["arc:0"]);
    expect(context.previousSiblingFrames[0]?.outcome).toBe("秀信开始恢复训练");
    expect(context.digest.length).toBeGreaterThan(20);
  });

  it("rejects a broken parent chain instead of pretending S inheritance exists", () => {
    const context = buildStoryCreativeFrameContext(outlineFixture(), "arc:2");
    expect(() =>
      finalizeStoryCreativeFrameContext({
        version: "story-creative-frame.v1",
        projectId: "p1",
        targetOutlineNodeId: context.targetOutlineNodeId,
        currentFrame: context.currentFrame,
        parentFrames: [
          {
            ...context.parentFrames[0]!,
            parentId: "not-a-real-parent",
          },
          context.parentFrames[1]!,
        ],
        previousSiblingFrames: context.previousSiblingFrames,
      }),
    ).toThrow("story_creative_frame.invalid_parent_chain");
  });

  it("binds protagonist camera and cross-cutting methods to current Module-2 objects", () => {
    const frame = buildStoryCreativeFrameContext(outlineFixture(), "arc:2");
    const field = finalizeStoryObjectField({
      version: "story-object-field.v1",
      authority: "speculative",
      projectId: "p1",
      scale: "S04",
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
              value: "伤员复核",
            },
          ],
          sourceRefs: ["world-reality:medic"],
        },
      ],
    });
    const context = finalizeStoryCreativeContext({
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
        currentGoal: "重新进入忍者体系",
        upgradeNeed: "取得可信专业估值",
        activeMove: "主动训练并进入复核",
        focusObjectIds: ["object:xiuxin", "object:medic"],
        advantageRefs: ["world-reality:xiuxin"],
        assetRefs: [],
      },
      methodInvocations: [
        {
          id: "m03:story:1",
          methodFamily: "M03",
          methodId: "M03-recall",
          sourceRef: "Penrix/male-webnovel-cognition/database/m03",
          scope: "story",
          purpose: "寻找人物互动玩法",
          inputObjectIds: ["object:xiuxin", "object:medic"],
          instruction: "只在当前对象之间寻找可编剧关系。",
        },
      ],
    });

    expect(() =>
      assertStoryCreativeContextBound(context, field, {
        protagonistEntityId: "xiuxin",
        road: "忍界最强",
        currentStepId: "step:hospital",
        currentPosition: "普通重伤忍者，尚未进入高价任务圈",
        stageGoal: "得到专业重新估值",
        settlementTarget: "进入更高任务入口",
        steps: [
          {
            id: "step:hospital",
            title: "医院重新估值",
            targetGain: "专业评级",
            gate: "证明恢复与能力异常",
            targetCircle: "医疗与任务体系",
          },
        ],
      }),
    ).not.toThrow();

    const cameraWithoutProtagonist = {
      ...context,
      protagonistCamera: {
        ...context.protagonistCamera,
        focusObjectIds: ["object:medic"],
      },
    };
    expect(() =>
      assertStoryCreativeContextBound(cameraWithoutProtagonist, field, {
        protagonistEntityId: "xiuxin",
        road: "忍界最强",
        currentStepId: "step:hospital",
        currentPosition: "普通重伤忍者，尚未进入高价任务圈",
        stageGoal: "得到专业重新估值",
        settlementTarget: "进入更高任务入口",
        steps: [
          {
            id: "step:hospital",
            title: "医院重新估值",
            targetGain: "专业评级",
            gate: "证明恢复与能力异常",
            targetCircle: "医疗与任务体系",
          },
        ],
      }),
    ).toThrow("story_creative_context.protagonist_not_in_camera_focus");

    const bad = {
      ...context,
      methodInvocations: [
        {
          ...context.methodInvocations[0]!,
          inputObjectIds: ["object:not-in-world"],
        },
      ],
    };
    expect(() =>
      assertStoryCreativeContextBound(bad, field, {
        protagonistEntityId: "xiuxin",
        road: "忍界最强",
        currentStepId: "step:hospital",
        currentPosition: "普通重伤忍者，尚未进入高价任务圈",
        stageGoal: "得到专业重新估值",
        settlementTarget: "进入更高任务入口",
        steps: [
          {
            id: "step:hospital",
            title: "医院重新估值",
            targetGain: "专业评级",
            gate: "证明恢复与能力异常",
            targetCircle: "医疗与任务体系",
          },
        ],
      }),
    ).toThrow("story_creative_context.unknown_method_object");
  });
});
