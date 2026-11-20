import { afterEach, describe, expect, it } from "vitest";
import { createProject } from "@narralume/domain";
import {
  importNarutoDattebayo,
  importNarutoWikiScraper,
  NARUTO_DATTEBAYO_CORPUS,
  NARUTO_WIKI_CORPUS,
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteSourceCorpusRepository,
  type NarutoData,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-20T00:00:00.000Z";
let db: NodeNarrativeDatabase | null = null;

function example(): NarutoData {
  return {
    characters: [
      {
        id: 1293,
        name: "Itachi Uchiha",
        personal: { clan: "Uchiha", affiliation: "Konohagakure" },
        family: { father: "Fugaku Uchiha", brother: "Sasuke Uchiha" },
        jutsu: ["Amaterasu", "Tsukuyomi"],
        natureType: ["Fire Release"],
        debut: { manga: "Chapter #139" },
      },
      { id: 44, name: "Chibi", personal: { species: "Dog" }, jutsu: [] },
    ],
    clans: [
      { id: 45, name: "Uchiha", characters: [1293] },
      { id: 38, name: "Senju", characters: [99999] },
    ],
    villages: [{ id: 3, name: "Konohagakure", characters: [1293] }],
    teams: [{ id: 11, name: "Team Two", characters: [1293] }],
    "kekkei-genkai": [{ id: 5, name: "Sharingan", characters: [1293] }],
    "tailed-beasts": [{ id: 2, name: "Kurama", characters: [1293] }],
    akatsuki: [
      { id: 1293, name: "Itachi Uchiha", jutsu: ["Amaterasu", "Tsukuyomi"] },
      { id: 44, name: "Chibi", jutsu: [] }, // bad upstream specialty list ≠ member roster
    ],
    kara: [],
  };
}

afterEach(() => {
  db?.close();
  db = null;
});

describe("Naruto mother-world import into the ONE NarraLume SQLite", () => {
  it("imports real source entities, source links and full payload without declaring Project Reality", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(54);
    const projects = new SqliteProjectRepository(db);
    projects.insert(
      createProject({ id: "novel", title: "一书多世界的男频小说", now }),
    );
    projects.insert(
      createProject({ id: "other", title: "另一本独立小说", now }),
    );
    const result = importNarutoDattebayo(db, example(), now);
    expect(result.records).toBeGreaterThan(9);
    expect(result.skippedReferences).toBe(1);
    const source = new SqliteSourceCorpusRepository(db);
    const itachi = source.getRecord(NARUTO_DATTEBAYO_CORPUS, "character:1293");
    expect(itachi?.raw.family).toEqual({
      father: "Fugaku Uchiha",
      brother: "Sasuke Uchiha",
    });
    expect(itachi?.raw._sourceSupplements).toBeDefined();
    const links = source.listRelations(
      NARUTO_DATTEBAYO_CORPUS,
      "character:1293",
    );
    expect(
      links.some(
        (l) =>
          l.otherName === "Uchiha" && l.relation === "clan_member_recorded",
      ),
    ).toBe(true);
    expect(
      links.some(
        (l) =>
          l.otherName === "Sharingan" &&
          l.relation === "kekkei_genkai_recorded",
      ),
    ).toBe(true);
    expect(
      links.some(
        (l) => l.otherName === "Amaterasu" && l.relation === "jutsu_listed",
      ),
    ).toBe(true);
    const chibi = source.listRelations(NARUTO_DATTEBAYO_CORPUS, "character:44");
    expect(chibi.find((e) => e.toKey === "org:akatsuki")?.relation).toBe(
      "listed_in_specialty_dataset",
    );
    expect(chibi.some((e) => e.relation === "member_of")).toBe(false);

    source.bindProject("novel", NARUTO_DATTEBAYO_CORPUS);
    expect(source.search("Itachi", { projectId: "novel" })).toHaveLength(1);
    expect(source.search("Itachi", { projectId: "other" })).toHaveLength(0);
    expect(new SqliteCanonRepository(db).listEntities("novel")).toHaveLength(0);
    expect(
      new SqliteCanonRepository(db).listEffectiveFacts("novel"),
    ).toHaveLength(0);

    const count = source.getCorpus(NARUTO_DATTEBAYO_CORPUS)?.recordCount;
    importNarutoDattebayo(db, example(), now);
    expect(source.getCorpus(NARUTO_DATTEBAYO_CORPUS)?.recordCount).toBe(count);
    expect(source.search("Itachi", { projectId: "novel" })).toHaveLength(1);
  });

  it("keeps long Wiki biography separate and allows two corpora in one novel", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();
    new SqliteProjectRepository(db).insert(
      createProject({ id: "novel", title: "往返火影与海贼", now }),
    );
    importNarutoDattebayo(db, example(), now);
    importNarutoWikiScraper(
      db,
      [
        {
          name: "Itachi Uchiha",
          summary:
            "Character biography with full-life timeline, not current project truth.",
          clan: "Uchiha Clan",
          affiliation: ["Konohagakure", "Akatsuki"],
        },
      ],
      now,
    );
    const refs = new SqliteSourceCorpusRepository(db);
    refs.bindProject("novel", NARUTO_DATTEBAYO_CORPUS);
    refs.bindProject("novel", NARUTO_WIKI_CORPUS);
    expect(refs.listProjectCorpora("novel")).toHaveLength(2);
    expect(refs.search("Itachi", { projectId: "novel" })).toHaveLength(2);
    expect(
      refs.getRecord(NARUTO_WIKI_CORPUS, "wiki:Itachi Uchiha")?.raw,
    ).toHaveProperty("clan", "Uchiha Clan");
    expect(new SqliteCanonRepository(db).listEntities("novel")).toHaveLength(0);
  });

  it("refuses malformed and empty main datasets before modifying previous content", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();
    importNarutoDattebayo(db, example(), now);
    const bad = example();
    bad.characters = [];
    expect(() => importNarutoDattebayo(db!, bad, now)).toThrow(
      /empty characters/,
    );
    expect(
      new SqliteSourceCorpusRepository(db).getCorpus(NARUTO_DATTEBAYO_CORPUS)
        ?.recordCount,
    ).toBeGreaterThan(0);
  });
  it("deduplicates byte-identical wiki rows but never drops differing same-name biographies", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();
    const report = importNarutoWikiScraper(
      db,
      [
        { name: "Rahyō", summary: "First source record" },
        { name: "Rahyō", summary: "First source record" },
        { name: "Rahyō", summary: "Different source record" },
      ],
      now,
    );
    expect(report.records).toBe(2);
    expect(report.exactDuplicates).toBe(1);
    expect(report.duplicateNameVariants).toBe(1);
    const refs = new SqliteSourceCorpusRepository(db);
    expect(refs.getRecord(NARUTO_WIKI_CORPUS, "wiki:Rahyō")?.raw.summary).toBe(
      "First source record",
    );
    expect(
      refs.getRecord(NARUTO_WIKI_CORPUS, "wiki:Rahyō#2")?.raw.summary,
    ).toBe("Different source record");
  });
});
