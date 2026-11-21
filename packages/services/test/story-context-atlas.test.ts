import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonEntity,
  createCanonFact,
  createProject,
} from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteProjectWorldRepository,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";

import { StoryContextPreviewService } from "../src/story-context.js";

const now = "2026-11-21T11:00:00.000Z";
let db: NodeNarrativeDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

function setup() {
  db = new NodeNarrativeDatabase();
  expect(db.migrate()).toBe(54);

  new SqliteProjectRepository(db).insert(
    createProject({ id: "p1", title: "火影同人", now }),
  );
  const projectWorld = new SqliteProjectWorldRepository(db);
  projectWorld.createSpace({
    id: "scope-main",
    projectId: "p1",
    name: "项目主世界",
    kind: "realm",
    parentSpaceId: null,
    sourceCorpusId: null,
    description: "",
    createdAt: now,
  });
  const sources = new SqliteSourceCorpusRepository(db);
  sources.upsertCorpus({
    id: "wiki:naruto",
    title: "火影原生母体",
    sourceUrl: "",
    rightsNotice: "test",
    importer: "test",
    metadata: {},
    importedAt: now,
  });
  sources.bindProject("p1", "wiki:naruto");
  const atlas = new SqliteUnifiedSourceWorldRepository(db);
  atlas.createWorld({
    id: "naruto",
    name: "火影忍者",
    kind: "fictional",
    canonicalCorpusId: "wiki:naruto",
    description: "",
    createdAt: now,
  });
  atlas.upsertCard({
    worldId: "naruto",
    entityKey: "organization:konoha",
    kind: "organization",
    name: "木叶隐村",
    content: "# 木叶隐村\n\n火之国忍村。",
    now,
  });
  atlas.upsertCard({
    worldId: "naruto",
    entityKey: "character:kakashi",
    kind: "character",
    name: "旗木卡卡西",
    content: "# 旗木卡卡西\n\n作者可查的原著资料。\n\n所属：[[木叶隐村]]",
    now,
  });

  const canon = new SqliteCanonRepository(db);
  canon.insertEntity(
    createCanonEntity({
      id: "kakashi",
      projectId: "p1",
      type: "character",
      worldScopeId: "scope-main",
      name: "旗木卡卡西",
      now,
    }),
  );
  canon.insertFact(
    createCanonFact({
      id: "project-secret",
      projectId: "p1",
      subjectId: "kakashi",
      predicate: "作者秘密",
      value: "正在秘密保护男主",
      knowledgeScope: "author_secret",
      authority: "confirmed",
      sourceType: "chapter",
      now,
    }),
  );
  projectWorld.linkSourceEntity({
    projectId: "p1",
    entityId: "kakashi",
    corpusId: "wiki:naruto",
    sourceKey: "character:kakashi",
    linkKind: "counterpart",
    confidence: 1,
    sourceNote: "原著身份",
    createdAt: now,
  });
}

const budget = {
  contextWindow: 20_000,
  outputReserve: 2_000,
  fixedInstructionReserve: 1_000,
  toolReserve: 500,
  schemaReserve: 500,
  safetyReserve: 500,
};

describe("StoryContextPreviewService World Atlas authority boundary", () => {
  it("includes Atlas/Reality for author preview but not for character preview", () => {
    setup();
    const service = new StoryContextPreviewService(db!);

    const author = service.compile({
      projectId: "p1",
      purpose: "scene-plan",
      task: "安排下一场戏",
      query: "旗木卡卡西",
      entityIds: ["kakashi"],
      currentOutlineNodeId: null,
      access: { audience: "author" },
      budget,
    });
    expect(author.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "project_reality",
          authority: "confirmed",
        }),
        expect.objectContaining({
          sourceType: "source_world_atlas",
          authority: "reference",
        }),
      ]),
    );
    expect(author.text).toContain("正在秘密保护男主");
    expect(author.text).toContain("作者可查的原著资料");

    const character = service.compile({
      projectId: "p1",
      purpose: "chapter-draft",
      task: "以卡卡西视角写作",
      query: "旗木卡卡西",
      entityIds: ["kakashi"],
      currentOutlineNodeId: null,
      access: { audience: "character", characterId: "kakashi" },
      budget,
    });
    expect(
      character.sections.some(
        (section) =>
          section.sourceType === "project_reality" ||
          section.sourceType === "source_world_atlas",
      ),
    ).toBe(false);
    expect(character.text).not.toContain("正在秘密保护男主");
    expect(character.text).not.toContain("作者可查的原著资料");
  });
});
