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
import type { SourceKind } from "./source-corpus-repository.js";

type JsonObject = Record<string, unknown>;

/**
 * Importer invariant:
 * rich adapters THICKEN the existing World Atlas graph. A richer fandom
 * domain does not justify a parallel Power/Equipment/Economy database.
 * Project rules, abilities, characters, items, organizations and events into
 * the existing Card + Typed Relation model and let people-centered queries
 * compose the view.
 */
export interface SourceIdentityBridge {
  [identity: string]: string;
}

export function buildSourceIdentityBridge(
  ...seeds: SourceWorldSeed[]
): SourceIdentityBridge {
  const candidates = new Map<string, Set<string>>();
  for (const seed of seeds)
    for (const corpus of seed.corpora)
      for (const record of corpus.records) {
        if (!record.canonicalKey) continue;
        const key = identityKey(record.kind, record.name);
        const set = candidates.get(key) ?? new Set<string>();
        set.add(record.canonicalKey);
        candidates.set(key, set);
      }
  return Object.fromEntries(
    [...candidates.entries()]
      .filter(([, keys]) => keys.size === 1)
      .map(([key, keys]) => [key, [...keys][0]!]),
  );
}

export function mergeSourceWorldSeeds(
  ...seeds: SourceWorldSeed[]
): SourceWorldSeed {
  const first = seeds[0];
  if (!first) throw new Error("source.world.seed.merge_empty");
  for (const seed of seeds)
    if (
      seed.world.id !== first.world.id ||
      seed.world.canonicalCorpusId !== first.world.canonicalCorpusId
    )
      throw new Error("source.world.seed.merge_world_mismatch");
  const corpusIds = new Set<string>();
  const corpora: SourceWorldSeedCorpus[] = [];
  for (const seed of seeds)
    for (const corpus of seed.corpora) {
      if (corpusIds.has(corpus.id)) continue;
      corpusIds.add(corpus.id);
      corpora.push(corpus);
    }
  return { world: first.world, corpora };
}

