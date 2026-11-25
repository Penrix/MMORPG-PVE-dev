import { afterEach, describe, expect, it } from "vitest";
import {
  installSourceWorldSeed,
  normalizeBleachDatabase,
  normalizeHunterXHunterJikan,
  normalizeHunterXHunterMindMaps,
  normalizeHunterXHunterRoster,
  normalizeHunterXHunterStatic,
  normalizeOnePieceDataset,
  normalizeOnePieceWikiGraph,
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

    installSourceWorldSeed(db, supporting, "2026-11-25T01:20:00.000Z");
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

    installSourceWorldSeed(db, supporting, "2026-11-25T01:30:00.000Z");
    const repeated = worlds.getCard("enrichment-world", "character:alice");
    expect(repeated?.content).toContain("作者深化");
    expect(repeated?.content.match(/ally_of_recorded/g)?.length).toBe(1);
  });
});

describe("multi-world normalizers", () => {
  it("normalizes the rich One Piece graph with stable identity bridges and epistemic raw evidence", () => {
    const seed = normalizeOnePieceWikiGraph({
      hakiVocabulary: {
        values: {
          observation: { labels: { en: "Observation Haki" } },
          armament: { labels: { en: "Armament Haki" } },
          conqueror: { labels: { en: "Conqueror's Haki" } },
        },
      },
      translations: {
        "character.monkey-d-luffy.name.common": "Monkey D. Luffy",
        "crew.straw-hat-pirates.name": "Straw Hat Pirates",
        "devil-fruit.gomu-gomu-no-mi.name.common": "Gomu Gomu no Mi",
        "arc.egghead.name.common": "Egghead",
      },
      canonicalByIdentity: {
        ["character\0monkey d. luffy"]: "character:legacy-luffy",
      },
      entities: [
        {
          id: "character:monkey-d-luffy",
          type: "character",
          slug: "monkey-d-luffy",
          canonical_name_key: "character.monkey-d-luffy.name.common",
          properties: {
            bounty: [{ value: 3000000000, since: "manga-chapter:1053" }],
            haki_types: [
              { value: "observation", since: "manga-chapter:597" },
              { value: "armament", since: "manga-chapter:597" },
            ],
          },
          relations: [
            { type: "member-of", target: "crew:straw-hat-pirates" },
            { type: "ate-fruit", target: "devil-fruit:gomu-gomu-no-mi" },
          ],
        },
        {
          id: "crew:straw-hat-pirates",
          type: "crew",
          slug: "straw-hat-pirates",
          canonical_name_key: "crew.straw-hat-pirates.name",
          properties: {},
          relations: [],
        },
        {
          id: "devil-fruit:gomu-gomu-no-mi",
          type: "devil-fruit",
          slug: "gomu-gomu-no-mi",
          canonical_name_key: "devil-fruit.gomu-gomu-no-mi.name.common",
          properties: {
            classification: [
              {
                value: "paramecia",
                epistemic_status: "believed_by_world",
                actual_value: "mythical_zoan",
              },
            ],
            awakened: [{ value: true, since: "manga-chapter:1044" }],
            awakening_outcome: [{ value: "nika-form" }],
          },
          relations: [],
        },
        {
          id: "arc:egghead",
          type: "arc",
          slug: "egghead",
          canonical_name_key: "arc.egghead.name.common",
          properties: {},
          relations: [],
        },
      ],
    });
    const corpus = seed.corpora[0]!;
    expect(corpus.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "character:monkey-d-luffy",
          canonicalKey: "character:legacy-luffy",
          name: "Monkey D. Luffy",
          kind: "character",
        }),
        expect.objectContaining({
          sourceKey: "devil-fruit:gomu-gomu-no-mi",
          kind: "ability",
        }),
        expect.objectContaining({
          sourceKey: "rule:one-piece:haki-system",
          kind: "rule",
          name: "Haki System",
        }),
        expect.objectContaining({
          sourceKey: "rule:one-piece:haki:observation",
          kind: "rule",
          name: "Observation Haki",
        }),
        expect.objectContaining({
          sourceKey: "rule:one-piece:devil-fruit-system",
          kind: "rule",
        }),
        expect.objectContaining({
          sourceKey: "rule:one-piece:devil-fruit-class:paramecia",
          kind: "rule",
        }),
        expect.objectContaining({
          sourceKey: "rule:one-piece:devil-fruit-class:mythical-zoan",
          kind: "rule",
        }),
        expect.objectContaining({ sourceKey: "arc:egghead", kind: "event" }),
      ]),
    );
    const fruit = corpus.records.find(
      (record) => record.sourceKey === "devil-fruit:gomu-gomu-no-mi",
    );
    expect(JSON.stringify(fruit?.raw)).toContain("believed_by_world");
    expect(JSON.stringify(fruit?.raw)).toContain("mythical_zoan");
    expect(corpus.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "member-of",
          toKey: "crew:straw-hat-pirates",
        }),
        expect.objectContaining({
          relation: "ate-fruit",
          toKey: "devil-fruit:gomu-gomu-no-mi",
        }),
        expect.objectContaining({
          fromKey: "character:monkey-d-luffy",
          relation: "haki_type_recorded",
          toKey: "rule:one-piece:haki:observation",
        }),
        expect.objectContaining({
          fromKey: "devil-fruit:gomu-gomu-no-mi",
          relation: "devil_fruit_class_recorded",
          toKey: "rule:one-piece:devil-fruit-class:mythical-zoan",
        }),
        expect.objectContaining({
          fromKey: "devil-fruit:gomu-gomu-no-mi",
          relation: "awakening_recorded",
          toKey: "rule:one-piece:devil-fruit-awakening",
        }),
      ]),
    );
  });

  it("normalizes the rich HxH world graph into people, organizations, places, powers, events and routes", () => {
    const seed = normalizeHunterXHunterMindMaps({
      canonicalByIdentity: {
        ["character\0gon freecss"]: "character:legacy-gon",
      },
      characters: [
        {
          id: "char-hxh-gon",
          name: "Gon Freecss",
          factionIds: ["faction-hxh-hunter-association"],
          jutsuIds: ["jutsu-hxh-jajanken"],
          locationIds: ["loc-hxh-whale-island"],
          arcIds: ["arc-hxh-hunter-exam"],
          allies: ["char-hxh-killua"],
        },
        { id: "char-hxh-killua", name: "Killua Zoldyck" },
      ],
      factions: [
        {
          id: "faction-hxh-hunter-association",
          name: "Hunter Association",
          characterIds: ["char-hxh-gon"],
        },
      ],
      locations: [{ id: "loc-hxh-whale-island", name: "Whale Island" }],
      nations: [],
      arcs: [{ id: "arc-hxh-hunter-exam", name: "Hunter Exam Arc" }],
      events: [
        {
          id: "ev-hxh-exam-begins",
          name: "Hunter Exam begins",
          characterIds: ["char-hxh-gon"],
          locationId: "loc-hxh-whale-island",
          arcId: "arc-hxh-hunter-exam",
        },
      ],
      abilities: [
        {
          id: "jutsu-hxh-nen",
          name: "Nen",
          type: "nen",
          tags: ["fondamentale", "aura"],
          longDescription: {
            en: "Aura flows from the body's Aura Nodes; Nen is the system that controls it.",
          },
        },
        {
          id: "jutsu-hxh-ten",
          name: "Ten",
          type: "nen",
          tags: ["fondamentale"],
        },
        {
          id: "jutsu-hxh-gyo",
          name: "Gyo",
          type: "nen",
          tags: ["avanzata"],
        },
        {
          id: "jutsu-hxh-jajanken",
          name: "Jajanken",
          type: "enhancement",
          characterIds: ["char-hxh-gon"],
        },
      ],
      routes: [
        {
          id: "route-hxh-gon-journey",
          name: "Gon's journey",
          protagonistCharacterIds: ["char-hxh-gon"],
          steps: [
            {
              locationId: "loc-hxh-whale-island",
              eventId: "ev-hxh-exam-begins",
            },
          ],
        },
      ],
    });
    const corpus = seed.corpora[0]!;
    expect(corpus.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKey: "character:legacy-gon",
          kind: "character",
        }),
        expect.objectContaining({ kind: "organization" }),
        expect.objectContaining({ kind: "location" }),
        expect.objectContaining({ kind: "ability" }),
        expect.objectContaining({
          sourceKey: "rule:hxh:nen-system",
          kind: "rule",
          name: "Nen System",
        }),
        expect.objectContaining({
          sourceKey: "rule:hxh:nen-category:enhancement",
          kind: "rule",
          name: "Enhancement Nen",
        }),
        expect.objectContaining({ kind: "event" }),
        expect.objectContaining({ kind: "activity" }),
      ]),
    );
    expect(corpus.relations.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining([
        "member_of_recorded",
        "ability_listed",
        "location_association_recorded",
        "appears_in_arc_recorded",
        "ally_of_recorded",
        "involves_character_recorded",
        "occurs_at_recorded",
        "route_protagonist_recorded",
        "route_step_location_recorded",
        "route_step_event_recorded",
        "power_branch_of_recorded",
        "part_of_power_system_recorded",
        "nen_category_recorded",
        "fundamental_of_recorded",
        "advanced_application_of_recorded",
      ]),
    );
  });

  it("uses the HxH roster as supporting affiliation, arc, Nen and weapon evidence", () => {
    const seed = normalizeHunterXHunterRoster({
      canonicalByIdentity: {
        ["character\0gon freecss"]: "character:legacy-gon",
        ["organization\0hunter association"]:
          "organization:legacy-hunter-association",
      },
      roster: [
        {
          slug: "gon",
          name: "Gon Freecss",
          affiliation: "Hunter Association",
          nen_types: ["enhancement"],
          arcs: ["hunter-exam"],
          weapons: ["fishing-rod"],
          description: "A boy from Whale Island.",
        },
      ],
    });
    expect(seed.corpora[0]?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKey: "character:legacy-gon",
          name: "Gon Freecss",
        }),
        expect.objectContaining({
          canonicalKey: "organization:legacy-hunter-association",
        }),
        expect.objectContaining({ kind: "ability" }),
        expect.objectContaining({ kind: "item" }),
      ]),
    );
    expect(seed.corpora[0]?.relations.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining([
        "affiliation_recorded",
        "appears_in_arc_recorded",
        "nen_type_recorded",
        "weapon_recorded",
      ]),
    );
  });

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
        expect.objectContaining({
          kind: "rule",
          name: "Haki System",
          canonicalKey: "rule:one-piece:haki-system",
        }),
        expect.objectContaining({
          kind: "rule",
          name: "Conqueror's Haki",
          canonicalKey: "rule:one-piece:haki:conqueror",
        }),
      ]),
    );
    expect(corpus.relations.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining([
        "crew_member_recorded",
        "captain_of_recorded",
        "ship_recorded",
        "ability_listed",
        "haki_type_recorded",
        "power_branch_of_recorded",
        "power_branch_reference_recorded",
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
