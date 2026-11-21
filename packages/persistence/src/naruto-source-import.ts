import type { NarrativeDatabase } from "./database.js";
import { SqliteMotherWorldEncyclopediaRepository } from "./source-world-encyclopedia-repository.js";
import {
  SqliteSourceCorpusRepository,
  type SourceKind,
} from "./source-corpus-repository.js";

export const NARUTO_DATTEBAYO_CORPUS = "naruto-dattebayo";
export const NARUTO_WIKI_CORPUS = "naruto-wiki-scraper";
export const NARUTO_COLLECTIONS = [
  "characters",
  "clans",
  "villages",
  "teams",
  "kekkei-genkai",
  "tailed-beasts",
  "akatsuki",
  "kara",
] as const;
export type NarutoCollection = (typeof NARUTO_COLLECTIONS)[number];
export type NarutoData = Record<NarutoCollection, unknown[]>;

const DATTEBAYO_ROOT =
  "https://github.com/viniciusschuelter/dattebayo-api/tree/main/src/data";
const WIKI_ROOT = "https://github.com/simon8800/naruto-wiki-scraper";

type Row = Record<string, unknown>;
const asRow = (v: unknown): Row | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const numberId = (v: unknown): number | null =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const rowName = (v: Row): string => asText(v.name);
const sourceKey = (collection: string, id: number): string =>
  `${collection}:${id}`;
const isJutsuName = (s: string): boolean =>
  s.length >= 2 &&
  s.length <= 140 &&
  !/[\r\n]/.test(s) &&
  !/https?:|not in the list|[0-9]{6}|<|>/.test(s);

export interface NarutoImportReport {
  corpusId: string;
  records: number;
  relations: number;
  skippedReferences: number;
  skippedRecords: number;
  collections: Record<string, number>;
  exactDuplicates?: number;
  duplicateNameVariants?: number;
}

/**
 * Use the source corpus as a read-only ORIGINAL mother reference. Never turn
 * manga-future facts into confirmed story facts; the project may start in the
 * Second Shinobi War, cross into One Piece, or time-travel to Loulan.
 */