export function normalizeOnePieceWikiGraph(input: {
  entities: JsonObject[];
  translations: Record<string, string>;
  hakiVocabulary?: JsonObject;
  canonicalByIdentity?: SourceIdentityBridge;
}): SourceWorldSeed {
  const entry = requiredCatalog("one-piece");
  const upstream = requiredUpstream(entry, "one-piece-wiki-graph");
  const records: SourceWorldSeedRecord[] = [];
  const sourceKeys = new Set<string>();

  for (const entity of input.entities) {
    const sourceKey = text(entity.id);
    const type = text(entity.type);
    if (!sourceKey || !type) continue;
    const kind = onePieceKind(type);
    const name = onePieceName(entity, input.translations);
    const canonicalKey =
      input.canonicalByIdentity?.[identityKey(kind, name)] ?? sourceKey;
    sourceKeys.add(sourceKey);
    records.push({
      sourceKey,
      canonicalKey,
      kind,
      name,
      aliases: onePieceAliases(entity, input.translations, name),
      summary: onePieceSummary(entity, name, type),
      raw: entity,
      sourceUrl:
        "https://github.com/" +
        upstream.repository +
        "/blob/" +
        upstream.ref +
        "/data/universes/one-piece/entities/" +
        type +
        "/" +
        (text(entity.slug) || sourceKey.split(":").slice(1).join(":")) +
        ".json",
      originCollection: "entities/" + type,
    });
  }

  const power = addOnePiecePowerRules({
    records,
    entities: input.entities,
    hakiVocabulary: input.hakiVocabulary,
    sourceUrl: upstream.sourceUrl,
  });
  for (const key of power.allKeys) sourceKeys.add(key);

  const relations: SourceWorldSeedRelation[] = [];
  const seen = new Set<string>();
  const addRelation = (
    fromKey: string,
    toKey: string,
    relation: string,
    sourceNote: string,
  ): void => {
    if (!sourceKeys.has(fromKey) || !sourceKeys.has(toKey)) return;
    const id = fromKey + "\0" + relation + "\0" + toKey;
    if (seen.has(id)) return;
    seen.add(id);
    relations.push({ fromKey, toKey, relation, sourceNote });
  };

  for (const [, key] of power.hakiTypeKeys)
    addRelation(
      key,
      power.hakiRootKey,
      "power_branch_of_recorded",
      "Pinned One Piece haki-types vocabulary.",
    );
  for (const [value, key] of power.devilFruitClassKeys)
    addRelation(
      key,
      power.devilFruitRootKey,
      "power_branch_of_recorded",
      "Classification observed in pinned Devil Fruit evidence: " + value,
    );
  if (power.awakeningKey)
    addRelation(
      power.awakeningKey,
      power.devilFruitRootKey,
      "power_rule_of_recorded",
      "Awakening is projected from pinned Devil Fruit awakened/awakening_outcome fields.",
    );

  for (const entity of input.entities) {
    const fromKey = text(entity.id);
    if (!fromKey || !sourceKeys.has(fromKey)) continue;
    for (const edge of arrayOfObjects(entity.relations)) {
      const toKey = text(edge.target);
      const relation = text(edge.type);
      if (!toKey || !relation) continue;
      addRelation(
        fromKey,
        toKey,
        relation,
        "Pinned One Piece entity relation; qualifiers=" +
          JSON.stringify(object(edge.qualifiers) ?? {}),
      );
    }

    if (text(entity.type) === "character")
      for (const value of historicalStringValues(entity, "haki_types")) {
        const target = power.hakiTypeKeys.get(value);
        if (target)
          addRelation(
            fromKey,
            target,
            "haki_type_recorded",
            "Pinned character.haki_types evidence: " + value,
          );
      }

    if (text(entity.type) === "devil-fruit") {
      addRelation(
        fromKey,
        power.devilFruitRootKey,
        "part_of_power_system_recorded",
        "Pinned Devil Fruit entity.",
      );
      for (const value of historicalStringValues(
        entity,
        "classification",
        true,
      )) {
        const target = power.devilFruitClassKeys.get(value);
        if (target)
          addRelation(
            fromKey,
            target,
            "devil_fruit_class_recorded",
            "Pinned Devil Fruit classification evidence: " + value,
          );
      }
      if (
        power.awakeningKey &&
        (hasMeaningfulProperty(entity, "awakened") ||
          hasMeaningfulProperty(entity, "awakening_outcome"))
      )
        addRelation(
          fromKey,
          power.awakeningKey,
          "awakening_recorded",
          "Pinned Devil Fruit awakening evidence.",
        );
    }
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "One Piece pinned structured entity graph",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "No repository license detected at pinned revision. Use as provenance-aware runtime reference only; do not redistribute upstream corpus without separate permission.",
      importer: "one-piece-wiki-graph-v1",
      metadata: {
        repository: upstream.repository,
        ref: upstream.ref,
        paths: upstream.paths,
        model:
          "Stable entity ids + historised properties + typed qualified relations + epistemic status.",
      },
      evidenceRole: "primary",
      sourceNote:
        "Large structured graph used as the primary reusable One Piece mother-world evidence layer.",
      records,
      relations,
    },
  ]);
}

