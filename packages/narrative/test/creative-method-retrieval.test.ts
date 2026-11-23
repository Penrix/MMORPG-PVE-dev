import { createProject } from "@narralume/domain";
import {
  SqliteProjectRepository,
  SqliteRetrievalRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CreativeMethodRetrievalService,
  creativeMethodSegmentFromCuratedCard,
  finalizeStoryCreativeContext,
  finalizeStoryCreativeFrameContext,
  finalizeStoryObjectField,
  parseCuratedCreativeMethodIndex,
} from "../src/index.js";

const now = "2026-11-23T02:00:00.000Z";
let database: NodeNarrativeDatabase;
let retrieval: SqliteRetrievalRepository;

beforeEach(() => {
  database = new NodeNarrativeDatabase();
  database.migrate();
  new SqliteProjectRepository(database).insert(
    createProject({ id: "p1", title: "M Method Retrieval", now }),
  );
  retrieval = new SqliteRetrievalRepository(database);
});

afterEach(() => database.close());

function field() {
  return finalizeStoryObjectField({
    version: "story-object-field.v1",
    authority: "speculative",
    projectId: "p1",
    scale: "S03",
    storyTimeLabel: "木叶医院期",
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
            sourceId: "reality:xiuxin",
            facet: "state",
            slotKey: "location",
            value: "木叶医院",
          },
        ],
        sourceRefs: ["reality:xiuxin"],
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
            sourceId: "reality:medic",
            facet: "state",
            slotKey: "duty",
            value: "伤员复核",
          },
        ],
        sourceRefs: ["reality:medic"],
      },
    ],
  });
}

function context() {
  const frame = finalizeStoryCreativeFrameContext({
    version: "story-creative-frame.v1",
    projectId: "p1",
    targetOutlineNodeId: "arc:hospital",
    currentFrame: {
      outlineNodeId: "arc:hospital",
      parentId: "book:1",
      kind: "arc",
      ordinal: 1,
      title: "医院重新估值",
      summary: null,
      goal: "让秀信从普通伤员进入高价任务入口",
      conflict: "旧专业认知仍把他当普通伤员",
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
        summary: null,
        goal: "一路升级到忍界顶层",
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
      currentState: "低位重伤忍者，正在恢复",
      currentGoal: "重新获得任务价值",
      upgradeNeed: "让真实能力被专业体系重新估值",
      activeMove: "主动用基础忍术做出超出普通伤员标准的结果",
      focusObjectIds: ["object:xiuxin", "object:medic"],
      advantageRefs: ["advantage:control"],
      assetRefs: [],
    },
    methodInvocations: [],
  });
}

function methodSegment(input: {
  family: string;
  id: string;
  status: "active" | "candidate" | "merged" | "retired";
  name: string;
  summary: string;
}) {
  return creativeMethodSegmentFromCuratedCard({
    projectId: "p1",
    methodFamily: input.family,
    sourceRootLabel: "/method-source",
    entry: {
      id: input.id,
      type: "MOVE",
      name: input.name,
      status: input.status,
      summary: input.summary,
      call_when: ["低位男主怎样用一次超规格结果让专业人物重新估值？"],
      tags: ["重新估值", "低位升级"],
      filename: `cards/MOVE/${input.id}.md`,
      curation_stage: "test",
    },
    markdown: `# ${input.id}｜${input.name}\n\n${input.summary}`,
    now,
  });
}

describe("CreativeMethodRetrievalService", () => {
  it("parses the curated index as the import authority", () => {
    const parsed = parseCuratedCreativeMethodIndex(
      [
        JSON.stringify({
          id: "MOVE-0001",
          type: "MOVE",
          name: "先交出超规格成果再谈资格",
          status: "active",
          summary: "低位男主先交成果再让权威改口。",
          call_when: ["资格不足时怎样破格？"],
          tags: ["资格门槛"],
          filename: "cards/MOVE/MOVE-0001.md",
          curation_stage: "semantic-reworked",
        }),
        JSON.stringify({
          id: "MOVE-9999",
          type: "MOVE",
          name: "退役方法",
          status: "retired",
          summary: "不再用于普通召回。",
          call_when: [],
          tags: [],
          filename: "cards/MOVE/MOVE-9999.md",
        }),
      ].join("\n"),
    );
    expect(parsed.map((item) => item.status)).toEqual(["active", "retired"]);
  });

  it("recalls only live cards from the requested M family, not world text or retired cards", () => {
    retrieval.upsertSegment(
      methodSegment({
        family: "M03",
        id: "MOVE-0001",
        status: "active",
        name: "先交出超规格成果再谈资格",
        summary: "先做出超规格结果，再让专业权威重新估值。",
      }),
    );
    retrieval.upsertSegment(
      methodSegment({
        family: "M03",
        id: "MOVE-0999",
        status: "retired",
        name: "旧重新估值套路",
        summary: "低位男主超规格结果专业重新估值。",
      }),
    );
    retrieval.upsertSegment(
      methodSegment({
        family: "M02",
        id: "MOVE-0001",
        status: "active",
        name: "另一方法族",
        summary: "低位男主超规格结果专业重新估值。",
      }),
    );
    retrieval.upsertSegment({
      id: "world:noise",
      projectId: "p1",
      sourceType: "world_reference",
      sourceId: "world:noise",
      title: "超规格结果专业重新估值",
      content:
        "低位男主超规格结果专业重新估值，这段世界资料故意重复全部检索词。",
      authority: "reference",
      metadata: {},
      entityIds: [],
      createdAt: now,
      updatedAt: now,
    });

    const methods = new CreativeMethodRetrievalService(retrieval).recall({
      field: field(),
      creativeContext: context(),
      scope: "story",
      purpose: "寻找秀信如何用真实结果逼专业体系重新估值的剧情演法",
      query: "低位男主 超规格结果 专业重新估值",
      methodFamilies: ["M03"],
      limit: 5,
    });

    expect(methods).toHaveLength(1);
    expect(methods[0]).toMatchObject({
      methodFamily: "M03",
      methodId: "MOVE-0001",
      scope: "story",
      inputObjectIds: ["object:xiuxin", "object:medic"],
    });
    expect(methods[0]!.instruction).toContain("先交出超规格成果再谈资格");
  });

  it("can opt into Candidate without ever returning Retired", () => {
    retrieval.upsertSegment(
      methodSegment({
        family: "M03",
        id: "ACT-0001",
        status: "candidate",
        name: "候选行为法",
        summary: "男主主动试探价格差。",
      }),
    );
    retrieval.upsertSegment(
      methodSegment({
        family: "M03",
        id: "ACT-0002",
        status: "retired",
        name: "退役行为法",
        summary: "男主主动试探价格差。",
      }),
    );

    const service = new CreativeMethodRetrievalService(retrieval);
    expect(
      service.recall({
        field: field(),
        creativeContext: context(),
        scope: "resource",
        purpose: "寻找当前对象里的价格差",
        query: "主动试探价格差",
        methodFamilies: ["M03"],
        includeCandidate: false,
      }),
    ).toEqual([]);

    const withCandidate = service.recall({
      field: field(),
      creativeContext: context(),
      scope: "resource",
      purpose: "寻找当前对象里的价格差",
      query: "主动试探价格差",
      methodFamilies: ["M03"],
      includeCandidate: true,
    });
    expect(withCandidate.map((item) => item.methodId)).toEqual(["ACT-0001"]);
  });
});
