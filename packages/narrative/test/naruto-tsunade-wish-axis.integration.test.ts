import { createCanonEntity, createProject } from "@narralume/domain";
import {
  WishFulfillmentFrameSchema,
  type StoryCreativeFrameState,
  type StoryWorldGap,
} from "@narralume/contracts";
import {
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteProjectWorldRepository,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
  WorldAtlasStoryContextBuilder,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  storyBearingEvidenceCandidates,
  storyObjectFieldFromWorldContext,
} from "../src/story-authoring-runtime.js";
import { applySettlementToCreativeFrameState } from "../src/story-creative-context.js";
import type { StoryChapterProductionHandoff } from "../src/story-production-handoff.js";
import { worldWorkOrderFromStoryGap } from "../src/world-production-engine.js";
import { projectExistingWorldForProduction } from "../src/world-production-reality.js";

const now = "2026-11-26T00:00:00.000Z";

let db: NodeNarrativeDatabase;

beforeEach(() => {
  db = new NodeNarrativeDatabase();
  db.migrate();
  new SqliteProjectRepository(db).insert(
    createProject({
      id: "p-tsunade",
      title: "火影·纲手意淫纵轴验收",
      now,
    }),
  );
});

afterEach(() => db.close());

function installTsunadeSourceAndProjectReality() {
  const sources = new SqliteSourceCorpusRepository(db);
  const worlds = new SqliteUnifiedSourceWorldRepository(db);
  const canon = new SqliteCanonRepository(db);
  const projectWorld = new SqliteProjectWorldRepository(db);

  sources.upsertCorpus({
    id: "wiki:naruto",
    title: "火影原著世界",
    sourceUrl: "https://example.test/naruto",
    rightsNotice: "test",
    importer: "fixture",
    metadata: {},
    importedAt: now,
  });
  worlds.createWorld({
    id: "naruto",
    name: "火影忍者",
    kind: "fictional",
    canonicalCorpusId: "wiki:naruto",
    description: "用于纲手意淫纵轴验收的原著母体",
    createdAt: now,
  });
  worlds.upsertCard({
    worldId: "naruto",
    entityKey: "tsunade",
    kind: "character",
    name: "纲手",
    content: [
      "# 纲手",
      "",
      "木叶三忍之一，顶级医疗忍者，拥有极高公共价格。",
      "",
      "## 关系",
      "五代火影候选；医疗体系核心人物；三忍圈层。",
    ].join("\n"),
    now,
  });
  worlds.upsertReaderSemantics({
    worldId: "naruto",
    entityKey: "tsunade",
    semantics: {
      readerPrice:
        "纲手是 Reader 预装认知极高的原著高价人物；她的认可、亲授、私人例外、政治背书与偏爱都具有独立价格。",
      preloadedExpectations: [
        "纲手只对男主开放私人一面，比普通见面更贵",
        "纲手亲自认可或收徒，会公开抬高男主的木叶价格",
      ],
      familiarRelations: ["三忍", "木叶高层", "医疗忍术"],
      naturalEntrances: ["医疗体系", "战后复核", "木叶高层事务"],
      attentionTriggers: ["纲手主动注意低位男主", "纲手给出别人没有的私人准入"],
      basis: "author_judgment",
      sourceNote: "纲手高价人物测试语义",
    },
    now,
  });
  sources.bindProject("p-tsunade", "wiki:naruto");

  canon.insertEntity(
    createCanonEntity({
      id: "hero",
      projectId: "p-tsunade",
      type: "character",
      name: "秀信",
      description: "三战时期从低位起步的木叶忍者",
      now,
    }),
  );
  canon.insertEntity(
    createCanonEntity({
      id: "tsunade",
      projectId: "p-tsunade",
      type: "character",
      name: "纲手",
      description: "Project Reality 中的纲手",
      now,
    }),
  );
  projectWorld.linkSourceEntity({
    projectId: "p-tsunade",
    entityId: "tsunade",
    corpusId: "wiki:naruto",
    sourceKey: "tsunade",
    linkKind: "counterpart",
    confidence: 1,
    sourceNote: "同一纲手的 Source Mother 身份",
    createdAt: now,
  });

  db.raw
    .prepare(
      `
      INSERT INTO world_value_appraisals(
        id,project_id,subject_entity_id,evaluator_entity_id,value_kind,
        value_basis,scarcity,access_path,future_use,status,
        source_type,source_note,created_at
      ) VALUES (
        'tsunade-price','p-tsunade','tsunade',NULL,'office',
        '三忍、顶级医疗忍者、木叶最高政治层级人物',
        '同级公共价格极少',
        '普通低位忍者没有私人准入',
        '师承、医疗、政治、圈层、情感与命运改写均有长期杠杆',
        'available','author_design','纲手公共价格承重',?
      )
    `,
    )
    .run(now);

  return { canon };
}

