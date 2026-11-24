import {
  getSourceWorldCatalogEntry,
  type SourceWorldCatalogEntry,
} from "./source-world-catalog.js";
import type {
  SourceWorldSeed,
  SourceWorldSeedCorpus,
  SourceWorldSeedRecord,
  SourceWorldSeedRelation,
} from "./source-world-seed.js";

type JsonObject = Record<string, unknown>;

export function normalizeOnePieceDataset(input: {
  characters: unknown;
  crews: unknown;
}): SourceWorldSeed {
  const entry = requiredCatalog("one-piece");
  const upstream = requiredUpstream(entry, "one-piece-dataset");
  const characters = arrayOfObjects(input.characters);
  const crews = arrayOfObjects(input.crews);
  const records = new Map<string, SourceWorldSeedRecord>();
  const relations: SourceWorldSeedRelation[] = [];
  const relationIds = new Set<string>();

  const addRecord = (record: SourceWorldSeedRecord): void => {
    if (!records.has(record.sourceKey)) records.set(record.sourceKey, record);
  };
  const addRelation = (
    fromKey: string,
    toKey: string,
    relation: string,
    sourceNote: string,
  ): void => {
    const id = fromKey + "|" + relation + "|" + toKey;
    if (relationIds.has(id)) return;
    relationIds.add(id);
    relations.push({ fromKey, toKey, relation, sourceNote });
  };

  for (const crew of crews) {
    const id = text(crew.id);
    const name = text(crew.name);
    if (!id || !name) continue;
    const crewKey = "crew:" + id.toLowerCase();
    addRecord({
      sourceKey: crewKey,
      canonicalKey: "organization:" + crewKey,
      kind: "organization",
      name,
      summary: "Pirate crew record from the One Piece community dataset.",
      raw: crew,
      sourceUrl: rawUrl(upstream, "pirate-crews.json"),
      originCollection: "pirate-crews",
    });

    const ship = text(crew.ship);
    if (ship) {
      const shipKey = "ship:" + slug(ship);
      addRecord({
        sourceKey: shipKey,
        canonicalKey: "item:" + shipKey,
        kind: "item",
        name: ship,
        summary: "Ship named by the upstream pirate-crew record.",
        raw: { name: ship, crew: name },
        sourceUrl: rawUrl(upstream, "pirate-crews.json"),
        originCollection: "pirate-crews",
      });
      addRelation(
        crewKey,
        shipKey,
        "ship_recorded",
        "Upstream pirate crew ship field.",
      );
    }
  }

  const characterByName = new Map<string, string>();
  for (const row of characters) {
    const id = text(row.id);
    const name = text(row.name);
    if (!id || !name) continue;
    const characterKey = "character:" + id.toLowerCase();
    characterByName.set(name.toLowerCase(), characterKey);
    addRecord({
      sourceKey: characterKey,
      canonicalKey: characterKey,
      kind: "character",
      name,
      summary: text(row.description),
      raw: row,
      sourceUrl: rawUrl(upstream, "characters.json"),
      originCollection: "characters",
    });

    const crew = object(row.pirateCrew);
    const crewId = text(crew?.id);
    const crewName = text(crew?.name);
    if (crewId && crewName) {
      const crewKey = "crew:" + crewId.toLowerCase();
      addRecord({
        sourceKey: crewKey,
        canonicalKey: "organization:" + crewKey,
        kind: "organization",
        name: crewName,
        summary: "Pirate crew referenced by a character record.",
        raw: crew ?? {},
        sourceUrl: rawUrl(upstream, "characters.json"),
        originCollection: "characters",
      });
      addRelation(
        characterKey,
        crewKey,
        "crew_member_recorded",
        "Embedded pirateCrew field in upstream character record.",
      );
    }

    for (const ability of stringArray(row.abilities)) {
      const abilityKey = "ability:" + slug(ability);
      addRecord({
        sourceKey: abilityKey,
        canonicalKey: abilityKey,
        kind: "ability",
        name: ability,
        summary: "Ability or skill listed by the upstream character record.",
        raw: { name: ability },
        sourceUrl: rawUrl(upstream, "characters.json"),
        originCollection: "characters.abilities",
      });
      addRelation(
        characterKey,
        abilityKey,
        "ability_listed",
        "Verbatim upstream abilities[] entry; availability/mechanics remain provenance-aware.",
      );
    }
  }

  for (const crew of crews) {
    const id = text(crew.id);
    const captain = text(crew.captain);
    if (!id || !captain) continue;
    const captainKey = characterByName.get(captain.toLowerCase());
    if (!captainKey) continue;
    addRelation(
      captainKey,
      "crew:" + id.toLowerCase(),
      "captain_of_recorded",
      "Upstream pirate crew captain field.",
    );
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "One Piece community structured dataset",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "Community-maintained dataset. Preserve upstream provenance; imported assertions are not treated as official franchise canon.",
      importer: "one-piece-dataset-v1",
      metadata: {
        repository: upstream.repository,
        ref: upstream.ref,
        paths: upstream.paths,
      },
      evidenceRole: "primary",
      sourceNote:
        "Structured seed for characters, crews, ships and listed abilities.",
      records: [...records.values()],
      relations,
    },
  ]);
}

