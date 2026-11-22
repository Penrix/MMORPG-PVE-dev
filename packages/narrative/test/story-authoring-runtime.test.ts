import type {
  ExpectationDesign,
  StoryAuthoringSearchDraft,
  StoryObjectField,
  StoryObjectFieldDraft,
} from "@narralume/contracts";
import { describe, expect, it } from "vitest";

import {
  finalizeStoryAuthoringSearch,
  finalizeStoryObjectField,
  finalizeStoryUnitDesign,
  realityFocusFromStoryUnitDesign,
  storyObjectFieldFromWorldContext,
  storyObjectSurfaceRef,
} from "../src/story-authoring-runtime.js";
import { finalizeExpectationDesign } from "../src/expectation-runtime.js";

function field(scale: StoryObjectField["scale"] = "S03"): StoryObjectField {
  const draft: StoryObjectFieldDraft = {
    version: "story-object-field.v1",
    authority: "speculative",
    projectId: "p1",
    scale,
    storyTimeLabel: "第三次忍界大战前后",
    realityFingerprint: "reality:1",
    storyStateFingerprint: "story:1",
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
      {
        id: "object:sakumo",
        entityId: "sakumo",
        name: "旗木朔茂",
        kind: "character",
        aliases: ["木叶白牙"],
        surfaces: [
          scale === "S01"
            ? {
                authority: "reference",
                sourceId: "world-source-baseline:sakumo",
                facet: "relationship",
                slotKey: "military",
                value: "木叶高价军事人物",
              }
            : {
                authority: "reference",
                sourceId: "world-source-baseline:sakumo",
                facet: "state",
                slotKey: "source_identity",
                value: {
                  id: "sakumo",
                  name: "旗木朔茂",
                  type: "character",
                },
              },
        ],
        sourceRefs: ["world-source-baseline:sakumo"],
      },
    ],
  };
  return finalizeStoryObjectField(draft);
}

function surfaceRef(
  currentField: StoryObjectField,
  objectId: string,
  slotKey?: string,
): string {
  const object = currentField.objects.find((item) => item.id === objectId)!;
  const surface = slotKey
    ? object.surfaces.find((item) => item.slotKey === slotKey)!
    : object.surfaces[0]!;
  return storyObjectSurfaceRef(object.id, surface);
}

function expectation(): ExpectationDesign {
  return finalizeExpectationDesign({
    version: "expectation-design.v1",
    authority: "speculative",
    projectId: "p1",
    protagonistId: "xiuxin",
    readerNeed: "看到低位人物凭真实优势被高价人物重新估值",
    targetEmotion: "得意与昂扬",
    targetOutcome: "秀信的异常价值进入更高圈层视野",
    scarcityIntents: [
      {
        claim: "基础忍术通常不被视为高价能力",
        subjectRef: "basic-ninjutsu",
        existingEvidenceRefs: ["world-rule:basic"],
        evidenceToEstablish: [],
      },
    ],
    beliefIntents: [
      {
        proposition: "普通伤员不可能靠基础忍术表现出上忍级价值",
        scope: "circle",
        holderEntityIds: ["medic"],
        existingEvidenceRefs: ["world-rule:basic"],
        stakeToCultivate: [],
        breakCondition: "秀信做出可信异常结果",
      },
    ],
    protagonistAdvantageRefs: ["reality:xiuxin-control"],
    reactionTargetEntityIds: ["medic", "sakumo"],
    retainedGainTarget: "获得更高任务圈的真实入口",
    activationEntityIds: ["medic", "sakumo"],
    worldFocusRefs: ["world-rule:basic"],
    designReasons: ["这条认知差能把基础术的异常价值抬高"],
    realityFingerprint: "reality:1",
    storyStateFingerprint: "story:1",
    mustPreserveAgentAutonomy: true,
    mustNotPredetermineOutcome: true,
  });
}

