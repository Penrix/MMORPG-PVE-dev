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
  WorldAtlasNarrativeContextBuilder,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";


const now = "2026-11-21T10:45:00.000Z";
let db: NodeNarrativeDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe("WorldAtlasNarrativeContextBuilder", () => {
  it("keeps Source World as reference, Project Reality as confirmed, and searches bound Atlas cards", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(54);

    new SqliteProjectRepository(db).insert(
      createProject({ id: "p1", title: "火影同人", now }),
    );
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
      entityKey: "character:kakashi",
      kind: "character",
      name: "旗木卡卡西",
      content: "# 旗木卡卡西\n\n木叶上忍。\n\n所属：[[木叶隐村]]",
      now,
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
      entityKey: "character:sakura",
      kind: "character",
      name: "春野樱",
      content: "# 春野樱\n\n木叶忍者。",
      now,
    });
    atlas.upsertCard({
      worldId: "naruto",
      entityKey: "location:hospital",
      kind: "location",
      name: "木叶医院",
      content: "# 木叶医院\n\n木叶医疗设施。\n\n活动者：[[春野樱]]",
      now,
    });

    const canon = new SqliteCanonRepository(db);
    canon.insertEntity(
      createCanonEntity({
        id: "kakashi",
        projectId: "p1",
        type: "character",
        name: "旗木卡卡西",
        now,
      }),
    );
    canon.insertFact(
      createCanonFact({
        id: "fact-now",
        projectId: "p1",
        subjectId: "kakashi",
        predicate: "当前任务",
        value: "保护男主",
        authority: "confirmed",
        sourceType: "chapter",
        now,
      }),
    );
    new SqliteProjectWorldRepository(db).linkSourceEntity({
      projectId: "p1",
      entityId: "kakashi",
      corpusId: "wiki:naruto",
      sourceKey: "character:kakashi",
      linkKind: "counterpart",
      confidence: 1,
      sourceNote: "原著对应",
      createdAt: now,
    });

    const result = new WorldAtlasNarrativeContextBuilder(db).buildAuthorSources(
      {
        projectId: "p1",
        focalEntityIds: ["kakashi"],
        query: "木叶医院",
        sourceLimit: 8,
      },
    );

    const reality = result.find(
      (source) => source.sourceType === "project_reality",
    );
    expect(reality).toEqual(
      expect.objectContaining({
        authority: "confirmed",
        required: true,
      }),
    );
    expect(reality?.content).toContain("保护男主");

    const sourceKakashi = result.find(
      (source) =>
        source.sourceType === "source_world_atlas" &&
        source.sourceId === "character:kakashi",
    );
    expect(sourceKakashi).toEqual(
      expect.objectContaining({
        authority: "reference",
        required: true,
      }),
    );
    expect(sourceKakashi?.content).toContain("所属 → 木叶隐村");

    const hospital = result.find(
      (source) =>
        source.sourceType === "source_world_atlas" &&
        source.sourceId === "location:hospital",
    );
    expect(hospital).toEqual(
      expect.objectContaining({
        authority: "reference",
        required: false,
      }),
    );
    expect(hospital?.content).toContain("活动者 → 春野樱 [character]");
  });
});