export function normalizeBleachDatabase(input: {
  shinigami: unknown;
  arrancar: unknown;
  quincy: unknown;
  humans: unknown;
}): SourceWorldSeed {
  const entry = requiredCatalog("bleach");
  const upstream = requiredUpstream(entry, "bleach-database");
  const records = new Map<string, SourceWorldSeedRecord>();
  const relations: SourceWorldSeedRelation[] = [];
  const relationIds = new Set<string>();

  const addRecord = (record: SourceWorldSeedRecord): void => {
    if (!records.has(record.sourceKey)) records.set(record.sourceKey, record);
  };
  const addRelation = (
    fromKey: string,
    toKey: string,
    relation: string,
    sourceNote: string,
  ): void => {
    const id = fromKey + "|" + relation + "|" + toKey;
    if (relationIds.has(id)) return;
    relationIds.add(id);
    relations.push({ fromKey, toKey, relation, sourceNote });
  };

  for (const [collection, value] of Object.entries(input)) {
    for (const row of arrayOfObjects(value)) {
      const id = text(row.id);
      const nameValue = object(row.name);
      const name =
        text(nameValue?.english) || text(nameValue?.romaji) || text(row.name);
      if (!id || !name) continue;
      const characterKey = "character:" + collection + ":" + id.toLowerCase();
      addRecord({
        sourceKey: characterKey,
        canonicalKey: characterKey,
        kind: "character",
        name,
        aliases: [text(nameValue?.romaji), text(nameValue?.kanji)].filter(
          Boolean,
        ),
        summary: text(row.description),
        raw: row,
        sourceUrl: rawUrl(upstream, "data/" + collection + ".json"),
        originCollection: collection,
      });

      const stats = object(row.stats);
      const professional = findNestedObject(stats, "professional status");
      const skills = findNestedObject(stats, "primary skills");

      for (const [field, relation] of [
        ["affiliation", "affiliation_recorded"],
        ["previous affiliation", "previous_affiliation_recorded"],
        ["team", "team_recorded"],
        ["previous team", "previous_team_recorded"],
      ] as const) {
        const valueText = scalarFromKey(professional, field);
        for (const organization of splitMultiValue(valueText)) {
          const organizationKey = "org:" + slug(organization);
          addRecord({
            sourceKey: organizationKey,
            canonicalKey: "organization:" + organizationKey,
            kind: "organization",
            name: organization,
            summary:
              "Organization/team name extracted from Bleach professional-status evidence.",
            raw: { name: organization, sourceField: field },
            sourceUrl: rawUrl(upstream, "data/" + collection + ".json"),
            originCollection: collection + ".stats.Professional Status",
          });
          addRelation(
            characterKey,
            organizationKey,
            relation,
            "Extracted from upstream Professional Status." + field + ".",
          );
        }
      }

      const base = scalarFromKey(professional, "base of operations");
      for (const location of splitMultiValue(base)) {
        const locationKey = "location:" + slug(location);
        addRecord({
          sourceKey: locationKey,
          canonicalKey: locationKey,
          kind: "location",
          name: location,
          summary:
            "Base of operations named by Bleach professional-status evidence.",
          raw: { name: location },
          sourceUrl: rawUrl(upstream, "data/" + collection + ".json"),
          originCollection: collection + ".stats.Professional Status",
        });
        addRelation(
          characterKey,
          locationKey,
          "base_of_operations_recorded",
          "Extracted from upstream Professional Status.base of operations.",
        );
      }

      for (const ability of scalarLeaves(skills).slice(0, 30)) {
        if (!ability || ability.length > 180) continue;
        const abilityKey = "ability:" + slug(ability);
        addRecord({
          sourceKey: abilityKey,
          canonicalKey: abilityKey,
          kind: "ability",
          name: ability,
          summary:
            "Primary skill or named power extracted from Bleach upstream evidence.",
          raw: { name: ability },
          sourceUrl: rawUrl(upstream, "data/" + collection + ".json"),
          originCollection: collection + ".stats.Primary Skills",
        });
        addRelation(
          characterKey,
          abilityKey,
          "ability_listed",
          "Extracted from upstream Primary Skills; mechanics and historical availability remain source-bound.",
        );
      }
    }
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "Bleach community structured database",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "Community-maintained dataset derived from franchise reference material. Preserve provenance; imported assertions are not official canon verification.",
      importer: "bleach-database-v1",
      metadata: {
        repository: upstream.repository,
        ref: upstream.ref,
        paths: upstream.paths,
      },
      evidenceRole: "primary",
      sourceNote:
        "Bulk character evidence grouped by Shinigami, Arrancar, Quincy and Humans.",
      records: [...records.values()],
      relations,
    },
  ]);
}