describe("object-grounded story authoring runtime", () => {
  it("builds an imagination Object Field from Module-2 context objects", () => {
    const built = storyObjectFieldFromWorldContext({
      projectId: "p1",
      scale: "S03",
      storyTimeLabel: "第三次忍界大战前后",
      realityFingerprint: "reality:1",
      storyStateFingerprint: "story:1",
      context: {
        projectId: "p1",
        current: [],
        reference: [],
        referenceDetail: [],
        objects: [
          {
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
        ],
        counts: {
          entities: 1,
          projectSlots: 1,
          referenceSlots: 0,
          ambiguousSourceBaselines: 0,
        },
      },
    });

    expect(built.authority).toBe("speculative");
    expect(built.objects[0]).toMatchObject({
      id: "object:xiuxin",
      entityId: "xiuxin",
      name: "秀信",
    });
    expect(built.digest).toBeTruthy();
  });

  it("changes a surface ref when the underlying Reality value changes", () => {
    const objectField = field("S03");
    const object = objectField.objects.find(
      (item) => item.id === "object:xiuxin",
    )!;
    const surface = object.surfaces.find(
      (item) => item.slotKey === "location",
    )!;
    const before = storyObjectSurfaceRef(object.id, surface);
    const after = storyObjectSurfaceRef(object.id, {
      ...surface,
      value: "前线营地",
    });

    expect(after).not.toBe(before);
  });

  it("rejects a World Atlas context from another project", () => {
    expect(() =>
      storyObjectFieldFromWorldContext({
        projectId: "p1",
        scale: "S03",
        storyTimeLabel: "第三次忍界大战前后",
        realityFingerprint: "reality:1",
        storyStateFingerprint: "story:1",
        context: {
          projectId: "other-project",
          current: [],
          reference: [],
          referenceDetail: [],
          objects: [
            {
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
          ],
          counts: {
            entities: 1,
            projectSlots: 1,
            referenceSlots: 0,
            ambiguousSourceBaselines: 0,
          },
        },
      }),
    ).toThrow("story_authoring.world_context_project_mismatch");
  });

  it("rejects Story Seeds that do not point back to the current Object Field", () => {
    const objectField = field("S03");
    const draft: StoryAuthoringSearchDraft = {
      version: "story-authoring-search.v1",
      authority: "speculative",
      status: "READY",
      projectId: "p1",
      scale: "S03",
      objectFieldDigest: objectField.digest,
      question: "这一阵子到底有什么值得玩？",
      objectFocus: [],
      seeds: [
        {
          id: "seed:bad",
          title: "神秘长老突然识货",
          anchorObjectIds: ["object:mystery-elder"],
          groundingSurfaceRefs: [
            surfaceRef(objectField, "object:xiuxin", "location"),
          ],
          observation: "空气里没有这个对象",
          searchMove: "硬塞一个识货人",
          idea: "神秘长老出现",
          protagonistHook: "男主被看见",
          readerValue: "假装升级",
          newRelationOrChange: "凭空关系",
          candidateNewObjects: [],
          nextQuestion: "错误",
          status: "CANDIDATE",
        },
      ],
      worldGaps: [],
      scaleResult: {
        scale: "S03",
        periodFocus: "病房期",
        opportunityField: [
          {
            objectIds: ["object:xiuxin"],
            opportunity: "秀信当前恢复状态本身值得继续搜索",
            whyAlive: "他正在医院，恢复与任务资格仍在变化",
          },
        ],
        storyMovements: [],
      },
    };

    expect(() => finalizeStoryAuthoringSearch(draft, objectField)).toThrow(
      "story_authoring.unknown_seed_anchor_0:object:mystery-elder",
    );
  });

  it("rejects a seed that names real objects but cites an invented surface", () => {
    const objectField = field("S03");
    const draft: StoryAuthoringSearchDraft = {
      version: "story-authoring-search.v1",
      authority: "speculative",
      status: "READY",
      projectId: "p1",
      scale: "S03",
      objectFieldDigest: objectField.digest,
      question: "两个人之间有什么值得玩的关系？",
      objectFocus: [],
      seeds: [
        {
          id: "seed:fake-debt",
          title: "并不存在的人情债",
          anchorObjectIds: ["object:xiuxin", "object:medic"],
          groundingSurfaceRefs: ["surface:invented-debt"],
          observation: "医疗忍者欠秀信父亲一个人情",
          searchMove: "凭空补关系",
          idea: "靠不存在的人情债推动剧情",
          protagonistHook: "秀信被特殊照顾",
          readerValue: "虚假便利",
          newRelationOrChange: "凭空关系",
          candidateNewObjects: [],
          nextQuestion: "不应进入下游",
          status: "CANDIDATE",
        },
      ],
      worldGaps: [],
      scaleResult: {
        scale: "S03",
        periodFocus: "病房期",
        opportunityField: [
          {
            objectIds: ["object:xiuxin", "object:medic"],
            opportunity: "测试 grounding",
            whyAlive: "两个对象都真实存在",
          },
        ],
        storyMovements: [],
      },
    };
    expect(() => finalizeStoryAuthoringSearch(draft, objectField)).toThrow(
      "story_authoring.unknown_seed_surface_0:surface:invented-debt",
    );
  });

  it("keeps S01 Concept x Engine as a distinct scale result", () => {
    const objectField = field("S01");
    const result = finalizeStoryAuthoringSearch(
      {
        version: "story-authoring-search.v1",
        authority: "speculative",
        status: "READY",
        projectId: "p1",
        scale: "S01",
        objectFieldDigest: objectField.digest,
        question: "这个男人在忍界长期过什么值得追看的生活？",
        objectFocus: [
          {
            objectId: "object:sakumo",
            surfaceRefs: [surfaceRef(objectField, "object:sakumo", "military")],
            whyNow: "高价人物代表更贵的军事社会入口",
            valuableSurface: "高价任务、名望、识货与权限",
          },
        ],
        seeds: [
          {
            id: "seed:recognition-engine",
            title: "能力不断换来更贵入口",
            anchorObjectIds: ["object:xiuxin", "object:sakumo"],
            groundingSurfaceRefs: [
              surfaceRef(objectField, "object:xiuxin", "location"),
              surfaceRef(objectField, "object:sakumo", "military"),
            ],
            observation: "低位人物和高价军事人物存在价格差",
            searchMove: "把能力资产与圈层入口建立可重复接口",
            idea: "每次真实能力兑现都留下更高任务入口",
            protagonistHook: "秀信主动把异常能力用在现实任务",
            readerValue: "能力、身份、名望和自由不断涨价",
            newRelationOrChange: "能力资产持续重定价社会关系",
            candidateNewObjects: [],
            nextQuestion: "哪些世界机制能反复提供不同价格的兑现",
            status: "CANDIDATE",
          },
        ],
        worldGaps: [],
        scaleResult: {
          scale: "S01",
          storyConcepts: [
            {
              id: "concept:high-value-life",
              concept: "低位忍者凭特殊能力一路活进忍界高价圈层",
              objectIds: ["object:xiuxin", "object:sakumo"],
              life: "任务、高手、权力和关系不断升级",
              readerValue: "得意、昂扬、自由与被高价社会承认",
            },
          ],
          storyEngines: [
            {
              id: "engine:repricing",
              engine: "能力资产不断解决更贵现实问题并换来新的社会入口",
              objectIds: ["object:xiuxin", "object:sakumo"],
              repeatablePlay: "不同任务、人物和规则给同一能力重新定价",
              supply: "每次胜利留下权限、关系和名望作为下一次本金",
            },
          ],
          conceptEngineLinks: [
            {
              conceptId: "concept:high-value-life",
              engineId: "engine:repricing",
              whySustainable: "Engine本身持续生产Concept中的生活",
            },
          ],
        },
      },
      objectField,
    );

    expect(result.scaleResult.scale).toBe("S01");
    expect(result.authority).toBe("speculative");
  });

  it("keeps S02 Current S0 and Stage Opportunity instead of task decomposition", () => {
    const objectField = field("S02");
    const result = finalizeStoryAuthoringSearch(
      {
        version: "story-authoring-search.v1",
        authority: "speculative",
        status: "READY",
        projectId: "p1",
        scale: "S02",
        objectFieldDigest: objectField.digest,
        question: "当前S0能进入什么更贵的新生活？",
        objectFocus: [],
        seeds: [
          {
            id: "seed:stage",
            title: "进入更高价任务圈",
            anchorObjectIds: ["object:xiuxin", "object:sakumo"],
            groundingSurfaceRefs: [
              surfaceRef(objectField, "object:xiuxin", "location"),
              surfaceRef(objectField, "object:sakumo", "source_identity"),
            ],
            observation: "秀信仍是低位人物，高价军事人物代表新的任务入口",
            searchMove: "寻找现实资格变化而不是列办事步骤",
            idea: "异常能力被任务体系重新估值",
            protagonistHook: "男主主动用能力完成现实问题",
            readerValue: "进入更贵舞台",
            newRelationOrChange: "任务资格发生变化",
            candidateNewObjects: [],
            nextQuestion: "哪种现实事件足以让资格变化成立",
            status: "CANDIDATE",
          },
        ],
        worldGaps: [],
        scaleResult: {
          scale: "S02",
          currentS0: "低位伤员，尚未拥有高价任务资格",
          stageOpportunities: [
            {
              id: "stage:special-mission",
              title: "进入战争期高价任务圈",
              objectIds: ["object:xiuxin", "object:sakumo"],
              whyNow: "当前能力异常有机会改变任务体系估值",
              newLife: "开始频繁与高价任务和高手发生关系",
              candidateS1: "成为能被更高任务体系反复调用的人",
              unlockedObjects: ["高价任务", "军事圈层"],
              status: "CANDIDATE",
            },
          ],
        },
      },
      objectField,
    );

    expect(result.scaleResult.scale).toBe("S02");
    if (result.scaleResult.scale === "S02") {
      expect(result.scaleResult.currentS0).toContain("尚未拥有");
    }
  });

  it("designs S04 Cast Pool and Active Seed without giving S05 actor outcomes", () => {
    const objectField = field("S04");
    const exp = expectation();
    const design = finalizeStoryUnitDesign(
      {
        version: "story-unit-design.v1",
        authority: "speculative",
        status: "READY",
        projectId: "p1",
        objectFieldDigest: objectField.digest,
        sourceSeedIds: ["seed:s03"],
        expectationDesignDigest: exp.digest,
        objectAnchorIds: ["object:xiuxin", "object:medic", "object:sakumo"],
        groundingSurfaceRefs: [
          surfaceRef(objectField, "object:xiuxin", "location"),
          surfaceRef(objectField, "object:medic", "duty"),
        ],
        storyProblem: "让基础忍术的异常价值第一次进入可信识货链",
        worldGaps: [],
        campNetwork: [
          {
            entityId: "xiuxin",
            camp: "友方",
            currentGoal: "恢复并重新获得任务价值",
            storyRole: "主角实际行动来源",
            currentBelief: "自己的控制能力能够继续开发",
          },
          {
            entityId: "medic",
            camp: "中立",
            currentGoal: "按医疗规则处理伤员",
            storyRole: "专业固有认知与第一见证人",
            currentBelief: "普通伤员不会靠基础术出现上忍级价值",
          },
          {
            entityId: "sakumo",
            camp: "中立",
            currentGoal: "完成自己的军事事务",
            storyRole: "未来更高价格的识货对象",
            currentBelief: "尚未见到秀信当前异常",
          },
        ],
        reactionTargets: [
          {
            entityId: "medic",
            before: "按普通伤员估值",
            during: "如果看到异常，应由本人按专业Reality判断",
            after: "目标是形成重新估值，但不强迫具体反应",
          },
        ],
        campTransitions: [],
        appearanceOrderEntityIds: ["xiuxin", "medic", "sakumo"],
        informationRelease: [
          {
            step: 1,
            readerKnows: "秀信的控制异常",
            charactersKnow: "医疗忍者只看到当前表现",
            withheld: "朔茂尚未知情",
            purpose: "先建立认知差",
          },
        ],
        events: [
          {
            id: "event:test",
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
            realityQuestion: "按当前医疗规则与人物认知，医疗忍者实际会怎样处理这个异常",
            observableStart: "秀信开始恢复训练",
            expectedChange: "至少产生可被Reality裁决的新事实",
            readerExpectation: "等待专业人物如何真实处理异常",
          },
        ],
        mustPreserveAgentAutonomy: true,
      },
      objectField,
      exp,
      new Set(["seed:s03"]),
    );

    expect(design.events[0]!.activeSeedEntityIds).toEqual(["xiuxin"]);
    expect(realityFocusFromStoryUnitDesign(design)).toMatchObject({
      firstEventCastPoolEntityIds: ["xiuxin", "medic"],
      firstEventActiveSeedEntityIds: ["xiuxin"],
    });

    expect(() =>
      finalizeStoryUnitDesign(
        {
          ...design,
          events: [
            {
              ...design.events[0]!,
              activeSeedEntityIds: ["sakumo"],
            },
          ],
        },
        objectField,
        exp,
        new Set(["seed:s03"]),
      ),
    ).toThrow("story_authoring.unknown_event_active_seed:sakumo");
  });

  it("allows S03 to stop on a real world gap instead of inventing a seed", () => {
    const objectField = field("S03");
    const result = finalizeStoryAuthoringSearch(
      {
        version: "story-authoring-search.v1",
        authority: "speculative",
        status: "BLOCKED_WORLD_GAP",
        projectId: "p1",
        scale: "S03",
        objectFieldDigest: objectField.digest,
        question: "这一阵子有什么值得玩？",
        objectFocus: [],
        seeds: [],
        worldGaps: [
          {
            id: "gap:medical-review",
            kind: "missing_object",
            anchorObjectIds: ["object:xiuxin"],
            need: "补出拥有医疗复核权限的具体人物或组织对象",
            reason: "当前病房对象场没有可信的专业复核入口",
            productionHint: "people",
            status: "OPEN",
          },
        ],
        scaleResult: {
          scale: "S03",
          periodFocus: "病房期",
          opportunityField: [],
          storyMovements: [],
        },
      },
      objectField,
    );
    expect(result.status).toBe("BLOCKED_WORLD_GAP");
    expect(result.seeds).toEqual([]);
  });

  it("rejects S04 design when Expectation fingerprints are stale", () => {
    const objectField = field("S04");
    const exp = {
      ...expectation(),
      realityFingerprint: "old-reality",
    };
    expect(() =>
      finalizeStoryUnitDesign(
        {
          version: "story-unit-design.v1",
          authority: "speculative",
          status: "BLOCKED_WORLD_GAP",
          projectId: "p1",
          objectFieldDigest: objectField.digest,
          sourceSeedIds: [],
          expectationDesignDigest: exp.digest,
          objectAnchorIds: [],
          groundingSurfaceRefs: [],
          storyProblem: "等待刷新",
          worldGaps: [
            {
              id: "gap:stale-expectation",
              kind: "missing_state",
              anchorObjectIds: [],
              need: "刷新当前 Expectation 与 Reality 指纹",
              reason: "现有 Expectation 已绑定旧 Reality",
              productionHint: "events",
              status: "OPEN",
            },
          ],
          campNetwork: [],
          reactionTargets: [],
          campTransitions: [],
          appearanceOrderEntityIds: [],
          informationRelease: [],
          events: [],
          mustPreserveAgentAutonomy: true,
        },
        objectField,
        exp,
      ),
    ).toThrow("story_authoring.story_unit_not_bound");
  });

  it("rejects S04 finalization against an S03 Object Field", () => {
    const objectField = field("S03");
    const exp = expectation();
    expect(() =>
      finalizeStoryUnitDesign(
        {
          version: "story-unit-design.v1",
          authority: "speculative",
          status: "BLOCKED_WORLD_GAP",
          projectId: "p1",
          objectFieldDigest: objectField.digest,
          sourceSeedIds: [],
          expectationDesignDigest: exp.digest,
          objectAnchorIds: [],
          groundingSurfaceRefs: [],
          storyProblem: "错误尺度",
          worldGaps: [
            {
              id: "gap:s04-field",
              kind: "missing_state",
              anchorObjectIds: [],
              need: "重新取得 S04 尺度 Object Field",
              reason: "当前字段仍是 S03 尺度",
              productionHint: "events",
              status: "OPEN",
            },
          ],
          campNetwork: [],
          reactionTargets: [],
          campTransitions: [],
          appearanceOrderEntityIds: [],
          informationRelease: [],
          events: [],
          mustPreserveAgentAutonomy: true,
        },
        objectField,
        exp,
      ),
    ).toThrow("story_authoring.story_unit_not_bound");
  });
});
