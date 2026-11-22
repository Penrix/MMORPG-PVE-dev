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
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  WorldAtlasStoryContextBuilder,
  worldAtlasSourcesForAccess,
} from "@narralume/persistence";

const now = "2026-11-21T10:00:00.000Z";
let db: NodeNarrativeDatabase;

beforeEach(() => {
  db = new NodeNarrativeDatabase();
  db.migrate();
  new SqliteProjectRepository(db).insert(
    createProject({ id: "p1", title: "火影 Fork", now }),
  );
});

afterEach(() => db.close());

describe("Module 3 World Atlas context adapter", () => {
  it("keeps Project Reality authoritative while Source Atlas stays reference-only", () => {
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
      description: "原著母体世界",
      createdAt: now,
    });
    worlds.upsertCard({
      worldId: "naruto",
      entityKey: "kakashi",
      kind: "character",
      name: "旗木卡卡西",
      content: "# 旗木卡卡西\n\n木叶上忍。",
      now,
    });
    worlds.upsertCard({
      worldId: "naruto",
      entityKey: "forbidden-technique",
      kind: "ability",
      name: "禁术甲",
      content: "# 禁术甲\n\n测试能力。",
      now,
    });
    worlds.upsertCard({
      worldId: "naruto",
      entityKey: "hero-source",
      kind: "character",
      name: "秀信",
      content: [
        "# 秀信",
        "",
        "原著参考身份。",
        "",
        "## 关系",
        "A能力：[[禁术甲]]",
        "Z老师：[[旗木卡卡西]]",
        "",
        "## 原著后续",
        "原著未来会离开木叶。",
      ].join("\n"),
      now,
    });
    sources.bindProject("p1", "wiki:naruto");

    canon.insertEntity(
      createCanonEntity({
        id: "hero",
        projectId: "p1",
        type: "character",
        name: "秀信",
        description: "项目世界中的秀信",
        now,
      }),
    );
    projectWorld.linkSourceEntity({
      projectId: "p1",
      entityId: "hero",
      corpusId: "wiki:naruto",
      sourceKey: "hero-source",
      linkKind: "counterpart",
      confidence: 1,
      sourceNote: "同一人物的母体世界身份",
      createdAt: now,
    });
    canon.insertFact(
      createCanonFact({
        id: "hero-current-location",
        projectId: "p1",
        subjectId: "hero",
        predicate: "current_location",
        value: "木叶医院",
        authority: "confirmed",
        sourceType: "chapter-settlement",
        now,
      }),
    );

    const context = new WorldAtlasStoryContextBuilder(db).build({
      projectId: "p1",
      entityIds: ["hero"],
    });

    expect(context.current).toHaveLength(1);
    expect(context.current[0]).toMatchObject({
      authority: "confirmed",
      sourceType: "project_reality",
    });
    expect(context.current[0]!.content).toContain("木叶医院");

    expect(context.reference).toHaveLength(1);
    expect(context.reference[0]).toMatchObject({
      authority: "reference",
      sourceType: "source_world_atlas",
    });
    expect(context.reference[0]!.content).toContain("旗木卡卡西");
    expect(context.reference[0]!.content).toContain("禁术甲");
    expect(context.reference[0]!.content.indexOf("旗木卡卡西")).toBeLessThan(
      context.reference[0]!.content.indexOf("禁术甲"),
    );
    expect(context.reference[0]!.content).not.toContain("原著未来会离开木叶");

    expect(context.objects).toHaveLength(1);
    expect(context.objects[0]).toMatchObject({
      entityId: "hero",
      name: "秀信",
      kind: "character",
    });
    expect(
      context.objects[0]!.surfaces.some(
        (surface) => surface.authority === "confirmed",
      ),
    ).toBe(true);
    expect(
      context.objects[0]!.surfaces.some(
        (surface) => surface.authority === "reference",
      ),
    ).toBe(true);
    expect(JSON.stringify(context.objects[0])).not.toContain(
      "原著未来会离开木叶",
    );

    expect(context.referenceDetail).toHaveLength(1);
    expect(context.referenceDetail[0]!.content).toContain("原著未来会离开木叶");
    expect(context.referenceDetail[0]!.content).toContain(
      "不得把原著未来自动写回当前 Project Reality",
    );
    expect(context.counts).toMatchObject({
      entities: 1,
      ambiguousSourceBaselines: 0,
    });
  });

  it("enforces author, narrative, and character Atlas access without leaking full source cards", () => {
    const context = {
      current: [
        {
          id: "current",
          kind: "canon" as const,
          label: "current",
          content: "PROJECT-SECRET",
          authority: "confirmed" as const,
          priority: 1,
          sourceType: "project_reality",
        },
      ],
      reference: [
        {
          id: "reference",
          kind: "canon" as const,
          label: "reference",
          content: "SOURCE-BASELINE",
          authority: "reference" as const,
          priority: 1,
          sourceType: "source_world_atlas",
        },
      ],
      referenceDetail: [
        {
          id: "detail",
          kind: "canon" as const,
          label: "detail",
          content: "SOURCE-FUTURE",
          authority: "reference" as const,
          priority: 1,
          sourceType: "source_world_card",
        },
      ],
      objects: [],
      counts: {
        entities: 1,
        projectSlots: 1,
        referenceSlots: 2,
        ambiguousSourceBaselines: 0,
      },
    };

    expect(
      worldAtlasSourcesForAccess(context, "author").map((source) => source.id),
    ).toEqual(["current", "reference", "detail"]);
    expect(
      worldAtlasSourcesForAccess(context, "narrative").map(
        (source) => source.id,
      ),
    ).toEqual(["current", "reference"]);
    expect(worldAtlasSourcesForAccess(context, "character")).toEqual([]);
  });

  it("does not merge ambiguous source baselines into current Reality", () => {
    const sources = new SqliteSourceCorpusRepository(db);
    const canon = new SqliteCanonRepository(db);
    const projectWorld = new SqliteProjectWorldRepository(db);

    for (const corpusId of ["source:a", "source:b"]) {
      sources.upsertCorpus({
        id: corpusId,
        title: corpusId,
        sourceUrl: "https://example.test/" + corpusId,
        rightsNotice: "test",
        importer: "fixture",
        metadata: {},
        importedAt: now,
      });
      sources.upsertRecord({
        corpusId,
        sourceKey: "hero",
        kind: "character",
        name: "秀信",
        aliases: [],
        summary: corpusId + " 的互相冲突版本",
        raw: {},
        sourceUrl: "https://example.test/" + corpusId + "/hero",
        originCollection: "fixture",
        importedAt: now,
      });
      sources.bindProject("p1", corpusId);
    }
    canon.insertEntity(
      createCanonEntity({
        id: "hero",
        projectId: "p1",
        type: "character",
        name: "秀信",
        now,
      }),
    );
    for (const corpusId of ["source:a", "source:b"]) {
      projectWorld.linkSourceEntity({
        projectId: "p1",
        entityId: "hero",
        corpusId,
        sourceKey: "hero",
        linkKind: "counterpart",
        confidence: 1,
        sourceNote: "测试冲突来源",
        createdAt: now,
      });
    }

    const context = new WorldAtlasStoryContextBuilder(db).build({
      projectId: "p1",
      entityIds: ["hero"],
    });
    expect(context.counts.ambiguousSourceBaselines).toBe(1);
    expect(context.reference[0]!.content).toContain('"ambiguous": true');
    expect(context.referenceDetail).toEqual([]);
  });
});