export function normalizeHunterXHunterMindMaps(input: {
  characters: JsonObject[];
  factions: JsonObject[];
  locations: JsonObject[];
  nations: JsonObject[];
  arcs: JsonObject[];
  events: JsonObject[];
  abilities: JsonObject[];
  routes: JsonObject[];
  canonicalByIdentity?: SourceIdentityBridge;
}): SourceWorldSeed {
  const entry = requiredCatalog("hunter-x-hunter");
  const upstream = requiredUpstream(entry, "hxh-mindmaps-world");
  const records = new Map<string, SourceWorldSeedRecord>();
  const relations: SourceWorldSeedRelation[] = [];
  const relationSeen = new Set<string>();

  const addRecord = (
    raw: JsonObject,
    kind: SourceKind,
    collection: string,
  ): void => {
    const sourceKey = text(raw.id);
    if (!sourceKey) return;
    const name = localizedName(raw) || sourceKey;
    records.set(sourceKey, {
      sourceKey,
      canonicalKey:
        input.canonicalByIdentity?.[identityKey(kind, name)] ?? sourceKey,
      kind,
      name,
      aliases: [text(raw.japaneseName), ...stringArray(raw.aliases)].filter(
        Boolean,
      ),
      summary: description(raw),
      raw,
      sourceUrl:
        "https://github.com/" +
        upstream.repository +
        "/tree/" +
        upstream.ref +
        "/src/data/hunterxhunter",
      originCollection: collection,
    });
  };
  for (const row of input.characters) addRecord(row, "character", "characters");
  for (const row of input.factions) addRecord(row, "organization", "factions");
  for (const row of input.locations) addRecord(row, "location", "locations");
  for (const row of input.nations) addRecord(row, "location", "nations");
  for (const row of input.arcs) addRecord(row, "event", "arcs");
  for (const row of input.events) addRecord(row, "event", "events");
  for (const row of input.abilities) addRecord(row, "ability", "nen");
  for (const row of input.routes) addRecord(row, "activity", "routes");

  const power = addHunterXHunterPowerRules(
    records,
    input.abilities,
    upstream.sourceUrl,
  );

  const addRelation = (
    from: string,
    to: string,
    relation: string,
    note: string,
  ): void => {
    if (!records.has(from) || !records.has(to)) return;
    const id = from + "\0" + relation + "\0" + to;
    if (relationSeen.has(id)) return;
    relationSeen.add(id);
    relations.push({ fromKey: from, toKey: to, relation, sourceNote: note });
  };
  const many = (
    from: string,
    values: unknown,
    relation: string,
    note: string,
  ): void => {
    for (const to of stringArray(values)) addRelation(from, to, relation, note);
  };

  for (const [category, key] of power.categoryKeys)
    addRelation(
      key,
      power.rootKey,
      "power_branch_of_recorded",
      "Nen category observed in pinned ability.type fields: " + category,
    );

  for (const row of input.characters) {
    const id = text(row.id);
    if (!id) continue;
    many(id, row.factionIds, "member_of_recorded", "MindMaps factionIds.");
    many(id, row.clanIds, "clan_affiliation_recorded", "MindMaps clanIds.");
    many(id, row.jutsuIds, "ability_listed", "MindMaps jutsuIds.");
    many(id, row.family, "family_relation_recorded", "MindMaps family.");
    many(id, row.teachers, "teacher_recorded", "MindMaps teachers.");
    many(id, row.allies, "ally_of_recorded", "MindMaps allies.");
    many(id, row.enemies, "enemy_of_recorded", "MindMaps enemies.");
    many(
      id,
      row.locationIds,
      "location_association_recorded",
      "MindMaps locationIds.",
    );
    many(id, row.arcIds, "appears_in_arc_recorded", "MindMaps arcIds.");
    const village = text(row.villageLocationId);
    if (village)
      addRelation(
        id,
        village,
        "home_location_recorded",
        "MindMaps villageLocationId.",
      );
    const nation = text(row.nationId);
    if (nation)
      addRelation(id, nation, "nation_recorded", "MindMaps nationId.");
    for (const rel of arrayOfObjects(row.relationships)) {
      const target = text(rel.targetCharacterId);
      if (target)
        addRelation(
          id,
          target,
          "relationship_recorded",
          "MindMaps explicit relationship: " +
            JSON.stringify(rel.label ?? null),
        );
    }
  }

  for (const row of input.factions) {
    const id = text(row.id);
    many(
      id,
      row.characterIds,
      "has_member_recorded",
      "MindMaps faction members.",
    );
    many(
      id,
      row.locationIds,
      "located_at_recorded",
      "MindMaps faction locations.",
    );
  }
  for (const row of input.locations) {
    const id = text(row.id);
    many(
      id,
      row.arcIds,
      "appears_in_arc_recorded",
      "MindMaps location arcIds.",
    );
    const nation = text(row.nationId);
    if (nation)
      addRelation(id, nation, "part_of_nation_recorded", "MindMaps nationId.");
  }
  for (const row of input.abilities) {
    const id = text(row.id);
    if (!id) continue;
    many(id, row.characterIds, "used_by_recorded", "MindMaps ability users.");
    addRelation(
      id,
      power.rootKey,
      "part_of_power_system_recorded",
      "Pinned HxH Nen ability record.",
    );
    const nenType = text(row.type).toLowerCase();
    if (nenType && nenType !== "nen") {
      const category = power.categoryKeys.get(nenType);
      if (category)
        addRelation(
          id,
          category,
          "nen_category_recorded",
          "Pinned ability.type Nen category: " + nenType,
        );
    } else {
      const tags = stringArray(row.tags).map((tag) => tag.toLowerCase());
      const name = text(row.name).toLowerCase();
      if (tags.includes("avanzata"))
        addRelation(
          id,
          power.rootKey,
          "advanced_application_of_recorded",
          "Pinned Nen tag marks this as an advanced application.",
        );
      else if (
        tags.includes("fondamentale") ||
        ["nen", "ten", "zetsu", "ren", "hatsu"].includes(name)
      )
        addRelation(
          id,
          power.rootKey,
          "fundamental_of_recorded",
          "Pinned Nen record marks this as a fundamental/system rule.",
        );
    }
  }
  for (const row of input.events) {
    const id = text(row.id);
    many(
      id,
      row.characterIds,
      "involves_character_recorded",
      "MindMaps event characters.",
    );
    many(
      id,
      row.factionIds,
      "involves_faction_recorded",
      "MindMaps event factions.",
    );
    many(
      id,
      row.locationIds,
      "occurs_at_recorded",
      "MindMaps event locations.",
    );
    const location = text(row.locationId);
    if (location)
      addRelation(
        id,
        location,
        "occurs_at_recorded",
        "MindMaps event location.",
      );
    const arc = text(row.arcId);
    if (arc)
      addRelation(id, arc, "part_of_arc_recorded", "MindMaps event arcId.");
  }
  for (const row of input.routes) {
    const id = text(row.id);
    many(
      id,
      row.protagonistCharacterIds,
      "route_protagonist_recorded",
      "MindMaps route protagonists.",
    );
    many(
      id,
      row.relatedCharacterIds,
      "route_character_recorded",
      "MindMaps route related characters.",
    );
    const arc = text(row.arcId);
    if (arc)
      addRelation(id, arc, "route_arc_recorded", "MindMaps route arcId.");
    for (const step of arrayOfObjects(row.steps)) {
      const location = text(step.locationId);
      const event = text(step.eventId);
      if (location)
        addRelation(
          id,
          location,
          "route_step_location_recorded",
          "MindMaps route step.",
        );
      if (event)
        addRelation(
          id,
          event,
          "route_step_event_recorded",
          "MindMaps route step.",
        );
    }
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "Hunter x Hunter pinned structured world graph",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "No repository license detected at pinned revision. Use as provenance-aware runtime reference only; do not vendor or redistribute the upstream corpus.",
      importer: "hxh-mindmaps-v1",
      metadata: {
        repository: upstream.repository,
        ref: upstream.ref,
        paths: upstream.paths,
      },
      evidenceRole: "primary",
      sourceNote:
        "Structured world graph covering cast, factions, places, nations, arcs, events, Nen and narrative routes.",
      records: [...records.values()],
      relations,
    },
  ]);
}

