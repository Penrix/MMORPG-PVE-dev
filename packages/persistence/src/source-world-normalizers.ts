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

  const hakiRootEvidenceKey = "power-rule:haki-system";
  const ensureHakiRule = (type: string, displayName: string): string => {
    addRecord({
      sourceKey: hakiRootEvidenceKey,
      canonicalKey: "rule:one-piece:haki-system",
      kind: "rule",
      name: "Haki System",
      summary:
        "Haki system context projected from exact Haki names in the pinned character abilities evidence.",
      raw: { projection: "recognized_from_character_abilities" },
      sourceUrl: rawUrl(upstream, "characters.json"),
      originCollection: "characters.abilities",
    });
    const branchKey = "power-rule:haki:" + type;
    addRecord({
      sourceKey: branchKey,
      canonicalKey: "rule:one-piece:haki:" + type,
      kind: "rule",
      name: displayName,
      summary:
        "Haki branch recognized from an exact upstream abilities[] entry.",
      raw: { hakiType: type, sourceAbilityName: displayName },
      sourceUrl: rawUrl(upstream, "characters.json"),
      originCollection: "characters.abilities",
    });
    addRelation(
      branchKey,
      hakiRootEvidenceKey,
      "power_branch_of_recorded",
      "Exact Haki ability label projected into the shared Haki rule hierarchy.",
    );
    return branchKey;
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

      const hakiType = onePieceHakiType(ability);
      if (hakiType) {
        const branchKey = ensureHakiRule(hakiType, ability);
        addRelation(
          characterKey,
          branchKey,
          "haki_type_recorded",
          "Exact Haki name recognized from upstream character abilities[].",
        );
        addRelation(
          abilityKey,
          branchKey,
          "power_branch_reference_recorded",
          "The listed ability is an instance/reference of this Haki branch.",
        );
      }
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

function onePieceHakiType(name: string): string | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/\s+/g, " ");
  const exact: Record<string, string> = {
    "observation haki": "observation",
    "armament haki": "armament",
    "conqueror's haki": "conqueror",
    "advanced observation": "advanced_observation",
    "advanced observation haki": "advanced_observation",
    "advanced armament": "advanced_armament",
    "advanced armament haki": "advanced_armament",
    "advanced conqueror's": "advanced_conqueror",
    "advanced conqueror's haki": "advanced_conqueror",
  };
  return exact[normalized] ?? null;
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

  const ensureRule = (
    sourceKey: string,
    canonicalKey: string,
    name: string,
    summary: string,
    collection: string,
  ): string => {
    addRecord({
      sourceKey,
      canonicalKey,
      kind: "rule",
      name,
      summary,
      raw: { projection: "derived_from_structured_bleach_power_fields" },
      sourceUrl: upstream.sourceUrl,
      originCollection: collection,
    });
    return sourceKey;
  };

  const ensureAbility = (
    ability: string,
    collection: string,
    sourceField: string,
  ): string | null => {
    if (!isConcreteBleachPowerValue(ability) || ability.length > 180) return null;
    const abilityKey = "ability:" + slug(ability);
    addRecord({
      sourceKey: abilityKey,
      canonicalKey: abilityKey,
      kind: "ability",
      name: ability,
      summary:
        "Named power/form/skill extracted from structured Bleach upstream evidence.",
      raw: { name: ability, sourceField },
      sourceUrl: rawUrl(upstream, "data/" + collection + ".json"),
      originCollection: collection + "." + sourceField,
    });
    return abilityKey;
  };

  const ensureZanpakutoRoot = (): string =>
    ensureRule(
      "power-rule:zanpakuto-system",
      "rule:bleach:zanpakuto-system",
      "Zanpakutō System",
      "POWER rule root projected from structured stats.Zanpakutō evidence.",
      "power-system/zanpakuto",
    );

  const ensureZanpakutoStage = (
    stage: "shikai" | "bankai" | "shinuchi" | "resurreccion",
    name: string,
    sourceField: string,
  ): string => {
    const root = ensureZanpakutoRoot();
    const key = "power-rule:zanpakuto-stage:" + stage;
    ensureRule(
      key,
      "rule:bleach:zanpakuto-stage:" + stage,
      name,
      "Zanpakutō-related stage/form projected from structured " +
        sourceField +
        " evidence.",
      "power-system/zanpakuto/stages",
    );
    addRelation(
      key,
      root,
      "power_branch_of_recorded",
      "The upstream stores " + sourceField + " under stats.Zanpakutō.",
    );
    return key;
  };

  const ensureQuincyRoot = (): string =>
    ensureRule(
      "power-rule:quincy-system",
      "rule:bleach:quincy-system",
      "Quincy Power System",
      "POWER rule root projected from structured Quincy Primary Skills evidence.",
      "power-system/quincy",
    );

  const ensureVollstandigRule = (): string => {
    const root = ensureQuincyRoot();
    const key = "power-rule:quincy-stage:vollstandig";
    ensureRule(
      key,
      "rule:bleach:quincy-stage:vollstandig",
      "Quincy: Vollständig",
      "Quincy power stage/form projected from the structured vollständig field.",
      "power-system/quincy/stages",
    );
    addRelation(
      key,
      root,
      "power_branch_of_recorded",
      "The upstream exposes vollständig as a structured Quincy Primary Skills field.",
    );
    return key;
  };

  const ensureFullbringRoot = (): string =>
    ensureRule(
      "power-rule:fullbring-system",
      "rule:bleach:fullbring-system",
      "Fullbring System",
      "POWER rule root projected from structured Human Primary Skill.fullbring evidence.",
      "power-system/fullbring",
    );

  for (const [collection, value] of Object.entries(input)) {
    for (const row of arrayOfObjects(value)) {
      const id = text(row.id);
      const nameValue = object(row.name);
      const name =
        text(nameValue?.english) || text(nameValue?.romaji) || text(row.name);
      if (!id || !name) continue;
      const characterKey = "character:" + collection + ":" + id.toLowerCase();
      const sourcePath = "data/" + collection + ".json";
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
        sourceUrl: rawUrl(upstream, sourcePath),
        originCollection: collection,
      });

      const stats = object(row.stats);
      const professional = findNestedObject(stats, "professional status");
      const skills =
        findNestedObject(stats, "primary skills") ??
        findNestedObject(stats, "primary skill");
      const zanpakuto = findNestedObject(stats, "zanpakutō");

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
            sourceUrl: rawUrl(upstream, sourcePath),
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
          sourceUrl: rawUrl(upstream, sourcePath),
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
        const abilityKey = ensureAbility(
          ability,
          collection,
          skills === findNestedObject(stats, "primary skill")
            ? "stats.Primary Skill"
            : "stats.Primary Skills",
        );
        if (!abilityKey) continue;
        addRelation(
          characterKey,
          abilityKey,
          "ability_listed",
          "Extracted from upstream Primary Skill(s); mechanics and historical availability remain source-bound.",
        );
      }

      for (const [field, stage, displayName, relation] of [
        ["shikai", "shikai", "Shikai", "shikai_recorded"],
        ["bankai", "bankai", "Bankai", "bankai_recorded"],
        ["shin'uchi", "shinuchi", "Shin'uchi", "shinuchi_recorded"],
        [
          "resurrección",
          "resurreccion",
          "Resurrección",
          "resurreccion_recorded",
        ],
      ] as const) {
        const valueText = scalarFromKey(zanpakuto, field);
        const abilityKey = ensureAbility(
          valueText,
          collection,
          "stats.Zanpakutō." + field,
        );
        if (!abilityKey) continue;
        const stageKey = ensureZanpakutoStage(
          stage,
          displayName,
          "stats.Zanpakutō." + field,
        );
        addRelation(
          characterKey,
          abilityKey,
          relation,
          "Exact named form from upstream stats.Zanpakutō." + field + ".",
        );
        addRelation(
          abilityKey,
          stageKey,
          "power_stage_recorded",
          "Named form belongs to the structured " + displayName + " field.",
        );
      }

      if (collection === "quincy") {
        const root = ensureQuincyRoot();
        for (const [field, relation] of [
          ["spirit weapon", "spirit_weapon_recorded"],
          ["signature skill", "signature_skill_recorded"],
        ] as const) {
          const valueText = scalarFromKey(skills, field);
          const abilityKey = ensureAbility(
            valueText,
            collection,
            "stats.Primary Skills." + field,
          );
          if (!abilityKey) continue;
          addRelation(
            characterKey,
            abilityKey,
            relation,
            "Exact Quincy Primary Skills." + field + " evidence.",
          );
          addRelation(
            abilityKey,
            root,
            "part_of_power_system_recorded",
            "Structured Quincy Primary Skills evidence.",
          );
        }

        const vollstandig =
          scalarFromKey(skills, "vollständig") ||
          scalarFromKey(skills, "vollstandig");
        const abilityKey = ensureAbility(
          vollstandig,
          collection,
          "stats.Primary Skills.vollständig",
        );
        if (abilityKey) {
          const stageKey = ensureVollstandigRule();
          addRelation(
            characterKey,
            abilityKey,
            "vollstandig_recorded",
            "Exact Quincy vollständig evidence.",
          );
          addRelation(
            abilityKey,
            stageKey,
            "power_stage_recorded",
            "Named form belongs to the structured vollständig field.",
          );
        }
      }

      if (collection === "humans") {
        const fullbring = scalarFromKey(skills, "fullbring");
        const abilityKey = ensureAbility(
          fullbring,
          collection,
          "stats.Primary Skill.fullbring",
        );
        if (abilityKey) {
          const root = ensureFullbringRoot();
          addRelation(
            characterKey,
            abilityKey,
            "fullbring_recorded",
            "Exact Human Primary Skill.fullbring evidence.",
          );
          addRelation(
            abilityKey,
            root,
            "part_of_power_system_recorded",
            "Structured Human Fullbring evidence.",
          );
        }
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
        "Bulk character evidence grouped by Shinigami, Arrancar, Quincy and Humans, including structured POWER projections from Zanpakutō / Primary Skill fields.",
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

function isConcreteBleachPowerValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !new Set([
    "unknown",
    "none",
    "not yet achieved",
    "not achieved",
    "n/a",
    "not applicable",
  ]).has(normalized);
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