function tsunadeWishFrame() {
  const desired = [
    ["recognition", "纲手认可我的天赋", "relationship"],
    ["mentorship", "纲手成为我的老师", "relationship"],
    ["collaboration", "纲手主动找我合作", "career"],
    ["dependence", "纲手需要我的能力", "relationship"],
    ["private-access", "纲手只对我开放私人一面", "relationship"],
    ["political-alliance", "纲手成为我的政治盟友", "status"],
    ["affection", "纲手偏爱我", "relationship"],
    ["destiny-rewrite", "我改变纲手原本的人生", "relationship"],
  ] as const;

  return WishFulfillmentFrameSchema.parse({
    version: "wish-fulfillment-frame.v1",
    authority: "creative-direction",
    mode: "story_current",
    protagonistEntityId: "hero",
    readerFantasy:
      "Reader 借秀信进入火影世界后，不只得到一个纲手关系标签，而是让纲手围绕男主持续展开认可、师承、合作、需要、私人例外、政治联盟、偏爱与命运改写。",
    protagonistDesire:
      "秀信当前先要凭真实能力进入纲手的专业视野，并逐步取得只有自己拥有的位置。",
    threads: desired.map(([id, change, dimension]) => ({
      id: `wish:tsunade:${id}`,
      targetRefs: ["object:tsunade"],
      targetNames: ["纲手"],
      dimension,
      readerFantasy: change,
      protagonistDesire:
        id === "private-access"
          ? "让纲手基于真实共同经历主动把私人空间和信任向自己开放"
          : null,
      desiredChange: change,
      privatePrivilege:
        id === "private-access" || id === "affection"
          ? "形成普通忍者与普通弟子都没有的私人例外"
          : null,
      publicRepricing: [
        "recognition",
        "mentorship",
        "political-alliance",
      ].includes(id)
        ? "纲手的公开选择会让木叶重新给男主定价"
        : null,
      upgradeLeverage: [
        "医疗忍术",
        "三忍圈层",
        "木叶高层",
        "私人信任",
        "后续更高价关系",
      ],
      phase: id === "private-access" ? "selected" : "candidate",
    })),
    bearingRequirements: desired.map(([id, change]) => ({
      id: `bearing:tsunade:${id}`,
      threadIds: [`wish:tsunade:${id}`],
      kind:
        id === "private-access" || id === "affection"
          ? "relationship"
          : "person",
      requirement:
        id === "private-access"
          ? "必须存在纲手与秀信之间真实、当前、已经形成的私人信任或私人准入关系；纲手的公共高价不能替代这一关系。"
          : `${change}必须由纲手这个真实高价人物及当前 Reality 承住`,
      evidenceRefs: [],
      status: "candidate",
      raisesPriceBecause:
        id === "private-access"
          ? "只有当纲手本来有选择权、且现实关系已经走到私人信任，她的例外才真正昂贵。"
          : "高价人物的真实选择让这条意淫不是廉价白给。",
    })),
    settlementTargets: [
      {
        threadId: "wish:tsunade:private-access",
        assetKind: "relationship",
        targetGain: "纲手只对秀信开放私人一面",
      },
    ],
  });
}

function buildField() {
  const context = new WorldAtlasStoryContextBuilder(db).build({
    projectId: "p-tsunade",
    entityIds: ["hero", "tsunade"],
  });
  return storyObjectFieldFromWorldContext({
    projectId: "p-tsunade",
    scale: "S04",
    storyTimeLabel: "三战时期",
    realityFingerprint: "reality:tsunade",
    storyStateFingerprint: "story:tsunade",
    context,
  });
}