export function normalizeHunterXHunterRoster(input: {
  roster: JsonObject[];
  canonicalByIdentity?: SourceIdentityBridge;
}): SourceWorldSeed {
  const entry = requiredCatalog("hunter-x-hunter");
  const upstream = requiredUpstream(entry, "hxh-roster");
  const records = new Map<string, SourceWorldSeedRecord>();
  const relations: SourceWorldSeedRelation[] = [];
  const relationSeen = new Set<string>();

  const ensure = (
    sourceKey: string,
    canonicalKey: string,
    kind: SourceKind,
    name: string,
    raw: JsonObject,
    collection: string,
  ): void => {
    if (records.has(sourceKey)) return;
    records.set(sourceKey, {
      sourceKey,
      canonicalKey,
      kind,
      name,
      raw,
      originCollection: collection,
      sourceUrl: upstream.sourceUrl,
    });
  };
  const addRelation = (from: string, to: string, relation: string): void => {
    const id = from + "\0" + relation + "\0" + to;
    if (relationSeen.has(id)) return;
    relationSeen.add(id);
    relations.push({
      fromKey: from,
      toKey: to,
      relation,
      sourceNote: "Pinned HxH roster field.",
    });
  };

  for (const row of input.roster) {
    const slugValue = text(row.slug) || slug(text(row.name));
    const name = text(row.name);
    if (!slugValue || !name) continue;
    const characterKey = "roster-character:" + slugValue;
    ensure(
      characterKey,
      input.canonicalByIdentity?.[identityKey("character", name)] ??
        "character:hxh-roster:" + slugValue,
      "character",
      name,
      {
        ...row,
        description: text(row.description),
      },
      "roster",
    );

    const affiliation = text(row.affiliation);
    if (affiliation) {
      const key = "roster-org:" + slug(affiliation);
      ensure(
        key,
        input.canonicalByIdentity?.[identityKey("organization", affiliation)] ??
          "organization:hxh-roster:" + slug(affiliation),
        "organization",
        affiliation,
        { name: affiliation },
        "roster.affiliation",
      );
      addRelation(characterKey, key, "affiliation_recorded");
    }

    for (const arc of stringArray(row.arcs)) {
      const nameValue = titleCase(arc.replace(/-/g, " "));
      const key = "roster-arc:" + arc;
      ensure(
        key,
        input.canonicalByIdentity?.[identityKey("event", nameValue)] ??
          "event:hxh-roster:" + arc,
        "event",
        nameValue,
        { id: arc },
        "roster.arcs",
      );
      addRelation(characterKey, key, "appears_in_arc_recorded");
    }
    for (const nen of stringArray(row.nen_types)) {
      const nameValue = titleCase(nen) + " Nen";
      const key = "roster-nen:" + slug(nen);
      ensure(
        key,
        input.canonicalByIdentity?.[identityKey("ability", nameValue)] ??
          "ability:hxh-roster:" + slug(nen),
        "ability",
        nameValue,
        { nenType: nen },
        "roster.nen_types",
      );
      addRelation(characterKey, key, "nen_type_recorded");
    }
    for (const weapon of [
      ...stringArray(row.weapons),
      ...stringArray(row.arms),
    ]) {
      const key = "roster-item:" + slug(weapon);
      ensure(
        key,
        input.canonicalByIdentity?.[identityKey("item", weapon)] ??
          "item:hxh-roster:" + slug(weapon),
        "item",
        titleCase(weapon.replace(/-/g, " ")),
        { weapon },
        "roster.weapons",
      );
      addRelation(characterKey, key, "weapon_recorded");
    }
  }

  return seed(entry, [
    {
      id: upstream.id,
      title: "Hunter x Hunter pinned character roster",
      sourceUrl: upstream.sourceUrl,
      rightsNotice:
        "No repository license detected at pinned revision. Use as provenance-aware runtime reference only; do not redistribute upstream data.",
      importer: "hxh-roster-v1",
      metadata: {
        repository: upstream.repository,
        ref: upstream.ref,
        paths: upstream.paths,
      },
      evidenceRole: "supporting",
      sourceNote:
        "Character descriptions and affiliation/arc/Nen/weapon enrichment.",
      records: [...records.values()],
      relations,
    },
  ]);
}