export function normalizeHunterXHunterStatic(input: {
  hunters: unknown;
  ryodan: unknown;
  chimeraAnts: unknown;
}): SourceWorldSeed {
  const entry = requiredCatalog("hunter-x-hunter");
  const upstream = requiredUpstream(entry, "hxh-static-database");
  const records = new Map<string, SourceWorldSeedRecord>();
  const relations: SourceWorldSeedRelation[] = [];
  const relationIds = new Set<string>();

  const addRecord = (record: SourceWorldSeedRecord): void => {
    if (!records.has(record.sourceKey)) records.set(record.sourceKey, record);
  };
  const addRelation = (
    fromKey: string,
    toKey: string,
    relation: string,
    sourceNote: string,
  ): void => {
    const id = fromKey + "|" + relation + "|" + toKey;
    if (relationIds.has(id)) return;
    relationIds.add(id);
    relations.push({ fromKey, toKey, relation, sourceNote });
  };

  const collections: Array<{
    id: "hunters" | "ryodan" | "chimeraAnts";
    rows: JsonObject[];
    organization: { key: string; name: string; relation: string };
  }> = [
    {
      id: "hunters",
      rows: arrayOfObjects(input.hunters),
      organization: {
        key: "org:hunter-association",
        name: "Hunter Association",
        relation: "hunter_association_context",
      },
    },
    {
      id: "ryodan",
      rows: arrayOfObjects(input.ryodan),
      organization: {
        key: "org:phantom-troupe",
        name: "Phantom Troupe",
        relation: "phantom_troupe_roster_recorded",
      },
    },
    {
      id: "chimeraAnts",
      rows: arrayOfObjects(input.chimeraAnts),
      organization: {
        key: "org:chimera-ants",
        name: "Chimera Ants",
        relation: "chimera_ant_group_recorded",
      },
    },
  ];

  for (const collection of collections) {
    addRecord({
      sourceKey: collection.organization.key,
      canonicalKey: "organization:" + collection.organization.key,
      kind: "organization",
      name: collection.organization.name,
      summary:
        "Collection-level organization/group context supplied by the pinned Hunter x Hunter community dataset.",
      raw: { collection: collection.id },
      sourceUrl: rawUrl(
        upstream,
        "src/data/" +
          (collection.id === "chimeraAnts" ? "chimeraAnts" : collection.id) +
          ".json",
      ),
      originCollection: collection.id,
    });

    for (const row of collection.rows) {
      const id = numberText(row._id);
      const name = text(row.name);
      if (!id || !name) continue;
      const characterKey =
        "character:" + collection.id.toLowerCase() + ":" + id;
      addRecord({
        sourceKey: characterKey,
        canonicalKey: characterKey,
        kind: "character",
        name,
        aliases: [
          ...stringArray(row.also_known_as),
          text(row.japanese_name),
        ].filter(Boolean),
        summary:
          "Hunter x Hunter character record from pinned static " +
          collection.id +
          " dataset.",
        raw: row,
        sourceUrl: rawUrl(
          upstream,
          "src/data/" +
            (collection.id === "chimeraAnts" ? "chimeraAnts" : collection.id) +
            ".json",
        ),
        originCollection: collection.id,
      });
      addRelation(
        characterKey,
        collection.organization.key,
        collection.organization.relation,
        "Collection membership/context from pinned upstream dataset; interpret according to source collection rather than as universal current membership.",
      );

      for (const nenType of stringArray(row.nen_type)) {
        const nenKey = "nen-type:" + slug(nenType);
        addRecord({
          sourceKey: nenKey,
          canonicalKey: "ability:" + nenKey,
          kind: "ability",
          name: nenType + " Nen",
          summary: "Nen category listed by upstream character record.",
          raw: { nenType },
          sourceUrl: upstream.sourceUrl,
          originCollection: collection.id + ".nen_type",
        });
        addRelation(
          characterKey,
          nenKey,
          "nen_type_recorded",
          "Verbatim upstream nen_type[] entry.",
        );
      }

      for (const ability of stringArray(row.abilities)) {
        const abilityKey = "ability:" + slug(ability);
        addRecord({
          sourceKey: abilityKey,
          canonicalKey: abilityKey,
          kind: "ability",
          name: ability,
          summary: "Named ability listed by upstream character record.",
          raw: { name: ability },
          sourceUrl: upstream.sourceUrl,
          originCollection: collection.id + ".abilities",
        });
        addRelation(
          characterKey,
          abilityKey,
          "ability_listed",
          "Verbatim upstream abilities[] entry; mechanics and time availability remain source-bound.",
        );
      }
    }
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "Hunter x Hunter pinned static community database",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "Community-maintained dataset. Preserve pinned repository provenance; imported assertions are not official franchise canon verification.",
      importer: "hxh-static-v1",
      metadata: {
        repository: upstream.repository,
        ref: upstream.ref,
        paths: upstream.paths,
      },
      evidenceRole: "primary",
      sourceNote:
        "Deterministic static seed covering Hunters, Phantom Troupe, Chimera Ants, Nen types and named abilities.",
      records: [...records.values()],
      relations,
    },
  ]);
}

