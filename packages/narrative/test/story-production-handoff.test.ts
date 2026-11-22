import { createOutlineNode, createProject } from "@narralume/domain";
import {
  SqliteProjectRepository,
  SqliteStoryRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { describe, expect, it } from "vitest";

import {
  buildStoryChapterProductionHandoff,
  parseStoryChapterProductionHandoff,
  stageStoryChapterProductionHandoff,
} from "../src/story-production-handoff.js";

function expansion() {
  return {
    version: "story-scene-expansion.v1" as const,
    authority: "speculative" as const,
    projectId: "p1",
    storyUnitDesignDigest: "story-unit:1",
    storyUnitEventId: "event:1",
    arbitrationDigest: "arbiter:1",
    realityFingerprint: "reality:1",
    eventProblem: "专业人物如何重新估值主角",
    scenes: [
      {
        id: "scene:reality-first",
        order: 1,
        phase: "before" as const,
        title: "旧认知继续生效",
        participantEntityIds: ["hero", "medic"],
        locationObjectId: null,
        localProblem: "主角仍按普通伤员被处理",
        pressure: "旧常识压低主角价值",
        observableStart: "医疗忍者按普通流程检查",
        interaction: "主角继续训练，医疗忍者观察",
        informationMove: "专业人物尚未确认异常",
        expectationMove: "继续加深认知差",
        projectedRealityUse: "主角确实继续训练",
        endState: "异常开始进入专业观察",
        nextSceneCause: "训练结果明显偏离普通标准",
      },
      {
        id: "scene:skip",
        order: 2,
        phase: "during" as const,
        title: "后台发生但Reader不看",
        participantEntityIds: ["medic"],
        locationObjectId: null,
        localProblem: "医疗忍者完成一项后台登记",
        pressure: "流程继续",
        observableStart: "登记开始",
        interaction: "医疗忍者记录",
        informationMove: "不进入Reader Time",
        expectationMove: "不占正文",
        projectedRealityUse: "后台登记确实发生",
        endState: "登记完成",
        nextSceneCause: "异常记录进入重新估值",
      },
      {
        id: "scene:reader-first",
        order: 3,
        phase: "after" as const,
        title: "重新估值",
        participantEntityIds: ["medic", "hero"],
        locationObjectId: null,
        localProblem: "确认异常后必须改变处理方式",
        pressure: "旧流程已无法解释新事实",
        observableStart: "复核结果成立",
        interaction: "医疗忍者重新安排处理",
        informationMove: "第一层重新估值兑现",
        expectationMove: "局部平仓并转移到更高层识货",
        projectedRealityUse: "承接S05已确认的复核结果",
        endState: "主角获得新的专业处理位置",
        nextSceneCause: null,
      },
    ],
    digest: "scene-expansion:1",
  };
}

function readerTimePlan() {
  return {
    version: "story-reader-time-plan.v1" as const,
    authority: "speculative" as const,
    projectId: "p1",
    expectationStateDigest: "expectation:1",
    storySceneExpansionDigest: "scene-expansion:1",
    realityFingerprint: "reality:1",
    sceneIds: ["scene:reality-first", "scene:skip", "scene:reader-first"],
    decisions: [
      {
        sceneId: "scene:reader-first",
        readerOrder: 1,
        action: "payoff" as const,
        readerTime: "scene" as const,
        expectationThreadIds: ["thread:recognition"],
        reasons: ["先展示结果，制造对前因的阅读牵引"],
        deepenScarcityEvidenceIds: [],
        reinforceBeliefIds: [],
        widenGapBeliefIds: [],
        embodimentTargets: ["让重新估值通过实际待遇变化被感到"],
        payoffThreadIds: ["thread:recognition"],
        reactionTargetEntityIds: ["medic"],
        retainedGainOpportunity: "更高层识货入口",
        informationReleased: "Reader先看到主角待遇被重新估值",
        informationWithheld: "这一重新估值此前怎样形成",
        focusShiftThreadIds: [],
        nextExpectationSeed: "更高层何时看到这份异常记录",
        terminalExpectationReason: null,
        chapterBoundary: "continue" as const,
      },
      {
        sceneId: "scene:skip",
        readerOrder: 2,
        action: "skip" as const,
        readerTime: "none" as const,
        expectationThreadIds: [],
        reasons: ["后台流程真实发生但没有Reader价值"],
        deepenScarcityEvidenceIds: [],
        reinforceBeliefIds: [],
        widenGapBeliefIds: [],
        embodimentTargets: [],
        payoffThreadIds: [],
        reactionTargetEntityIds: [],
        retainedGainOpportunity: null,
        informationReleased: "无",
        informationWithheld: "无",
        focusShiftThreadIds: [],
        nextExpectationSeed: null,
        terminalExpectationReason: null,
        chapterBoundary: "continue" as const,
      },
      {
        sceneId: "scene:reality-first",
        readerOrder: 3,
        action: "charge" as const,
        readerTime: "beat" as const,
        expectationThreadIds: ["thread:recognition"],
        reasons: ["回到前因，让Reader看见旧认知如何成立"],
        deepenScarcityEvidenceIds: [],
        reinforceBeliefIds: [],
        widenGapBeliefIds: [],
        embodimentTargets: ["普通流程必须具体可感"],
        payoffThreadIds: [],
        reactionTargetEntityIds: [],
        retainedGainOpportunity: null,
        informationReleased: "Reader看到专业人物此前仍按普通标准处理",
        informationWithheld: "更高层仍未知情",
        focusShiftThreadIds: [],
        nextExpectationSeed: "更高层识货",
        terminalExpectationReason: null,
        chapterBoundary: "chapter_end" as const,
      },
    ],
    digest: "reader-time:1",
  };
}

describe("StoryChapterProductionHandoff", () => {
  it("converts S07 Reader Time into a locked NarraLume production plan without restoring skipped scenes", () => {
    const handoff = buildStoryChapterProductionHandoff({
      expansion: expansion(),
      readerTimePlan: readerTimePlan(),
      chapterTitle: "重新估值",
      chapterGoal: "让第一层专业识货真正兑现并留下下一层期待",
      povEntityId: "hero",
      targetCharacters: 2400,
    });

    expect(handoff.sourceSceneIds).toEqual([
      "scene:reader-first",
      "scene:reality-first",
    ]);
    expect(handoff.lockedScenePlan.scenes.map((scene) => scene.title)).toEqual([
      "重新估值",
      "旧认知继续生效",
    ]);
    expect(
      handoff.lockedScenePlan.scenes.reduce(
        (sum, scene) => sum + scene.targetCharacters,
        0,
      ),
    ).toBe(2400);
    expect(JSON.stringify(handoff)).not.toContain("后台发生但Reader不看");
    expect(handoff.readerTimeDirectives[0]?.informationWithheld).toContain(
      "此前怎样形成",
    );
    expect(handoff.readerTimeDirectives[0]?.nextExpectationSeed).toContain(
      "更高层",
    );
  });

  it("stages the locked handoff on a concrete chapter node", () => {
    const database = new NodeNarrativeDatabase();
    database.migrate();
    try {
      new SqliteProjectRepository(database).insert(
        createProject({
          id: "p1",
          title: "测试书",
          now: "2026-11-22T00:00:00.000Z",
        }),
      );
      const story = new SqliteStoryRepository(database);
      const root = story.insertOutlineNode(
        createOutlineNode({
          id: "book",
          projectId: "p1",
          parent: null,
          kind: "book",
          ordinal: 0,
          title: "测试书",
          now: "2026-11-22T00:00:00.000Z",
        }),
      );
      story.insertOutlineNode(
        createOutlineNode({
          id: "chapter-1",
          projectId: "p1",
          parent: root,
          kind: "chapter",
          ordinal: 0,
          title: "重新估值",
          povEntityId: "hero",
          metadata: { plannedEntityIds: ["existing"] },
          now: "2026-11-22T00:00:00.000Z",
        }),
      );

      const handoff = buildStoryChapterProductionHandoff({
        expansion: expansion(),
        readerTimePlan: readerTimePlan(),
        chapterTitle: "重新估值",
        chapterGoal: "兑现第一层识货",
        povEntityId: "hero",
        targetCharacters: 2400,
      });
      const staged = stageStoryChapterProductionHandoff(
        story,
        "chapter-1",
        handoff,
        "2026-11-22T00:00:01.000Z",
      );

      expect(staged.metadata.plannedEntityIds).toEqual(
        expect.arrayContaining(["existing", "hero", "medic"]),
      );
      expect(
        parseStoryChapterProductionHandoff(
          staged.metadata.storyProductionHandoff,
        )?.digest,
      ).toBe(handoff.digest);
    } finally {
      database.close();
    }
  });
});