interface OnePiecePowerProjection {
  allKeys: Set<string>;
  hakiRootKey: string;
  hakiTypeKeys: Map<string, string>;
  devilFruitRootKey: string;
  devilFruitClassKeys: Map<string, string>;
  awakeningKey: string | null;
}

function addOnePiecePowerRules(input: {
  records: SourceWorldSeedRecord[];
  entities: JsonObject[];
  hakiVocabulary: JsonObject | undefined;
  sourceUrl: string;
}): OnePiecePowerProjection {
  const allKeys = new Set<string>();
  const pushRule = (
    sourceKey: string,
    name: string,
    summary: string,
    raw: JsonObject,
    collection: string,
  ): void => {
    if (allKeys.has(sourceKey)) return;
    allKeys.add(sourceKey);
    input.records.push({
      sourceKey,
      canonicalKey: sourceKey,
      kind: "rule",
      name,
      summary,
      raw,
      sourceUrl: input.sourceUrl,
      originCollection: collection,
    });
  };

  const devilFruitRootKey = "rule:one-piece:devil-fruit-system";
  pushRule(
    devilFruitRootKey,
    "Devil Fruit System",
    "World-level power rule grouping pinned Devil Fruit entities and their observed classifications.",
    { projection: "derived_from_pinned_devil_fruit_entities" },
    "power-system/devil-fruit",
  );

  const devilFruitClassKeys = new Map<string, string>();
  for (const entity of input.entities) {
    if (text(entity.type) !== "devil-fruit") continue;
    for (const value of historicalStringValues(
      entity,
      "classification",
      true,
    )) {
      const normalized = value.toLowerCase();
      if (devilFruitClassKeys.has(normalized)) continue;
      const key = "rule:one-piece:devil-fruit-class:" + slug(normalized);
      devilFruitClassKeys.set(normalized, key);
      pushRule(
        key,
        titleCase(normalized.replaceAll("_", " ")) + " Devil Fruit",
        "Devil Fruit classification observed in pinned Source evidence.",
        { classification: normalized },
        "power-system/devil-fruit/classification",
      );
    }
  }

  const hasAwakening = input.entities.some(
    (entity) =>
      text(entity.type) === "devil-fruit" &&
      (hasMeaningfulProperty(entity, "awakened") ||
        hasMeaningfulProperty(entity, "awakening_outcome")),
  );
  const awakeningKey = hasAwakening
    ? "rule:one-piece:devil-fruit-awakening"
    : null;
  if (awakeningKey)
    pushRule(
      awakeningKey,
      "Devil Fruit Awakening",
      "Awakening rule projected only because pinned Devil Fruit records expose awakened/awakening_outcome fields.",
      { projection: "derived_from_pinned_awakening_fields" },
      "power-system/devil-fruit/awakening",
    );

  const hakiRootKey = "rule:one-piece:haki-system";
  pushRule(
    hakiRootKey,
    "Haki System",
    "World-level Haki rule projected from the pinned haki-types vocabulary.",
    { vocabulary: "haki-types" },
    "power-system/haki",
  );
  const hakiTypeKeys = new Map<string, string>();
  const values = object(input.hakiVocabulary?.values);
  for (const [value, descriptor] of Object.entries(values ?? {})) {
    const label =
      text(object(object(descriptor)?.labels)?.en) ||
      titleCase(value.replaceAll("_", " "));
    const key = "rule:one-piece:haki:" + slug(value);
    hakiTypeKeys.set(value.toLowerCase(), key);
    pushRule(
      key,
      label,
      "Haki branch from the pinned One Piece haki-types vocabulary.",
      { vocabulary: "haki-types", value },
      "power-system/haki/types",
    );
  }

  return {
    allKeys,
    hakiRootKey,
    hakiTypeKeys,
    devilFruitRootKey,
    devilFruitClassKeys,
    awakeningKey,
  };
}