describe("Naruto Tsunade wish-fulfillment axis integration", () => {
  it("does not let Tsunade's high price impersonate private relationship bearing; routes the gap back to Module 1, then accepts real relationship Reality", () => {
    const { canon } = installTsunadeSourceAndProjectReality();
    const wish = tsunadeWishFrame();
    expect(wish.threads).toHaveLength(8);
    expect(wish.threads.map((thread) => thread.desiredChange)).toEqual(
      expect.arrayContaining([
        "纲手认可我的天赋",
        "纲手成为我的老师",
        "纲手主动找我合作",
        "纲手只对我开放私人一面",
        "纲手需要我的能力",
        "纲手成为我的政治盟友",
        "纲手偏爱我",
        "我改变纲手原本的人生",
      ]),
    );

    const beforeField = buildField();
    const beforeTsunadeEvidence = storyBearingEvidenceCandidates(
      beforeField,
    ).filter((candidate) => candidate.entityId === "tsunade");

    // Module 2 already proves she is a real, expensive, Reader-recognized person.
    expect(
      beforeTsunadeEvidence.some((candidate) =>
        candidate.bearingKinds.includes("price"),
      ),
    ).toBe(true);
    expect(
      beforeTsunadeEvidence.some((candidate) =>
        candidate.bearingKinds.includes("reader_prior"),
      ),
    ).toBe(true);

    // But public price / Reader prior must not magically become private trust.
    expect(
      beforeTsunadeEvidence.some((candidate) =>
        candidate.bearingKinds.includes("relationship"),
      ),
    ).toBe(false);

    const gap: StoryWorldGap = {
      id: "gap:tsunade:private-access",
      kind: "missing_relation",
      anchorObjectIds: ["object:tsunade"],
      need: "补出纲手与秀信之间真实的私人信任 / 私人准入关系",
      reason:
        "当前只有纲手的公共价格与 Reader 预装认知，不能承住‘只对我开放私人一面’。",
      productionHint: "social",
      wishFulfillmentThreadIds: ["wish:tsunade:private-access"],
      bearingRequirementIds: ["bearing:tsunade:private-access"],
      status: "OPEN",
    };
    const projectWorld = projectExistingWorldForProduction({
      entities: canon.listEntities("p-tsunade"),
      facts: canon.listEffectiveFacts("p-tsunade"),
      relationships: [],
    });
    const workOrder = worldWorkOrderFromStoryGap(gap, projectWorld);

    // Module 3 -> Module 1 bridge preserves the exact fantasy thread and bearing debt.
    expect(workOrder).toMatchObject({
      workshop: "social",
      subjectRef: "canon:tsunade",
      wishFulfillmentThreadIds: ["wish:tsunade:private-access"],
      bearingRequirementIds: ["bearing:tsunade:private-access"],
    });
    expect(workOrder.reason).toContain("Story world gap");

    // Simulate Module 1 producing + author adopting the missing relationship
    // into Project Reality / Module 2. This is not a speculative wish field.
    db.raw
      .prepare(
        `
        INSERT INTO relationship_events(
          id,project_id,from_entity_id,to_entity_id,relation,intensity,state_json,
          outline_node_id,story_time,source_id,supersedes_event_id,created_at
        ) VALUES (
          'rel:tsunade-private-access','p-tsunade','tsunade','hero',
          'private_trust',0.9,?,NULL,'三战时期','world-builder-adopt',NULL,?
        )
      `,
      )
      .run(
        JSON.stringify({
          lifecycle: "active",
          description:
            "纲手基于秀信已经证明的能力与共同经历，只对秀信开放私人诊疗室、非公开研究话题与个人判断。",
        }),
        now,
      );

    const afterField = buildField();
    const afterTsunadeEvidence = storyBearingEvidenceCandidates(
      afterField,
    ).filter((candidate) => candidate.entityId === "tsunade");
    const relationshipEvidence = afterTsunadeEvidence.find(
      (candidate) =>
        candidate.facet === "relationship" &&
        candidate.bearingKinds.includes("relationship"),
    );

    expect(relationshipEvidence).toBeDefined();
    expect(relationshipEvidence?.authority).toBe("confirmed");
    expect(relationshipEvidence?.objectId).toBe("object:tsunade");
  });

  it("only turns Tsunade private access into retained equity when settlement confirms the durable relationship write-back", () => {
    installTsunadeSourceAndProjectReality();
    const wish = tsunadeWishFrame();
    const realizingWish = {
      ...wish,
      threads: wish.threads.map((thread) =>
        thread.id === "wish:tsunade:private-access"
          ? { ...thread, phase: "realizing" as const }
          : thread,
      ),
    };

    const currentState: StoryCreativeFrameState = {
      version: "story-creative-frame-state.v1",
      authority: "creative-state",
      projectId: "p-tsunade",
      frameOutlineNodeId: "chapter:tsunade",
      status: "in_progress",
      upgradeLedger: null,
      wishFulfillment: realizingWish,
      stakeLedger: [],
      expectationThreads: [],
      retainedAssets: [],
      unresolvedQuestions: [],
      sourceStoryUnitDigests: ["story-unit:tsunade"],
      realityFingerprint: "reality:before",
      updatedAt: now,
      digest: "state:before",
    };

    const handoff = {
      projectId: "p-tsunade",
      realityFingerprint: "reality:after",
      readerTimeDirectives: [
        {
          action: "payoff",
          reactionTargetEntityIds: ["tsunade"],
          payoffThreadIds: [],
          expectationThreadIds: [],
          retainedGainOpportunity: "纲手只对秀信开放私人一面",
        },
      ],
    } as unknown as StoryChapterProductionHandoff;

    const payoffOnly = applySettlementToCreativeFrameState({
      currentState,
      handoff,
      frameOutlineNodeId: "chapter:tsunade",
      updatedAt: now,
      confirmedRealityClaims: ["纲手只对秀信开放私人一面"],
      confirmedRetainedClaims: [],
    });
    expect(
      payoffOnly.wishFulfillment?.threads.find(
        (thread) => thread.id === "wish:tsunade:private-access",
      )?.phase,
    ).toBe("realized");
    expect(payoffOnly.retainedAssets).toEqual([]);

    const durable = applySettlementToCreativeFrameState({
      currentState,
      handoff,
      frameOutlineNodeId: "chapter:tsunade",
      updatedAt: now,
      confirmedRealityClaims: ["纲手只对秀信开放私人一面"],
      confirmedRetainedClaims: ["纲手只对秀信开放私人一面"],
    });
    expect(
      durable.wishFulfillment?.threads.find(
        (thread) => thread.id === "wish:tsunade:private-access",
      )?.phase,
    ).toBe("retained");
    expect(durable.retainedAssets).toContain("纲手只对秀信开放私人一面");
  });
});
