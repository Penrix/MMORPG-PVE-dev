import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonEntity,
  createCanonFact,
  createProject,
} from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteProjectForkRepository,
  SqliteProjectRepository,
  SqliteProjectWorldRepository,
  SqliteSourceCorpusRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-20T00:00:00.000Z";
let db: NodeNarrativeDatabase | null = null;
afterEach(() => {
  db?.close();
  db = null;
});

function setup() {
  db = new NodeNarrativeDatabase();
  expect(db.migrate()).toBe(51);
  const project = new SqliteProjectRepository(db);
  project.insert(createProject({ id: "novel", title: "同人世界 Fork", now }));
  project.insert(createProject({ id: "other", title: "别的小说", now }));
  const sources = new SqliteSourceCorpusRepository(db);
  sources.upsertCorpus({
    id: "naruto",
    title: "火影资料",
    sourceUrl: "https://example.org/naruto",
    rightsNotice: "test only",
    importer: "test",
    metadata: {},
    importedAt: now,
  });
  sources.upsertRecord({
    corpusId: "naruto",
    sourceKey: "itachi",
    kind: "character",
    name: "宇智波鼬",
    aliases: [],
    summary: "源材料基线",
    raw: {
      name: "宇智波鼬",
      personal: { role: "ANBU" },
      profile: { priority: "family" },
    },
    sourceUrl: "https://example.org/naruto/itachi",
    originCollection: "characters",
    importedAt: now,
  });
  sources.bindProject("novel", "naruto");
  const canon = new SqliteCanonRepository(db);
  canon.insertEntity(
    createCanonEntity({
      projectId: "novel",
      id: "itachi",
      name: "宇智波鼬",
      type: "character",
      now,
    }),
  );
  canon.insertEntity(
    createCanonEntity({
      projectId: "other",
      id: "other-itachi",
      name: "同名角色",
      type: "character",
      now,
    }),
  );
  new SqliteProjectWorldRepository(db).linkSourceEntity({
    projectId: "novel",
    entityId: "itachi",
    corpusId: "naruto",
    sourceKey: "itachi",
    linkKind: "counterpart",
    confidence: 1,
    sourceNote: "明确识别原著对应关系",
    createdAt: now,
  });
  return { sources, canon, fork: new SqliteProjectForkRepository(db) };
}