interface HunterXHunterPowerProjection {
  rootKey: string;
  categoryKeys: Map<string, string>;
}

function addHunterXHunterPowerRules(
  records: Map<string, SourceWorldSeedRecord>,
  abilities: JsonObject[],
  sourceUrl: string,
): HunterXHunterPowerProjection {
  const rootKey = "rule:hxh:nen-system";
  const nenRoot = abilities.find((row) => text(row.id) === "jutsu-hxh-nen");
  records.set(rootKey, {
    sourceKey: rootKey,
    canonicalKey: rootKey,
    kind: "rule",
    name: "Nen System",
    summary:
      description(nenRoot ?? {}) ||
      "World-level Nen rule projected from pinned HxH Nen records.",
    raw: {
      projection: "derived_from_pinned_nen_records",
      sourceAbilityId: text(nenRoot?.id),
      sourceType: text(nenRoot?.type),
    },
    sourceUrl,
    originCollection: "nen/system",
  });

  const categoryKeys = new Map<string, string>();
  const categories = new Set(
    abilities
      .map((row) => text(row.type).toLowerCase())
      .filter((value) => value && value !== "nen"),
  );
  for (const category of [...categories].sort()) {
    const key = "rule:hxh:nen-category:" + slug(category);
    categoryKeys.set(category, key);
    records.set(key, {
      sourceKey: key,
      canonicalKey: key,
      kind: "rule",
      name: titleCase(category) + " Nen",
      summary:
        "Nen category projected from pinned ability.type fields; individual Hatsu link back to this branch.",
      raw: {
        projection: "derived_from_pinned_ability_type",
        nenCategory: category,
      },
      sourceUrl,
      originCollection: "nen/categories",
    });
  }

  return { rootKey, categoryKeys };
}