export function normalizeHunterXHunterJikan(
  response: unknown,
): SourceWorldSeed {
  const entry = requiredCatalog("hunter-x-hunter");
  const upstream = requiredUpstream(entry, "jikan-hxh-2011-cast");
  const root = object(response);
  const data = arrayOfObjects(root?.data);
  const records: SourceWorldSeedRecord[] = [];

  for (const row of data) {
    const character = object(row.character);
    const id = numberText(character?.mal_id);
    const name = text(character?.name);
    if (!id || !name) continue;
    const sourceKey = "character:mal:" + id;
    records.push({
      sourceKey,
      canonicalKey: sourceKey,
      kind: "character",
      name,
      summary:
        "Hunter x Hunter cast identity from Jikan/MyAnimeList metadata; role=" +
        (text(row.role) || "unknown"),
      raw: {
        role: row.role ?? null,
        character,
      },
      sourceUrl: text(character?.url) || upstream.sourceUrl,
      originCollection: "anime:11061:characters",
    });
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "Hunter x Hunter 2011 cast via Jikan",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "Jikan is an unofficial MyAnimeList API. Import only metadata returned by the public endpoint and preserve source provenance.",
      importer: "jikan-anime-cast-v1",
      metadata: {
        endpoint: upstream.endpoint,
        animeMalId: 11061,
        source: "Jikan/MyAnimeList",
      },
      evidenceRole: "primary",
      sourceNote:
        "Broad cast identity/role seed only. Nen, organizations and world mechanics require richer evidence adapters.",
      records,
      relations: [],
    },
  ]);
}