describe("Project Fork/Diff over NarraLume Canon without OOC personality drift", () => {
  it("inherits source claims without copying them into project facts, then displays only actual changes", () => {
    const { sources, canon, fork } = setup();
    fork.createCharacterCore({
      projectId: "novel",
      entityId: "itachi",
      sourceCorpusId: "naruto",
      sourceKey: "itachi",
      tags: ["冷静", "承担责任", "珍视家人"],
      decisionPattern: "判断时优先考虑重要之人的安全，具体选择仍由当下经历决定",
      sourceNote: "测试用的作者采纳角色核心，不宣称自动抽取了原著全部人格",
      createdAt: now,
    });
    fork.bindSourceField({
      id: "baseline-office",
      projectId: "novel",
      entityId: "itachi",
      sourceCorpusId: "naruto",
      sourceKey: "itachi",
      sourceJsonPath: "$.personal.role",
      projectPredicate: "official_role",
      sourceNote: "原生资料嵌套字段对应项目职位",
      createdAt: now,
    });
    fork.bindSourceField({
      id: "baseline-family",
      projectId: "novel",
      entityId: "itachi",
      sourceCorpusId: "naruto",
      sourceKey: "itachi",
      sourceJsonPath: "$.profile.priority",
      projectPredicate: "current_priority",
      sourceNote: "区别于不可变的角色性格核心",
      createdAt: now,
    });
    const before = fork.diffEntity("novel", "itachi");
    expect(before.compared.map((x) => x.status)).toEqual([
      "reference_inherited",
      "reference_inherited",
    ]);
    expect(
      canon.listEffectiveFacts("novel", { subjectId: "itachi" }),
    ).toHaveLength(0);

    canon.insertFact(
      createCanonFact({
        id: "project-role",
        projectId: "novel",
        subjectId: "itachi",
        predicate: "official_role",
        value: "学院教官",
        authority: "confirmed",
        sourceType: "author-approved-story",
        now,
      }),
    );
    canon.insertFact(
      createCanonFact({
        id: "project-relationship",
        projectId: "novel",
        subjectId: "itachi",
        predicate: "trust_in_protagonist",
        value: "建立了信任",
        authority: "confirmed",
        sourceType: "author-approved-story",
        now,
      }),
    );
    const after = fork.diffEntity("novel", "itachi");
    expect(after.compared.find((x) => x.predicate === "official_role")).toEqual(
      expect.objectContaining({
        baseline: "ANBU",
        projectValue: "学院教官",
        status: "project_changed",
        projectFactIds: ["project-role"],
      }),
    );
    expect(
      after.compared.find((x) => x.predicate === "current_priority")?.status,
    ).toBe("reference_inherited");
    expect(after.additions).toEqual([
      {
        predicate: "trust_in_protagonist",
        projectValue: "建立了信任",
        factId: "project-relationship",
      },
    ]);
    expect(after.core?.tags).toEqual(["冷静", "承担责任", "珍视家人"]);

    // Later source importer updates must not rewrite this project's fork base.
    sources.upsertRecord({
      corpusId: "naruto",
      sourceKey: "itachi",
      kind: "character",
      name: "宇智波鼬",
      aliases: [],
      summary: "新来源改版",
      raw: { name: "宇智波鼬", personal: { role: "unrelated revision" } },
      sourceUrl: "https://example.org/naruto/new",
      originCollection: "characters",
      importedAt: "2026-11-21T00:00:00.000Z",
    });
    expect(
      fork
        .diffEntity("novel", "itachi")
        .compared.find((x) => x.predicate === "official_role")?.baseline,
    ).toBe("ANBU");
    expect(canon.listEffectiveFacts("other")).toHaveLength(0);
  });

  it("requires explicit source alignment, refuses cross-project anchors and forbids silent tag rewriting", () => {
    const { fork } = setup();
    expect(() =>
      fork.bindSourceField({
        id: "wrong-path",
        projectId: "novel",
        entityId: "itachi",
        sourceCorpusId: "naruto",
        sourceKey: "itachi",
        sourceJsonPath: "$.doesNotExist",
        projectPredicate: "test",
        sourceNote: "",
        createdAt: now,
      }),
    ).toThrow("world.fork.source_path_missing");
    expect(() =>
      fork.createCharacterCore({
        projectId: "novel",
        entityId: "other-itachi",
        sourceCorpusId: "naruto",
        sourceKey: "itachi",
        tags: ["错误跨项目"],
        decisionPattern: "非法",
        sourceNote: "非法跨小说",
        createdAt: now,
      }),
    ).toThrow("character.anchor.invalid_subject");
    expect(() =>
      fork.createCharacterCore({
        projectId: "novel",
        entityId: "itachi",
        sourceCorpusId: "naruto",
        sourceKey: "itachi",
        tags: ["冷静", "冷静"],
        decisionPattern: "非法",
        sourceNote: "重复标签",
        createdAt: now,
      }),
    ).toThrow("character.anchor.duplicate_tags");
    const core = {
      projectId: "novel",
      entityId: "itachi",
      sourceCorpusId: "naruto",
      sourceKey: "itachi",
      tags: ["冷静"],
      decisionPattern: "有事实支撑的判断习惯",
      sourceNote: "作者确认",
      createdAt: now,
    };
    fork.createCharacterCore(core);
    expect(() =>
      fork.createCharacterCore({ ...core, tags: ["毫无根据的另一人格"] }),
    ).toThrow();
    expect(() =>
      db!.raw
        .prepare(
          `
      UPDATE project_character_anchors
      SET traits_json='["随便替换的人格"]'
      WHERE project_id='novel' AND entity_id='itachi'
    `,
        )
        .run(),
    ).toThrow("character.anchor.immutable");
  });
});
