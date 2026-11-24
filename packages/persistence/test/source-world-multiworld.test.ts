import { afterEach, describe, expect, it } from "vitest";
import {
  installSourceWorldSeed,
  normalizeBleachDatabase,
  normalizeHunterXHunterJikan,
  normalizeOnePieceDataset,
  SqliteCanonRepository,
  SqliteUnifiedSourceWorldRepository,
  type SourceWorldSeed,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

let db: NodeNarrativeDatabase | null = null;
const now = "2026-11-25T01:00:00.000Z";

afterEach(() => {
  db?.close();
  db = null;
});

describe("generic multi-world Source seed installer", () => {
  it("installs evidence into one reusable Source World without Project Canon writes and preserves author cards", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();

    const seed: SourceWorldSeed = {
      world: {
        id: "demo-world",
        name: "Demo World",
        kind: "fictional",
        canonicalCorpusId: "wiki:demo-world",
        canonicalTitle: "Demo World Atlas",
        description: "test",
        cognitiveMother: {
          summary: "Reader prior.",
          preloadedWorldGrammar: ["organizations and abilities"],
          priceLogic: ["rare ability is expensive"],
          naturalEntrances: ["join organization"],
          expectedInertia: ["world keeps running"],
          attentionLogic: ["low-status access attracts attention"],
          basis: "author_judgment",
          sourceNote: "test",
        },
      },
      corpora: [
        {
          id: "demo-source",
          title: "Demo Source",
          sourceUrl: "https://example.invalid/demo",
          rightsNotice: "test",
          importer: "test",
          metadata: {},
          evidenceRole: "primary",
          sourceNote: "test source",
          records: [
            {
              sourceKey: "person:1",
              canonicalKey: "character:1",
              kind: "character",
              name: "Alice",
              raw: { rank: "rookie" },
              originCollection: "people",
            },
            {
              sourceKey: "group:1",
              canonicalKey: "organization:1",
              kind: "organization",
              name: "Guild",
              raw: {},
              originCollection: "groups",
            },
          ],
          relations: [
            {
              fromKey: "person:1",
              toKey: "group:1",
              relation: "member_of_recorded",
              sourceNote: "fixture",
            },
          ],
        },
      ],
    };

    const first = installSourceWorldSeed(db, seed, now);
    expect(first.createdCards).toBe(2);
    expect(first.evidenceRecords).toBe(2);
    expect(first.evidenceRelations).toBe(1);

    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    expect(worlds.getWorld("demo-world")?.canonicalCorpusId).toBe(
      "wiki:demo-world",
    );
    expect(worlds.getCognitiveMother("demo-world")?.summary).toBe(
      "Reader prior.",
    );
    expect(worlds.getCard("demo-world", "character:1")?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "member_of_recorded",
          otherName: "Guild",
        }),
      ]),
    );
    expect(
      new SqliteCanonRepository(db).listEntities("missing-project"),
    ).toEqual([]);

    worlds.upsertCard({
      worldId: "demo-world",
      entityKey: "character:1",
      kind: "character",
      name: "Alice",
      content: "# Alice\n\n作者人工深化，重导入不得覆盖。",
      now: "2026-11-25T01:01:00.000Z",
    });
    const second = installSourceWorldSeed(db, seed, "2026-11-25T01:02:00.000Z");
    expect(second.createdCards).toBe(0);
    expect(worlds.getCard("demo-world", "character:1")?.content).toContain(
      "作者人工深化",
    );
  });
});

describe("multi-world normalizers", () => {
  it("normalizes One Piece characters, crews, ships and abilities", () => {
    const seed = normalizeOnePieceDataset({
      characters: [
        {
          id: "OPC-001",
          name: "Monkey D. Luffy",
          description: "Captain",
          abilities: ["Gear Fifth", "Conqueror's Haki"],
          pirateCrew: {
            id: "CREW-001",
            name: "Straw Hat Pirates",
            ship: "Thousand Sunny",
          },
        },
      ],
      crews: [
        {
          id: "CREW-001",
          name: "Straw Hat Pirates",
          captain: "Monkey D. Luffy",
          ship: "Thousand Sunny",
        },
      ],
    });
    const corpus = seed.corpora[0]!;
    expect(seed.world.id).toBe("one-piece");
    expect(corpus.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "character",
          name: "Monkey D. Luffy",
        }),
        expect.objectContaining({
          kind: "organization",
          name: "Straw Hat Pirates",
        }),
        expect.objectContaining({ kind: "item", name: "Thousand Sunny" }),
        expect.objectContaining({ kind: "ability", name: "Gear Fifth" }),
      ]),
    );
    expect(corpus.relations.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining([
        "crew_member_recorded",
        "captain_of_recorded",
        "ship_recorded",
        "ability_listed",
      ]),
    );
  });

  it("normalizes Bleach professional status, base and primary skills", () => {
    const seed = normalizeBleachDatabase({
      shinigami: [],
      arrancar: [],
      humans: [],
      quincy: [
        {
          id: "robert_accutrone",
          name: { english: "Robert Accutrone" },
          description: "Quincy",
          stats: {
            "Professional Status": {
              "previous affiliation": "Wandenreich",
              "previous team": "Sternritter",
              "base of operations": "Silbern",
            },
            "Primary Skills": {
              "spirit weapon": "Reishi Pistol",
              vollstandig: "Grimaniel",
            },
          },
        },
      ],
    });
    const corpus = seed.corpora[0]!;
    expect(seed.world.id).toBe("bleach");
    expect(corpus.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "character",
          name: "Robert Accutrone",
        }),
        expect.objectContaining({
          kind: "organization",
          name: "Wandenreich",
        }),
        expect.objectContaining({ kind: "organization", name: "Sternritter" }),
        expect.objectContaining({ kind: "location", name: "Silbern" }),
        expect.objectContaining({ kind: "ability", name: "Reishi Pistol" }),
        expect.objectContaining({ kind: "ability", name: "Grimaniel" }),
      ]),
    );
    expect(corpus.relations.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining([
        "previous_affiliation_recorded",
        "previous_team_recorded",
        "base_of_operations_recorded",
        "ability_listed",
      ]),
    );
  });

  it("normalizes a broad Hunter x Hunter cast seed from Jikan", () => {
    const seed = normalizeHunterXHunterJikan({
      data: [
        {
          role: "Main",
          character: {
            mal_id: 30,
            name: "Gon Freecss",
            url: "https://myanimelist.net/character/30/Gon_Freecss",
          },
        },
        {
          role: "Main",
          character: {
            mal_id: 27,
            name: "Killua Zoldyck",
            url: "https://myanimelist.net/character/27/Killua_Zoldyck",
          },
        },
      ],
    });
    expect(seed.world.id).toBe("hunter-x-hunter");
    expect(seed.corpora[0]?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "character:mal:30",
          name: "Gon Freecss",
        }),
        expect.objectContaining({
          sourceKey: "character:mal:27",
          name: "Killua Zoldyck",
        }),
      ]),
    );
  });
});