export function importNarutoDattebayo(
  db: NarrativeDatabase,
  data: NarutoData,
  importedAt = new Date().toISOString(),
): NarutoImportReport {
  for (const key of NARUTO_COLLECTIONS) {
    if (!Array.isArray(data[key]))
      throw new Error(`Naruto source is missing array: ${key}`);
  }
  if (!data.characters.length)
    throw new Error(
      "Refusing to replace Naruto source with empty characters collection",
    );

  const repo = new SqliteSourceCorpusRepository(db);
  const wiki = new SqliteMotherWorldEncyclopediaRepository(db);
  const stats: NarutoImportReport = {
    corpusId: NARUTO_DATTEBAYO_CORPUS,
    records: 0,
    relations: 0,
    skippedReferences: 0,
    skippedRecords: 0,
    collections: {},
  };
  const corpusId = NARUTO_DATTEBAYO_CORPUS;
  const recordKeys = new Set<string>();

  return db.transaction(() => {
    repo.upsertCorpus({
      id: corpusId,
      title: "火影忍者：Dattebayo原生母体",
      sourceUrl: DATTEBAYO_ROOT,
      rightsNotice:
        "Community data from Naruto Wiki / franchise. Source material is not covered by this app's Apache-2.0 license; inspect upstream terms before reuse.",
      importer: "naruto-dattebayo-v1",
      metadata: {
        collections: NARUTO_COLLECTIONS,
        warning:
          "Mixed manga, anime, novels and games; all-time records are not a time-sliced world. Treat as source assertions only.",
      },
      importedAt,
    });
    // Source snapshots are rederived, never author-edited Canon. Reimports
    // must drop stale relations and records atomically while preserving books.
    repo.beginCorpusSnapshot(corpusId);

    const supplement = new Map<number, Row>();
    for (const group of ["akatsuki", "kara"] as const) {
      stats.collections[group] = data[group].length;
      for (const entry of data[group]) {
        const row = asRow(entry);
        const id = row ? numberId(row.id) : null;
        if (id === null || !row) {
          stats.skippedRecords++;
          continue;
        }
        supplement.set(id, { ...(supplement.get(id) ?? {}), [group]: row });
      }
    }

    const add = (
      key: string,
      kind: SourceKind,
      name: string,
      raw: Row,
      collection: string,
      summary = "",
      aliases: string[] = [],
    ): void => {
      if (!name || recordKeys.has(key)) {
        stats.skippedRecords++;
        return;
      }
      recordKeys.add(key);
      repo.upsertRecord({
        corpusId,
        sourceKey: key,
        kind,
        name,
        aliases,
        summary,
        raw,
        sourceUrl: `${DATTEBAYO_ROOT}/${collection}.json`,
        originCollection: collection,
        importedAt,
      });
      stats.records++;
    };

    stats.collections.characters = data.characters.length;
    for (const entry of data.characters) {
      const row = asRow(entry);
      const id = row ? numberId(row.id) : null;
      if (id === null || !row) {
        stats.skippedRecords++;
        continue;
      }
      const extra = supplement.get(id);
      const personal = asRow(row.personal);
      const descriptions = [
        asText(personal?.occupation),
        asText(personal?.affiliation),
        ...asList(row.jutsu).slice(0, 3).map(asText),
      ].filter(Boolean);
      add(
        sourceKey("character", id),
        "character",
        rowName(row),
        extra ? { ...row, _sourceSupplements: extra } : row,
        "characters",
        descriptions.join(" | "),
      );
      supplement.delete(id);
    }
    // Profiles that the upstream specialty lists include but main characters
    // omit remain source characters. No fabricated identities.
    for (const [id, extra] of supplement) {
      const parts = Object.values(extra)
        .map(asRow)
        .filter((v): v is Row => !!v);
      const first = parts[0];
      if (!first) continue;
      add(
        sourceKey("character", id),
        "character",
        rowName(first),
        { ...first, _sourceSupplements: extra },
        "characters",
        "Additional specialty-profile source only",
      );
    }

    const groups: readonly {
      collection: NarutoCollection;
      kind: SourceKind;
      prefix: string;
      relation: string;
    }[] = [
      {
        collection: "clans",
        kind: "organization",
        prefix: "clan",
        relation: "clan_member_recorded",
      },
      {
        collection: "villages",
        kind: "location",
        prefix: "village",
        relation: "village_affiliation_recorded",
      },
      {
        collection: "teams",
        kind: "organization",
        prefix: "team",
        relation: "team_member_recorded",
      },
      {
        collection: "kekkei-genkai",
        kind: "ability",
        prefix: "kekkei",
        relation: "kekkei_genkai_recorded",
      },
      {
        collection: "tailed-beasts",
        kind: "creature",
        prefix: "beast",
        relation: "tailed_beast_association_recorded",
      },
    ];
    for (const group of groups) {
      stats.collections[group.collection] = data[group.collection].length;
      for (const entry of data[group.collection]) {
        const row = asRow(entry);
        const id = row ? numberId(row.id) : null;
        if (id === null || !row) {
          stats.skippedRecords++;
          continue;
        }
        add(
          sourceKey(group.prefix, id),
          group.kind,
          rowName(row),
          row,
          group.collection,
        );
        if (group.collection === "clans" || group.collection === "teams") {
          wiki.upsertOrganization({
            corpusId,
            sourceKey: sourceKey(group.prefix, id),
            organizationForm: group.collection === "clans" ? "clan" : "team",
            sourceNote: `Upstream ${group.collection}.json classified this record; governance, powers and history remain unverified`,
            updatedAt: importedAt,
          });
        }
      }
    }

    // The upstream's Akatsuki/Kara lists contain incidental people/animals.
    // "listed_in_specialty_dataset" is NOT asserted as membership.
    add(
      "org:akatsuki",
      "organization",
      "Akatsuki",
      {
        label: "Akatsuki",
        sourceCollection: "akatsuki",
        sourceMeaning: "specialty character list, NOT confirmed member roster",
      },
      "akatsuki",
    );
    add(
      "org:kara",
      "organization",
      "Kara",
      {
        label: "Kara",
        sourceCollection: "kara",
        sourceMeaning: "specialty character list, NOT confirmed member roster",
      },
      "kara",
    );

    // Preserve the source's jutsu strings as references; skip obvious scraper
    // garbage, never invent costs, prerequisites or power balancing.
    const jutsu = new Set<string>();
    for (const entry of [...data.characters, ...data.akatsuki, ...data.kara]) {
      const row = asRow(entry);
      for (const name of asList(row?.jutsu).map(asText)) {
        if (isJutsuName(name)) jutsu.add(name);
      }
    }
    for (const name of jutsu) {
      add(
        `jutsu:${name}`,
        "ability",
        name,
        {
          name,
          extraction: "verbatim jutsu list; mechanics not separately verified",
        },
        "characters",
        "Source-listed jutsu; see original character records for context.",
      );
    }
    stats.collections.jutsu = jutsu.size;

    const link = (
      fromKey: string,
      toKey: string,
      relation: string,
      note: string,
    ): void => {
      if (!recordKeys.has(fromKey) || !recordKeys.has(toKey)) {
        stats.skippedReferences++;
        return;
      }
      repo.upsertRelation({
        corpusId,
        fromKey,
        toKey,
        relation,
        sourceNote: note,
      });
      stats.relations++;
    };
    for (const group of groups) {
      for (const entry of data[group.collection]) {
        const row = asRow(entry);
        const id = row ? numberId(row.id) : null;
        if (id === null || !row) continue;
        for (const characterId of asList(row.characters).map(numberId)) {
          if (characterId === null) {
            stats.skippedReferences++;
            continue;
          }
          link(
            sourceKey("character", characterId),
            sourceKey(group.prefix, id),
            group.relation,
            `Dattebayo ${group.collection}.json characters[]; not a dated project fact`,
          );
        }
      }
    }
    for (const [group, org] of [
      ["akatsuki", "org:akatsuki"],
      ["kara", "org:kara"],
    ] as const) {
      for (const entry of data[group]) {
        const row = asRow(entry);
        const id = row ? numberId(row.id) : null;
        if (id === null) continue;
        link(
          sourceKey("character", id),
          org,
          "listed_in_specialty_dataset",
          `Listed by Dattebayo ${group}.json; this alone does NOT establish membership`,
        );
      }
    }
    for (const entry of [...data.characters, ...data.akatsuki, ...data.kara]) {
      const row = asRow(entry);
      const id = row ? numberId(row.id) : null;
      if (id === null) continue;
      for (const name of asList(row?.jutsu).map(asText)) {
        if (jutsu.has(name))
          link(
            sourceKey("character", id),
            `jutsu:${name}`,
            "jutsu_listed",
            "Explicit upstream character jutsu[] entry; ability availability varies by historical period",
          );
      }
    }
    // A person may appear in main and specialty lists. Count stored distinct
    // source edges, not the number of repeated UPSERT attempts.
    stats.relations =
      repo.getCorpus(corpusId)?.relationCount ?? stats.relations;
    return stats;
  });
}

