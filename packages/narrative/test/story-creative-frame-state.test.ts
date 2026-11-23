import { createOutlineNode, createProject } from "@narralume/domain";
import {
  SqliteProjectRepository,
  SqliteStoryRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildStoryCreativeFrameContext,
  finalizeStoryCreativeFrameState,
  stageStoryCreativeFrameState,
} from "../src/story-creative-context.js";

const now = "2026-11-23T01:00:00.000Z";
let database: NodeNarrativeDatabase;
let story: SqliteStoryRepository;

beforeEach(() => {
  database = new NodeNarrativeDatabase();
  database.migrate();
  new SqliteProjectRepository(database).insert(
    createProject({ id: "p1", title: "Creative Frame State", now }),
  );
  story = new SqliteStoryRepository(database);
});

afterEach(() => database.close());

function upgrade(currentStepId: string, currentPosition: string) {
  return {
    protagonistEntityId: "xiuxin",
    road: "从木叶低位忍者一路进入忍界顶层",
    currentStepId,
    currentPosition,
    stageGoal: "让能力与身份持续进入更高价格圈层",
    settlementTarget: "每一阶段都留下可继续使用的真实资产",
    steps: [
      {
        id: "step:hospital",
        title: "医院重新估值",
        targetGain: "专业评级",
        gate: "证明异常不是普通恢复",
        targetCircle: "医疗与任务审核圈",
      },
      {
        id: "step:mission",
        title: "进入高价任务圈",
        targetGain: "上忍级任务入口",
        gate: "把专业评级换成真实任务资格",
        targetCircle: "上忍与高价任务圈",
      },
    ],
  };
}

describe("creative frame state persistence", () => {
  it("writes ledgers into existing outline metadata and restores them for the next sibling", () => {
    const book = story.insertOutlineNode(
      createOutlineNode({
        id: "book:1",
        projectId: "p1",
        parent: null,
        kind: "book",
        ordinal: 0,
        title: "火影长篇",
        now,
      }),
    );
    const volume = story.insertOutlineNode(
      createOutlineNode({
        id: "volume:1",
        projectId: "p1",
        parent: book,
        kind: "volume",
        ordinal: 0,
        title: "木叶起步卷",
        now,
      }),
    );
    const previous = story.insertOutlineNode(
      createOutlineNode({
        id: "arc:0",
        projectId: "p1",
        parent: volume,
        kind: "arc",
        ordinal: 0,
        title: "医院重新估值",
        now,
      }),
    );
    story.updateOutlineStatus("p1", previous.id, "committed", now);
    const target = story.insertOutlineNode(
      createOutlineNode({
        id: "arc:1",
        projectId: "p1",
        parent: volume,
        kind: "arc",
        ordinal: 1,
        title: "第一笔高价任务",
        now,
      }),
    );

    stageStoryCreativeFrameState(
      story,
      finalizeStoryCreativeFrameState({
        version: "story-creative-frame-state.v1",
        authority: "creative-state",
        projectId: "p1",
        frameOutlineNodeId: volume.id,
        status: "in_progress",
        upgradeLedger: upgrade("step:hospital", "普通重伤忍者"),
        stakeLedger: [],
        expectationThreads: [],
        retainedAssets: ["未来作品总路线：忍界最强"],
        unresolvedQuestions: ["怎样从医院进入真正任务圈"],
        sourceStoryUnitDigests: ["story-unit:volume"],
        realityFingerprint: "reality:volume",
        updatedAt: now,
      }),
      now,
    );

    stageStoryCreativeFrameState(
      story,
      finalizeStoryCreativeFrameState({
        version: "story-creative-frame-state.v1",
        authority: "creative-state",
        projectId: "p1",
        frameOutlineNodeId: previous.id,
        status: "settled",
        upgradeLedger: upgrade("step:mission", "已获得专业重新估值的忍者"),
        stakeLedger: [
          {
            id: "stake:medic",
            entityId: "medic",
            currentBelief: "秀信已经证明自己不是普通伤员",
            currentInterest: "维护专业判断",
            stakeAction: "正式提高评级",
            stakeAssets: ["专业信用"],
            commitmentCost: "公开承认此前估值不足",
            escalationPlan: "把异常记录送入任务审核链",
            payoffReaction: "重新估值",
            settlementChange: "专业评级已经改变",
            state: "settled",
          },
          {
            id: "stake:reviewer",
            entityId: "reviewer",
            currentBelief: "医疗记录值得进一步验证",
            currentInterest: "把任务资格给真正有价值的人",
            stakeAction: "安排一次更高标准复核",
            stakeAssets: ["任务审核权限"],
            commitmentCost: "占用高价任务审核资源",
            escalationPlan: "若实战成立就给任务入口",
            payoffReaction: "正式放行",
            settlementChange: "任务资格上升",
            state: "escalating",
          },
        ],
        expectationThreads: [
          {
            id: "expectation:mission",
            targetEmotion: "得意与昂扬",
            targetOutcome: "秀信真正拿到更高价格任务",
            readerKnowledgeSummary: "Reader知道能力异常已被医疗体系确认",
            payoffCondition: "任务体系正式给出更高资格",
            reactionTargetEntityIds: ["reviewer"],
            retainedGainTarget: "高价任务入口",
            phase: "charging",
          },
          {
            id: "expectation:hospital",
            targetEmotion: "得意",
            targetOutcome: "医疗体系重新估值",
            readerKnowledgeSummary: "已经兑现",
            payoffCondition: "医疗评级提高",
            reactionTargetEntityIds: ["medic"],
            retainedGainTarget: "专业评级",
            phase: "settled",
          },
        ],
        retainedAssets: ["专业评级", "医疗异常记录", "任务审核入口"],
        unresolvedQuestions: ["第一笔高价任务具体落在哪里"],
        sourceStoryUnitDigests: ["story-unit:hospital"],
        realityFingerprint: "reality:after-hospital",
        updatedAt: now,
      }),
      now,
    );

    const context = buildStoryCreativeFrameContext(
      story.listOutline("p1"),
      target.id,
    );

    expect(context.inheritedState.sourceFrameIds).toEqual([
      "volume:1",
      "arc:0",
    ]);
    expect(context.inheritedState.sourceStates).toHaveLength(2);
    expect(context.inheritedState.latestUpgradeLedger?.currentStepId).toBe(
      "step:mission",
    );
    expect(context.inheritedState.activeStakeLedger.map((item) => item.id)).toEqual([
      "stake:reviewer",
    ]);
    expect(
      context.inheritedState.openExpectationThreads.map((item) => item.id),
    ).toEqual(["expectation:mission"]);
    expect(context.inheritedState.retainedAssets).toEqual([
      "专业评级",
      "医疗异常记录",
      "任务审核入口",
    ]);
    expect(context.inheritedState.unresolvedQuestions).toEqual([
      "第一笔高价任务具体落在哪里",
    ]);

    const stored = story.requireOutlineNode("p1", previous.id);
    expect(stored.metadata.mmorpgCreativeState).toBeTruthy();
  });
});
