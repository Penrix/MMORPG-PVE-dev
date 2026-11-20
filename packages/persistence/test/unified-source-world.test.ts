import { afterEach, describe, expect, it } from "vitest";
import { createProject } from "@narralume/domain";
import {
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
  SqliteMotherWorldEncyclopediaRepository,
  SqliteProjectRepository,
  SqliteCanonRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-21T00:00:00.000Z";
let db: NodeNarrativeDatabase | null = null;
afterEach(() => {
  db?.close();
  db = null;
});

describe("one original Naruto wiki identity from several distinct upstream datasets", () => {
  it("keeps Madara as one curated world entity with two independently reviewable source references", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(54);
    const source = new SqliteSourceCorpusRepository(db);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    for (const [id, title] of [
      ["wiki:naruto", "统一火影原著百科"],
      ["naruto-dattebayo", "Dattebayo"],
      ["naruto-scraper", "Naruto Wiki"],
      ["history", "唐宋元明清历史库"],
    ] as const)
      source.upsertCorpus({
        id,
        title,
        sourceUrl: "https://example.org/" + id,
        rightsNotice: "test only",
        importer: "fixture",
        metadata: {},
        importedAt: now,
      });
    const add = (
      corpusId: string,
      sourceKey: string,
      name: string,
      raw: Record<string, unknown>,
    ) => {
      source.upsertRecord({
        corpusId,
        sourceKey,
        name,
        kind: "character",
        aliases: [],
        summary: "不同上游资料记录",
        raw,
        sourceUrl: "https://example.org/" + corpusId + "/" + sourceKey,
        originCollection: "characters",
        importedAt: now,
      });
    };
    add("naruto-dattebayo", "character:1", "Madara Uchiha", {
      strength: "source-A",
    });
    add("naruto-scraper", "wiki:Madara", "Madara Uchiha", {
      strength: "source-B",
      biography: "more text",
    });
    add("history", "other", "Madara Uchiha", { unrelated: true });
    worlds.createWorld({
      id: "naruto",
      name: "火影忍者原生世界",
      kind: "fictional",
      canonicalCorpusId: "wiki:naruto",
      description: "一个世界的完整原著资料，不属于小说项目",
      createdAt: now,
    });
    worlds.addEvidenceCorpus({
      worldId: "naruto",
      corpusId: "naruto-dattebayo",
      evidenceRole: "supporting",
      sourceNote: "技能和角色列表",
    });
    worlds.addEvidenceCorpus({
      worldId: "naruto",
      corpusId: "naruto-scraper",
      evidenceRole: "alternate_version",
      sourceNote: "人生传记与有争议的来源版本",
    });
    worlds.createCanonicalFromEvidence({
      worldId: "naruto",
      canonicalKey: "character:madara",
      evidenceCorpusId: "naruto-dattebayo",
      evidenceKey: "character:1",
      sourceNote: "作者明确建立对应，并非按同名自动合并",
      now,
    });
    worlds.linkEvidence({
      worldId: "naruto",
      canonicalKey: "character:madara",
      evidenceCorpusId: "naruto-dattebayo",
      evidenceKey: "character:1",
      matchKind: "same_identity",
      reviewStatus: "verified",
      sourceNote: "明确原著人物对应",
      createdAt: now,
    });
    worlds.linkEvidence({
      worldId: "naruto",
      canonicalKey: "character:madara",
      evidenceCorpusId: "naruto-scraper",
      evidenceKey: "wiki:Madara",
      matchKind: "same_identity",
      reviewStatus: "candidate",
      sourceNote: "另一份有待审查的版本",
      createdAt: now,
    });
    const wiki = new SqliteMotherWorldEncyclopediaRepository(db);
    wiki.upsertLore({
      corpusId: "wiki:naruto",
      sourceKey: "character:madara",
      sectionKey: "life",
      title: "宇智波斑的编年史",
      content: "经过人工审核、独立于小说的完整原生人物传记。",
      sourceNote: "明确的来源版本",
      updatedAt: now,
    });
    const dossier = worlds.getDossier("naruto", "character:madara");
    expect(dossier?.world.kind).toBe("fictional");
    expect(dossier?.dossier.record.name).toBe("Madara Uchiha");
    expect(dossier?.dossier.lore[0].title).toBe("宇智波斑的编年史");
    expect(dossier?.evidence).toHaveLength(2);
    expect(dossier?.evidence.map((x) => x.reviewStatus).sort()).toEqual([
      "candidate",
      "verified",
    ]);
    expect(dossier?.evidence.map((x) => x.record.raw.strength).sort()).toEqual([
      "source-A",
      "source-B",
    ]);
    expect(worlds.getDossier("naruto", "character:missing")).toBeNull();
    expect(() =>
      worlds.linkEvidence({
        worldId: "naruto",
        canonicalKey: "character:madara",
        evidenceCorpusId: "history",
        evidenceKey: "other",
        matchKind: "same_identity",
        reviewStatus: "verified",
        sourceNote: "非法把其它原生母体同名者并入火影",
        createdAt: now,
      }),
    ).toThrow();
    expect(new SqliteCanonRepository(db).listEntities("book")).toHaveLength(0);
    expect(db.raw.prepare("SELECT count(*) AS n FROM projects").get()).toEqual({
      n: 0,
    });
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("one curated mother wiki serves two novel projects without duplicating or altering source history", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();
    const source = new SqliteSourceCorpusRepository(db);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    source.upsertCorpus({
      id: "wiki:era-1985",
      title: "1985年代百科",
      sourceUrl: "",
      rightsNotice: "test",
      importer: "curated",
      metadata: {},
      importedAt: now,
    });
    worlds.createWorld({
      id: "era-1985",
      name: "1985年代世界",
      kind: "era",
      canonicalCorpusId: "wiki:era-1985",
      description: "历史年代及现实产业、人物、社会力量参考",
      createdAt: now,
    });
    source.upsertRecord({
      corpusId: "wiki:era-1985",
      sourceKey: "organization:studio",
      name: "一家电影公司",
      kind: "organization",
      aliases: [],
      summary: "历史年代世界资料",
      raw: { era: "1985" },
      sourceUrl: "",
      originCollection: "curated",
      importedAt: now,
    });
    for (const id of ["book-A", "book-B"]) {
      new SqliteProjectRepository(db).insert(
        createProject({
          id,
          title: "独立项目 " + id,
          now,
        }),
      );
      source.bindProject(id, "wiki:era-1985");
      expect(source.listProjectCorpora(id)).toHaveLength(1);
    }
    expect(
      worlds.getDossier("era-1985", "organization:studio")?.dossier.record.name,
    ).toBe("一家电影公司");
    const canon = new SqliteCanonRepository(db);
    expect(canon.listEntities("book-A")).toHaveLength(0);
    expect(canon.listEntities("book-B")).toHaveLength(0);
  });
});