/** Optional second source with detailed bios. Separate identities retain
 * conflicting canon/anime/game/novel notes without silently merging people. */
export function importNarutoWikiScraper(
  db: NarrativeDatabase,
  rows: unknown[],
  importedAt = new Date().toISOString(),
): NarutoImportReport {
  if (!rows.length)
    throw new Error("Refusing to import an empty Naruto Wiki snapshot");
  const repo = new SqliteSourceCorpusRepository(db);
  const wiki = new SqliteMotherWorldEncyclopediaRepository(db);
  const stats: NarutoImportReport = {
    corpusId: NARUTO_WIKI_CORPUS,
    records: 0,
    relations: 0,
    skippedRecords: 0,
    skippedReferences: 0,
    collections: { characters: rows.length },
  };
  return db.transaction(() => {
    repo.upsertCorpus({
      id: NARUTO_WIKI_CORPUS,
      title: "火影忍者：Wiki人物档案母体",
      sourceUrl: WIKI_ROOT,
      rightsNotice:
        "Naruto Wiki fan-scraped material. No source contents are redistributed in the app repository.",
      importer: "naruto-wiki-scraper-v1",
      metadata: {
        warning:
          "All-life character bios, mixed source media, not current time-sliced Reality.",
      },
      importedAt,
    });
    // Reimports must not reassign ordinal wiki:name#N identities merely
    // because upstream row order changes. Reuse an exact prior record match,
    // otherwise allocate a new source ID and archive the old assertion.
    const previousRows = db.raw
      .prepare(
        `
      SELECT source_key AS sourceKey,name,raw_json AS rawJson
      FROM source_records WHERE corpus_id=?
    `,
      )
      .all(NARUTO_WIKI_CORPUS) as Array<{
      sourceKey: string;
      name: string;
      rawJson: string;
    }>;
    const previousByName = new Map<
      string,
      Array<{ sourceKey: string; rawJson: string }>
    >();
    for (const item of previousRows) {
      const values = previousByName.get(item.name) ?? [];
      values.push({ sourceKey: item.sourceKey, rawJson: item.rawJson });
      previousByName.set(item.name, values);
    }
    const reused = new Set<string>();
    repo.beginCorpusSnapshot(NARUTO_WIKI_CORPUS);
    const knownByName = new Map<string, string[]>();
    stats.exactDuplicates = 0;
    stats.duplicateNameVariants = 0;
    for (const raw of rows) {
      const row = asRow(raw);
      if (!row) {
        stats.skippedRecords++;
        continue;
      }
      const name = rowName(row);
      if (!name) {
        stats.skippedRecords++;
        continue;
      }
      const serialized = JSON.stringify(row);
      const variants = knownByName.get(name) ?? [];
      if (variants.includes(serialized)) {
        stats.exactDuplicates = (stats.exactDuplicates ?? 0) + 1;
        continue;
      }
      variants.push(serialized);
      knownByName.set(name, variants);
      if (variants.length > 1) {
        stats.duplicateNameVariants = (stats.duplicateNameVariants ?? 0) + 1;
      }
      const previous = previousByName.get(name) ?? [];
      const exact = previous.find(
        (p) => p.rawJson === serialized && !reused.has(p.sourceKey),
      );
      let key = exact?.sourceKey;
      if (!key) {
        let ordinal = 1;
        do {
          key = ordinal === 1 ? `wiki:${name}` : `wiki:${name}#${ordinal}`;
          ordinal++;
        } while (previous.some((p) => p.sourceKey === key) || reused.has(key));
      }
      reused.add(key);
      repo.upsertRecord({
        corpusId: NARUTO_WIKI_CORPUS,
        sourceKey: key,
        kind: "character",
        name,
        aliases: [],
        summary: asText(row.summary),
        raw: row,
        sourceUrl: WIKI_ROOT + "/blob/master/cleanCharacters.json",
        originCollection: "cleanCharacters",
        importedAt,
      });
      stats.records++;
      // Scraped source prose can populate source wiki sections directly.
      // Never invent missing biography chapters or mark them Project Canon.
      for (const field of [
        "summary",
        "history",
        "personality",
        "abilities",
        "background",
      ]) {
        const value = asText(row[field]);
        if (!value) continue;
        wiki.upsertLore({
          corpusId: NARUTO_WIKI_CORPUS,
          sourceKey: key,
          sectionKey: `imported:${field}`,
          title: field,
          content: value,
          sourceUrl: WIKI_ROOT + "/blob/master/cleanCharacters.json",
          sourcePointer: `.${field}`,
          sourceNote:
            "Direct imported Wiki text. Source media/period not independently verified; not a Project Canon fact.",
          updatedAt: importedAt,
        });
      }
    }
    return stats;
  });
}
