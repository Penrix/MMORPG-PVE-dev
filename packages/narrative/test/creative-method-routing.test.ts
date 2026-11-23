import type { StoryObjectField } from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import { describe, expect, it, vi } from "vitest";

import type { NarrativeModelClient } from "../src/model-client.js";
import {
  CreativeMethodRoutingService,
  StoryAuthoringService,
  finalizeStoryCreativeContext,
  finalizeStoryCreativeFrameContext,
  finalizeStoryObjectField,
  storyObjectSurfaceRef,
  storySearchMethodDefinitions,
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

describe("M-series creative method runtime", () => {
  it("filters out methods whose prerequisites are missing", () => {
    const methods = storySearchMethodDefinitions({
      hasMaterials: false,
      hasPriorStoryState: false,
    });
    const ids = methods.map((method) => method.methodId);

    expect(ids).toContain("m01a-playability");
    expect(ids).toContain("m02-six-chain");
    expect(ids).toContain("m04-mature-story-prototype");
    expect(ids).not.toContain("m03-compose");
    expect(ids).not.toContain("m05-play-variation");
    expect(ids).not.toContain("m06-long-form-score");
    expect(ids).not.toContain("m08-concept-engine-migration");
  });

  it("routes one primary method without deciding the story itself", async () => {
    const currentField = field();
    const creativeContext = context(currentField);
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          expect(purpose).toBe("story-creative-method-routing");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("m02-six-chain");
          expect(serialized).not.toContain("m08-concept-engine-migration");
          expect(serialized).toContain("不负责决定故事写什么");
          const checked = validate({
            diagnosis: "第一批答案收缩成同一种专业复核，需要改变搜索运动。",
            selections: [
              {
                methodId: "m02-six-chain",
                role: "primary",
                purpose: "从现有医院对象中打开机制不同的行动分支",
                reason: "当前卡点是搜索惯性，不是缺世界对象。",
                inputObjectIds: ["object:xiuxin", "object:medic"],
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

    const result = await new CreativeMethodRoutingService(
      model,
    ).routeStorySearch(
      run,
      step,
      {
        field: currentField,
        creativeContext,
        upgradeLedger: upgradeLedger(),
        request: "别只给我同一种专业复核，继续找真正不同的玩法",
        readerNeed: "看低位人物凭真实能力被重新估值",
        targetEmotion: "得意",
      },
      new AbortController().signal,
    );

    expect(result.plan.mode).toBe("auto");
    expect(result.plan.selections).toHaveLength(1);
    expect(result.plan.selections[0]?.role).toBe("primary");
    expect(result.creativeContext.methodInvocations[0]?.methodId).toBe(
      "m02-six-chain",
    );
  });

  it("routes then executes the selected method through StoryAuthoringService", async () => {
    const currentField = field();
    const creativeContext = context(currentField);
    let calls = 0;
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          calls += 1;
          if (purpose === "story-creative-method-routing") {
            const checked = validate({
              diagnosis: "需要打破第一先验。",
              selections: [
                {
                  methodId: "m02-six-chain",
                  role: "primary",
                  purpose: "改变搜索运动",
                  reason: "当前答案同质。",
                  inputObjectIds: ["object:xiuxin", "object:medic"],
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
          }

          expect(purpose).toBe("story-object-grounded-search");
          const serialized = JSON.stringify(request);
          expect(serialized).toContain("m02-six-chain");
          expect(serialized).toContain("primary方法决定本轮主要搜索运动");
          const checked = validate({
            status: "READY",
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
                id: "seed:m02-branch",
                title: "复核权限内部继续分叉",
                anchorObjectIds: ["object:xiuxin", "object:medic"],
                groundingSurfaceRefs: [
                  surfaceRef(currentField, "object:xiuxin", "location"),
                  surfaceRef(currentField, "object:medic", "duty"),
                ],
                observation: "两人已经在同一医疗处理链",
                searchMove:
                  "M02树型：改变复核结果的公开程度，观察人物下一手如何变化",
                idea: "不造新人物，从既有复核权限内部寻找不同分支",
                protagonistHook: "秀信主动让训练结果进入专业观察",
                readerValue: "同一能力在不同公开程度下产生不同价格",
                newRelationOrChange: "医疗关系出现可升级的专业定价接口",
                candidateNewObjects: [],
                nextQuestion: "哪一条分支最适合进入S04下注设计",
                status: "CANDIDATE",
              },
            ],
            worldGaps: [],
            scaleResult: {
              scale: "S03",
              periodFocus: "病房恢复与专业重新估值",
              opportunityField: [
                {
                  objectIds: ["object:xiuxin", "object:medic"],
                  opportunity: "复核权限内部可以继续分叉",
                  whyAlive: "两人当前就在同一现实处理链",
                },
              ],
              storyMovements: [],
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

    const result = await new StoryAuthoringService(
      model,
    ).searchWithCreativeMethods(
      run,
      step,
      {
        field: currentField,
        creativeContext,
        upgradeLedger: upgradeLedger(),
        request: "别只给我同一种专业复核，继续找真正不同的玩法",
        readerNeed: "看低位人物凭真实能力被重新估值",
        targetEmotion: "得意",
        protagonistProfile: "秀信：低位、主动、用基础能力解决现实问题",
      },
      new AbortController().signal,
    );

    expect(calls).toBe(2);
    expect(result.routing.creativeContext.methodInvocations).toHaveLength(1);
    expect(result.search.value.seeds[0]?.searchMove).toContain("M02树型");
  });

  it("recalls Module-2 creative materials before routing when a retrieval port is available", async () => {
    const currentField = field();
    const creativeContext = context(currentField);
    const recall = vi.fn(() => [
      {
        id: "material-selection:M03:MOVE-0001:1",
        libraryId: "M03",
        materialId: "MOVE-0001",
        materialType: "MOVE",
        status: "active" as const,
        title: "先交成果再谈资格",
        summary: "低位人物先交出超规格成果，再由权威重新估值。",
        sourceRef:
          "Penrix/male-webnovel-cognition/database/m03/cards/MOVE/MOVE-0001.md",
        scope: "story" as const,
        purpose: "资格不足时寻找成熟做法",
        inputObjectIds: ["object:xiuxin", "object:medic"],
        callWhen: ["资格不足时怎样破格？"],
        tags: ["重新估值"],
        curationStage: "test",
        content: "先交出成果，再让已有专业人物行动、下注和改价。",
      },
    ]);
    let calls = 0;
    const model: NarrativeModelClient = {
      text: vi.fn(),
      structured: vi.fn(
        async (_run, _step, purpose, request, _contract, validate) => {
          calls += 1;
          const serialized = JSON.stringify(request);
          if (purpose === "story-creative-method-routing") {
            expect(serialized).toContain("m03-compose");
            expect(serialized).toContain("MOVE-0001");
            const checked = validate({
              diagnosis: "当前有成熟MOVE素材可与医院既有人物发生碰撞。",
              selections: [
                {
                  methodId: "m03-compose",
                  role: "primary",
                  purpose: "把成熟重新估值做法放进当前医院人物关系里试演",
                  reason: "素材已召回，当前缺口是具体适配而不是继续空想。",
                  inputObjectIds: ["object:xiuxin", "object:medic"],
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
          }

          expect(purpose).toBe("story-object-grounded-search");
          expect(serialized).toContain("MOVE-0001");
          expect(serialized).toContain("m03-compose");
          const checked = validate({
            status: "READY",
            question: "这张MOVE怎样真正撞到医院既有人物？",
            objectFocus: [
              {
                objectId: "object:medic",
                surfaceRefs: [surfaceRef(currentField, "object:medic", "duty")],
                whyNow: "医疗忍者此刻掌握复核权限",
                valuableSurface: "专业估值与任务资格接口",
              },
            ],
            seeds: [
              {
                id: "seed:m03-compose",
                title: "把成果递到既有专业估值链",
                anchorObjectIds: ["object:xiuxin", "object:medic"],
                groundingSurfaceRefs: [
                  surfaceRef(currentField, "object:xiuxin", "location"),
                  surfaceRef(currentField, "object:medic", "duty"),
                ],
                observation: "秀信正在医院，医疗忍者拥有真实复核职责",
                searchMove:
                  "M03 COMPOSE：用MOVE-0001的先交成果机制碰撞当前复核权限",
                idea: "让训练成果先进入医疗复核，再由已有角色自己重新定价",
                protagonistHook: "秀信主动交出可验证成果",
                readerValue: "成熟玩法被当前世界对象重新演成可信的破格入口",
                newRelationOrChange: "普通医疗关系开始向专业识货关系变价",
                candidateNewObjects: [],
                nextQuestion: "哪种成果足以让这笔下注继续升级",
                status: "CANDIDATE",
              },
            ],
            worldGaps: [],
            scaleResult: {
              scale: "S03",
              periodFocus: "医院重新估值",
              opportunityField: [
                {
                  objectIds: ["object:xiuxin", "object:medic"],
                  opportunity: "成熟MOVE可以落到现有专业复核关系",
                  whyAlive: "现实权限与当前主动行动都已经存在",
                },
              ],
              storyMovements: [],
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

    const result = await new StoryAuthoringService(model, {
      recall,
    }).searchWithCreativeMethods(
      run,
      step,
      {
        field: currentField,
        creativeContext,
        upgradeLedger: upgradeLedger(),
        request: "资格不足时，有没有成熟做法能让现有人物重新估值？",
        readerNeed: "看低位人物凭真实能力被重新估值",
        targetEmotion: "得意",
        protagonistProfile: "秀信：主动用真实成果打开入口",
      },
      new AbortController().signal,
    );

    expect(recall).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
    expect(result.routing.creativeContext.materialSelections[0]?.materialId).toBe(
      "MOVE-0001",
    );
    expect(result.routing.creativeContext.methodInvocations[0]?.methodId).toBe(
      "m03-compose",
    );
  });

});