function seed(
  entry: SourceWorldCatalogEntry,
  corpora: SourceWorldSeedCorpus[],
): SourceWorldSeed {
  return {
    world: {
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      canonicalCorpusId: entry.canonicalCorpusId,
      canonicalTitle: entry.name + "：统一原生母体 Atlas",
      description: entry.description,
      cognitiveMother: entry.cognitiveMother,
    },
    corpora,
  };
}

function requiredCatalog(id: string): SourceWorldCatalogEntry {
  const entry = getSourceWorldCatalogEntry(id);
  if (!entry) throw new Error("source.world.catalog.missing:" + id);
  return entry;
}

function requiredUpstream(
  entry: SourceWorldCatalogEntry,
  id: string,
): SourceWorldCatalogEntry["upstreams"][number] {
  const upstream = entry.upstreams.find((candidate) => candidate.id === id);
  if (!upstream) throw new Error("source.world.catalog.upstream_missing:" + id);
  return upstream;
}

function rawUrl(
  upstream: SourceWorldCatalogEntry["upstreams"][number],
  path: string,
): string {
  return upstream.repository && upstream.ref
    ? "https://raw.githubusercontent.com/" +
        upstream.repository +
        "/" +
        upstream.ref +
        "/" +
        path
    : upstream.sourceUrl;
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberText(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : text(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : typeof value === "string" && value.trim()
      ? [value.trim()]
      : [];
}

function slug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  if (normalized) return normalized;
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return "u-" + hash.toString(16);
}

function findNestedObject(
  parent: JsonObject | null,
  expectedKey: string,
): JsonObject | null {
  if (!parent) return null;
  const found = Object.entries(parent).find(
    ([key]) => key.toLowerCase() === expectedKey.toLowerCase(),
  );
  return found ? object(found[1]) : null;
}

function scalarFromKey(parent: JsonObject | null, expectedKey: string): string {
  if (!parent) return "";
  const found = Object.entries(parent).find(
    ([key]) => key.toLowerCase() === expectedKey.toLowerCase(),
  );
  if (!found) return "";
  const value = found[1];
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value).trim();
  if (Array.isArray(value))
    return value
      .filter(
        (item) =>
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean",
      )
      .map(String)
      .join(", ");
  return "";
}

function scalarLeaves(value: JsonObject | null): string[] {
  if (!value) return [];
  const out: string[] = [];
  const visit = (current: unknown): void => {
    if (
      typeof current === "string" ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      const item = String(current).trim();
      if (item) out.push(item);
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }
    if (current && typeof current === "object")
      for (const item of Object.values(current as JsonObject)) visit(item);
  };
  visit(value);
  return [...new Set(out)];
}

function splitMultiValue(value: string): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[,;/|]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