function historicalStringValues(
  entity: JsonObject,
  property: string,
  includeActual = false,
): string[] {
  const properties = object(entity.properties);
  const raw = properties?.[property];
  const entries = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const values = new Set<string>();
  for (const entry of entries) {
    if (typeof entry === "string") {
      if (entry.trim()) values.add(entry.trim().toLowerCase());
      continue;
    }
    const row = object(entry);
    const value = text(row?.value);
    if (value) values.add(value.toLowerCase());
    if (includeActual) {
      const actual = text(row?.actual_value);
      if (actual) values.add(actual.toLowerCase());
    }
  }
  return [...values];
}

function hasMeaningfulProperty(entity: JsonObject, property: string): boolean {
  const properties = object(entity.properties);
  const raw = properties?.[property];
  if (raw === undefined || raw === null) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "string") return raw.trim().length > 0;
  return Boolean(raw);
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

function onePieceKind(type: string): SourceKind {
  if (type === "character") return "character";
  if (type === "crew" || type === "organization" || type === "company")
    return "organization";
  if (type === "location") return "location";
  if (type === "devil-fruit" || type === "technique") return "ability";
  if (type === "ship" || type === "weapon") return "item";
  if (type === "event" || type === "arc" || type === "saga") return "event";
  if (
    type === "manga-chapter" ||
    type === "anime-episode" ||
    type === "volume" ||
    type === "sbs" ||
    type === "databook-card" ||
    type === "film" ||
    type === "anime-special"
  )
    return "work";
  if (type === "reference" || type === "document") return "information";
  return "other";
}

function onePieceName(
  entity: JsonObject,
  translations: Record<string, string>,
): string {
  const direct = text(entity.canonical_name_key);
  if (direct && translations[direct]) return translations[direct]!;
  const properties = object(entity.properties);
  for (const field of ["name", "title_key", "title"]) {
    const value = properties?.[field];
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    for (const entry of entries) {
      const obj = object(entry);
      const key = text(obj?.value_key);
      if (key && translations[key]) return translations[key]!;
      const literal = text(obj?.value);
      if (literal) return literal;
    }
  }
  const type = text(entity.type);
  const slugValue = text(entity.slug) || text(entity.id).split(":").pop() || "";
  if (type === "manga-chapter") return "Manga Chapter " + slugValue;
  if (type === "anime-episode") return "Anime Episode " + slugValue;
  if (type === "volume") return "Volume " + slugValue;
  return titleCase(slugValue.replace(/-/g, " "));
}

function onePieceAliases(
  entity: JsonObject,
  translations: Record<string, string>,
  canonicalName: string,
): string[] {
  const found = new Set<string>();
  const properties = object(entity.properties);
  for (const field of ["name", "epithet"]) {
    const value = properties?.[field];
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    for (const entry of entries) {
      const obj = object(entry);
      const key = text(obj?.value_key);
      const translated = key ? translations[key] : "";
      if (translated && translated !== canonicalName) found.add(translated);
    }
  }
  return [...found];
}

function onePieceSummary(
  entity: JsonObject,
  name: string,
  type: string,
): string {
  const properties = object(entity.properties);
  const keyFacts: string[] = [];
  for (const [key, value] of Object.entries(properties ?? {}).slice(0, 8)) {
    if (key === "name" || key === "title_key") continue;
    const serialized = JSON.stringify(value);
    if (serialized && serialized.length <= 500)
      keyFacts.push(key + "=" + serialized);
  }
  return [name + " (" + type + ")", ...keyFacts].join("; ").slice(0, 1500);
}

function identityKey(kind: SourceKind, name: string): string {
  return kind + "\0" + name.trim().toLowerCase();
}

function localizedName(raw: JsonObject): string {
  const direct = text(raw.name);
  if (direct) return direct;
  const local = object(raw.localizedName);
  return text(local?.en) || text(local?.it);
}

function description(raw: JsonObject): string {
  for (const field of ["longDescription", "shortDescription", "description"]) {
    const value = raw[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    const local = object(value);
    const found = text(local?.en) || text(local?.it);
    if (found) return found;
  }
  return "";
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
    .slice(0, 120);
  if (normalized) return normalized;
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return "u-" + hash.toString(16);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
