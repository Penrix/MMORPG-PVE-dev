import { afterEach, describe, expect, it } from "vitest";
import {
  installSourceWorldSeed,
  normalizeBleachDatabase,
  normalizeHunterXHunterJikan,
  normalizeHunterXHunterStatic,
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


describe("Source World evidence enrichment", () => {
  it("lets later evidence thicken an existing canonical graph without overwriting author text", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();

    const base: SourceWorldSeed = {
      world: {
        id: "enrichment-world",
        name: "Enrichment World",
        kind: "fictional",
        canonicalCorpusId: "wiki:enrichment-world",
        canonicalTitle: "Enrichment World Atlas",
        description: "test",
        cognitiveMother: {
          summary: "Reader prior.",
          preloadedWorldGrammar: [],
          priceLogic: [],
          naturalEntrances: [],
          expectedInertia: [],
          attentionLogic: [],
          basis: "author_judgment",
          sourceNote: "test",
        },
      },
      corpora: [
        {
          id: "enrichment-base",
          title: "Base",
          sourceUrl: "https://example.invalid/base",
          rightsNotice: "test",
          importer: "test",
          metadata: {},
          evidenceRole: "primary",
          sourceNote: "base",
          records: [
            {
              sourceKey: "person:alice",
              canonicalKey: "character:alice",
              kind: "character",
              name: "Alice",
              raw: {},
              originCollection: "people",
            },
            {
              sourceKey: "guild:old",
              canonicalKey: "organization:old",
              kind: "organization",
              name: "Old Guild",
              raw: {},
              originCollection: "groups",
            },
          ],
          relations: [
            {
              fromKey: "person:alice",
              toKey: "guild:old",
              relation: "member_of_recorded",
              sourceNote: "base relation",
            },
          ],
        },
      ],
    };

    installSourceWorldSeed(db, base, now);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    const first = worlds.getCard("enrichment-world", "character:alice");
    expect(first?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "member_of_recorded",
          otherName: "Old Guild",
        }),
      ]),
    );

    worlds.upsertCard({
      worldId: "enrichment-world",
      entityKey: "character:alice",
      kind: "character",
      name: "Alice",
      content:
        (first?.content ?? "# Alice") +
        "\n\n## 作者深化\n这段人工正文必须在后续 evidence 导入后继续存在。",
      now: "2026-11-25T01:10:00.000Z",
    });

    const supporting: SourceWorldSeed = {
      world: base.world,
      corpora: [
        {
          id: "enrichment-support",
          title: "Support",
          sourceUrl: "https://example.invalid/support",
          rightsNotice: "test",
          importer: "test",
          metadata: {},
          evidenceRole: "supporting",
          sourceNote: "support",
          records: [
            {
              sourceKey: "hero:alice",
              canonicalKey: "character:alice",
              kind: "character",
              name: "Alice",
              raw: {},
              originCollection: "heroes",
            },
            {
              sourceKey: "guild:new",
              canonicalKey: "organization:new",
              kind: "organization",
              name: "New Guild",
              raw: {},
              originCollection: "groups",
            },
          ],
          relations: [
            {
              fromKey: "hero:alice",
              toKey: "guild:new",
              relation: "ally_of_recorded",
              sourceNote: "support relation",
            },
          ],
        },
      ],
    };

    installSourceWorldSeed(
      db,
      supporting,
      "2026-11-25T01:20:00.000Z",
    );
    const enriched = worlds.getCard("enrichment-world", "character:alice");
    expect(enriched?.content).toContain("作者深化");
    expect(enriched?.content).toContain("自动证据关系");
    expect(enriched?.content.match(/ally_of_recorded/g)?.length).toBe(1);
    expect(enriched?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "member_of_recorded",
          otherName: "Old Guild",
        }),
        expect.objectContaining({
          relation: "ally_of_recorded",
          otherName: "New Guild",
        }),
      ]),
    );

    installSourceWorldSeed(
      db,
      supporting,
      "2026-11-25T01:30:00.000Z",
    );
    const repeated = worlds.getCard("enrichment-world", "character:alice");
    expect(repeated?.content).toContain("作者深化");
    expect(repeated?.content.match(/ally_of_recorded/g)?.length).toBe(1);
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

  it("normalizes pinned Hunter x Hunter groups, Nen types and abilities", () => {
    const seed = normalizeHunterXHunterStatic({
      hunters: [
        {
          _id: 16,
          name: "Gon Freecss",
          japanese_name: "ゴン＝フリークス",
          also_known_as: ["Gon"],
          nen_type: ["Enhancement"],
          abilities: ["Jajanken"],
          professions: ["Hunter"],
        },
      ],
      ryodan: [
        {
          _id: 2,
          name: "Chrollo Lucilfer",
          nen_type: ["Specialization"],
          abilities: ["Skill Hunter"],
          professions: ["Leader of the Phantom Troupe"],
        },
      ],
      chimeraAnts: [
        {
          _id: 1,
          name: "Alligator",
          nen_type: [],
          abilities: [],
          professions: ["Chimera Ant"],
        },
      ],
    });
    const corpus = seed.corpora[0]!;
    expect(seed.world.id).toBe("hunter-x-hunter");
    expect(corpus.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "character", name: "Gon Freecss" }),
        expect.objectContaining({
          kind: "character",
          name: "Chrollo Lucilfer",
        }),
        expect.objectContaining({
          kind: "organization",
          name: "Hunter Association",
        }),
        expect.objectContaining({
          kind: "organization",
          name: "Phantom Troupe",
        }),
        expect.objectContaining({ kind: "organization", name: "Chimera Ants" }),
        expect.objectContaining({ kind: "ability", name: "Enhancement Nen" }),
        expect.objectContaining({ kind: "ability", name: "Jajanken" }),
      ]),
    );
    expect(corpus.relations.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining([
        "hunter_association_context",
        "phantom_troupe_roster_recorded",
        "chimera_ant_group_recorded",
        "nen_type_recorded",
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
