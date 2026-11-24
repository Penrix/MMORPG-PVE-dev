import {
  WorldAtlasCognitiveMotherSchema,
  WorldAtlasReaderSemanticsSchema,
  type WorldAtlasCardKind,
  type WorldAtlasCognitiveMother,
  type WorldAtlasReaderSemantics,
} from "@narralume/contracts";
import type { NarrativeDatabase } from "./database.js";
import {
  SqliteSourceCorpusRepository,
  type SourceKind,
  type SourceRecord,
  type SourceRecordHit,
  type SourceRelationView,
} from "./source-corpus-repository.js";
import { parseTypedWikiLinks } from "./source-card-links.js";
import {
  SqliteMotherWorldEncyclopediaRepository,
  type MotherWorldDossier,
} from "./source-world-encyclopedia-repository.js";

export interface SourceWorld {
  id: string;
  name: string;
  kind: "fictional" | "historical" | "era" | "original_reference";
  canonicalCorpusId: string;
  description: string;
  createdAt: string;
}
export interface SourceWorldEvidence {
  worldId: string;
  canonicalKey: string;
  evidenceCorpusId: string;
  evidenceKey: string;
  matchKind:
    | "same_identity"
    | "possible_match"
    | "source_adaptation"
    | "related_not_same";
  reviewStatus: "candidate" | "verified" | "rejected";
  sourceNote: string;
  createdAt: string;
  record: SourceRecord;
  sourceDossier: MotherWorldDossier | null;
}
export interface UnifiedSourceWorldDossier {
  world: SourceWorld;
  dossier: MotherWorldDossier;
  evidence: SourceWorldEvidence[];
}

export interface SourceWorldCard {
  world: SourceWorld;
  record: SourceRecord;
  content: string;
  relations: SourceRelationView[];
}

export interface SourceWorldCardSaveResult {
  card: SourceWorldCard;
  unresolvedLinks: Array<{ relation: string; target: string }>;
}

export interface SourceWorldReaderSemanticEntry {
  worldId: string;
  entityKey: string;
  name: string;
  kind: WorldAtlasCardKind;
  semantics: WorldAtlasReaderSemantics;
}

/** A single original WORLD may have multiple upstream source corpora.
 * 'Uchiha Madara' from Dattebayo and a wiki scraper are evidence for one
 * curated Naruto reference identity only when an editor explicitly says so.
 */
export class SqliteUnifiedSourceWorldRepository {
  private readonly sources: SqliteSourceCorpusRepository;
  private readonly wiki: SqliteMotherWorldEncyclopediaRepository;

  constructor(private readonly db: NarrativeDatabase) {
    this.sources = new SqliteSourceCorpusRepository(db);
    this.wiki = new SqliteMotherWorldEncyclopediaRepository(db);
  }

  createWorld(world: SourceWorld): void {
    if (!this.sources.getCorpus(world.canonicalCorpusId))
      throw Error("source.world.canonical_corpus_missing");
    this.db.raw
      .prepare(
        `
      INSERT INTO source_worlds(
        id,name,kind,canonical_corpus_id,description,created_at
      ) VALUES (?,?,?,?,?,?)
    `,
      )
      .run(
        world.id,
        world.name,
        world.kind,
        world.canonicalCorpusId,
        world.description,
        world.createdAt,
      );
  }

  getWorld(worldId: string): SourceWorld | null {
    const row = this.db.raw
      .prepare(
        `
      SELECT id,name,kind,canonical_corpus_id AS canonicalCorpusId,
        description,created_at AS createdAt
      FROM source_worlds WHERE id=?
    `,
      )
      .get(worldId) as SourceWorld | undefined;
    return row ?? null;
  }

  listWorlds(): SourceWorld[] {
    return this.db.raw
      .prepare(
        `
      SELECT id,name,kind,canonical_corpus_id AS canonicalCorpusId,
        description,created_at AS createdAt
      FROM source_worlds ORDER BY name,id
    `,
      )
      .all() as SourceWorld[];
  }

  addEvidenceCorpus(input: {
    worldId: string;
    corpusId: string;
    evidenceRole:
      "primary" | "supporting" | "alternate_version" | "historical" | "other";
    sourceNote?: string;
  }): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_evidence_corpora(
        world_id,corpus_id,evidence_role,source_note
      ) VALUES(?,?,?,?)
      ON CONFLICT(world_id,corpus_id) DO UPDATE SET
        evidence_role=excluded.evidence_role,source_note=excluded.source_note
    `,
      )
      .run(
        input.worldId,
        input.corpusId,
        input.evidenceRole,
        input.sourceNote ?? "",
      );
  }

  /**
   * Populate a curated wiki identity by a deliberate choice of source record.
   * Raw original source payload stays in the evidence corpus: the canonical
   * record holds an identity label/provenance, not a verbatim second biography.
   */
  createCanonicalFromEvidence(input: {
    worldId: string;
    canonicalKey: string;
    evidenceCorpusId: string;
    evidenceKey: string;
    name?: string;
    kind?: SourceKind;
    now: string;
    sourceNote: string;
  }): SourceRecord {
    const world = this.getWorld(input.worldId);
    if (!world) throw Error("source.world.not_found");
    const original = this.sources.getRecord(
      input.evidenceCorpusId,
      input.evidenceKey,
    );
    if (!original) throw Error("source.world.evidence_missing");
    if (this.sources.getRecord(world.canonicalCorpusId, input.canonicalKey))
      throw Error("source.world.canonical_key_already_exists");
    const record: SourceRecord = {
      corpusId: world.canonicalCorpusId,
      sourceKey: input.canonicalKey,
      name: input.name ?? original.name,
      kind: input.kind ?? original.kind,
      aliases: original.aliases,
      summary: original.summary,
      raw: {
        curatedSourceWorld: input.worldId,
        initialEvidence: {
          corpusId: input.evidenceCorpusId,
          sourceKey: input.evidenceKey,
        },
        sourceNote: input.sourceNote,
      },
      sourceUrl: original.sourceUrl,
      originCollection: "curated-original-world",
      importedAt: input.now,
    };
    this.sources.upsertRecord(record);
    return record;
  }

  linkEvidence(input: {
    worldId: string;
    canonicalKey: string;
    evidenceCorpusId: string;
    evidenceKey: string;
    matchKind: SourceWorldEvidence["matchKind"];
    reviewStatus: SourceWorldEvidence["reviewStatus"];
    sourceNote: string;
    createdAt: string;
  }): void {
    if (
      input.evidenceCorpusId === this.getWorld(input.worldId)?.canonicalCorpusId
    )
      throw Error("source.world.cannot_self_link_evidence");
    if (!input.sourceNote.trim())
      throw Error("source.world.evidence_note_required");
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_evidence_links(
        world_id,canonical_key,evidence_corpus_id,evidence_key,
        match_kind,review_status,source_note,created_at
      ) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(world_id,canonical_key,evidence_corpus_id,evidence_key)
      DO UPDATE SET
        match_kind=excluded.match_kind,
        review_status=excluded.review_status,
        source_note=excluded.source_note
    `,
      )
      .run(
        input.worldId,
        input.canonicalKey,
        input.evidenceCorpusId,
        input.evidenceKey,
        input.matchKind,
        input.reviewStatus,
        input.sourceNote,
        input.createdAt,
      );
  }

  listEvidence(worldId: string, canonicalKey: string): SourceWorldEvidence[] {
    const rows = this.db.raw
      .prepare(
        `
      SELECT link.world_id AS worldId,link.canonical_key AS canonicalKey,
        link.evidence_corpus_id AS evidenceCorpusId,
        link.evidence_key AS evidenceKey,link.match_kind AS matchKind,
        link.review_status AS reviewStatus,link.source_note AS sourceNote,
        link.created_at AS createdAt
      FROM source_world_evidence_links link
      WHERE link.world_id=? AND link.canonical_key=?
      ORDER BY link.evidence_corpus_id,link.evidence_key
    `,
      )
      .all(worldId, canonicalKey) as Array<
      Omit<SourceWorldEvidence, "record" | "sourceDossier">
    >;
    return rows.flatMap((row) => {
      const record = this.sources.getRecord(
        row.evidenceCorpusId,
        row.evidenceKey,
      );
      return record
        ? [
            {
              ...row,
              record,
              sourceDossier: this.wiki.getDossier(
                row.evidenceCorpusId,
                row.evidenceKey,
              ),
            },
          ]
        : [];
    });
  }

  listCardKeys(worldId: string): string[] {
    const world = this.getWorld(worldId);
    if (!world) throw Error("source.world.not_found");
    const rows = this.db.raw
      .prepare(
        `SELECT r.source_key AS sourceKey
         FROM source_records r
         LEFT JOIN source_record_presence presence
           ON presence.corpus_id=r.corpus_id AND presence.source_key=r.source_key
         WHERE r.corpus_id=? AND COALESCE(presence.active,1)=1
         ORDER BY r.source_key`,
      )
      .all(world.canonicalCorpusId) as unknown as Array<{ sourceKey: string }>;
    return rows.map((row) => row.sourceKey);
  }

  getCognitiveMother(worldId: string): WorldAtlasCognitiveMother | null {
    const world = this.getWorld(worldId);
    if (!world) throw Error("source.world.not_found");
    const corpus = this.sources.getCorpus(world.canonicalCorpusId);
    if (!corpus) throw Error("source.world.canonical_corpus_missing");
    const raw = corpus.metadata.cognitiveMother;
    if (raw === undefined) return null;
    const parsed = WorldAtlasCognitiveMotherSchema.safeParse(raw);
    if (!parsed.success) throw Error("source.world.cognitive_mother_invalid");
    return parsed.data;
  }

  upsertCognitiveMother(input: {
    worldId: string;
    cognitiveMother: WorldAtlasCognitiveMother;
  }): WorldAtlasCognitiveMother {
    const world = this.getWorld(input.worldId);
    if (!world) throw Error("source.world.not_found");
    const corpus = this.sources.getCorpus(world.canonicalCorpusId);
    if (!corpus) throw Error("source.world.canonical_corpus_missing");
    const cognitiveMother = WorldAtlasCognitiveMotherSchema.parse(
      input.cognitiveMother,
    );
    this.sources.upsertCorpus({
      ...corpus,
      metadata: { ...corpus.metadata, cognitiveMother },
      // Reader semantics do not change Source evidence import time.
      importedAt: corpus.importedAt,
    });
    return cognitiveMother;
  }

  getReaderSemantics(
    worldId: string,
    entityKey: string,
  ): WorldAtlasReaderSemantics | null {
    const world = this.getWorld(worldId);
    if (!world) throw Error("source.world.not_found");
    const record = this.sources.getRecord(world.canonicalCorpusId, entityKey);
    if (!record) return null;
    const raw = record.raw.readerSemantics;
    if (raw === undefined) return null;
    const parsed = WorldAtlasReaderSemanticsSchema.safeParse(raw);
    if (!parsed.success) throw Error("source.world.reader_semantics_invalid");
    return parsed.data;
  }

  upsertReaderSemantics(input: {
    worldId: string;
    entityKey: string;
    semantics: WorldAtlasReaderSemantics;
    now: string;
  }): SourceWorldReaderSemanticEntry {
    const world = this.getWorld(input.worldId);
    if (!world) throw Error("source.world.not_found");
    const record = this.sources.getRecord(
      world.canonicalCorpusId,
      input.entityKey,
    );
    if (!record) throw Error("source.world.card.not_found");
    const semantics = WorldAtlasReaderSemanticsSchema.parse(input.semantics);
    this.sources.upsertRecord({
      ...record,
      raw: { ...record.raw, readerSemantics: semantics },
      // Reader-side semantics are not a Source evidence re-import.
      importedAt: record.importedAt,
    });
    return {
      worldId: input.worldId,
      entityKey: input.entityKey,
      name: record.name,
      kind: record.kind,
      semantics,
    };
  }

  listReaderSemantics(worldId: string): SourceWorldReaderSemanticEntry[] {
    const world = this.getWorld(worldId);
    if (!world) throw Error("source.world.not_found");
    return this.listCardKeys(worldId).flatMap((entityKey) => {
      const record = this.sources.getRecord(world.canonicalCorpusId, entityKey);
      if (!record || record.raw.readerSemantics === undefined) return [];
      const semantics = WorldAtlasReaderSemanticsSchema.safeParse(
        record.raw.readerSemantics,
      );
      if (!semantics.success)
        throw Error("source.world.reader_semantics_invalid");
      return [
        {
          worldId,
          entityKey,
          name: record.name,
          kind: record.kind,
          semantics: semantics.data,
        },
      ];
    });
  }

  listCards(
    worldId: string,
    query = "",
    options: { kind?: SourceKind; limit?: number; offset?: number } = {},
  ): SourceRecordHit[] {
    const world = this.getWorld(worldId);
    if (!world) throw Error("source.world.not_found");
    return this.sources.search(query, {
      corpusId: world.canonicalCorpusId,
      ...(options.kind ? { kind: options.kind } : {}),
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });
  }

  getCard(worldId: string, entityKey: string): SourceWorldCard | null {
    const world = this.getWorld(worldId);
    if (!world) return null;
    const dossier = this.wiki.getDossier(world.canonicalCorpusId, entityKey);
    if (!dossier) return null;
    const primary = dossier.lore.find(
      (section) => section.sectionKey === "card",
    );
    const content =
      primary?.content ??
      dossier.lore
        .map((section) => `## ${section.title}\n\n${section.content}`)
        .join("\n\n");
    return {
      world,
      record: dossier.record,
      content,
      relations: this.sources.listRelations(world.canonicalCorpusId, entityKey),
    };
  }

  /**
   * Author-facing Source World card write.
   *
   * The Markdown card is the content truth. source_relations is rebuilt from
   * typed wiki links after each save and can be discarded/recreated at any
   * time without losing the card.
   */
  upsertCard(input: {
    worldId: string;
    entityKey: string;
    kind: SourceKind;
    name: string;
    aliases?: string[];
    content: string;
    now: string;
  }): SourceWorldCardSaveResult {
    const world = this.getWorld(input.worldId);
    if (!world) throw Error("source.world.not_found");
    if (!input.name.trim()) throw Error("source.world.card.name_required");
    if (!input.content.trim())
      throw Error("source.world.card.content_required");

    const existing = this.sources.getRecord(
      world.canonicalCorpusId,
      input.entityKey,
    );
    const summary = input.content
      .replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_m, target: string, label?: string) => label ?? target,
      )
      .replace(/[#*_>\x60]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    this.sources.upsertRecord({
      corpusId: world.canonicalCorpusId,
      sourceKey: input.entityKey,
      kind: input.kind,
      name: input.name.trim(),
      aliases: input.aliases ?? existing?.aliases ?? [],
      summary,
      raw: {
        ...(existing?.raw ?? {}),
        atlasCard: true,
      },
      sourceUrl: existing?.sourceUrl ?? "",
      originCollection: existing?.originCollection ?? "curated-original-world",
      importedAt: input.now,
    });
    this.wiki.upsertLore({
      corpusId: world.canonicalCorpusId,
      sourceKey: input.entityKey,
      sectionKey: "card",
      title: input.name.trim(),
      content: input.content,
      sourceUrl: existing?.sourceUrl ?? "",
      sourceNote: "World Atlas author card",
      updatedAt: input.now,
    });

    const unresolvedLinks = this.reindexCard(
      input.worldId,
      input.entityKey,
      input.content,
    );
    const card = this.getCard(input.worldId, input.entityKey);
    if (!card) throw Error("source.world.card.write_failed");
    return { card, unresolvedLinks };
  }

  reindexCard(
    worldId: string,
    entityKey: string,
    content?: string,
  ): Array<{ relation: string; target: string }> {
    const world = this.getWorld(worldId);
    if (!world) throw Error("source.world.not_found");
    const card =
      content === undefined ? this.getCard(worldId, entityKey) : null;
    const markdown = content ?? card?.content;
    if (markdown === undefined) throw Error("source.world.card.not_found");

    const unresolved: Array<{ relation: string; target: string }> = [];
    this.sources.clearOutgoingRelations(world.canonicalCorpusId, entityKey);
    for (const link of parseTypedWikiLinks(markdown)) {
      const target = this.sources.findRecordByReference(
        world.canonicalCorpusId,
        link.target,
      );
      if (!target) {
        unresolved.push({ relation: link.relation, target: link.target });
        continue;
      }
      this.sources.upsertRelation({
        corpusId: world.canonicalCorpusId,
        fromKey: entityKey,
        toKey: target.sourceKey,
        relation: link.relation,
        sourceNote: "derived-from-atlas-card",
      });
    }
    return unresolved;
  }

  getDossier(
    worldId: string,
    canonicalKey: string,
  ): UnifiedSourceWorldDossier | null {
    const world = this.getWorld(worldId);
    if (!world) return null;
    const dossier = this.wiki.getDossier(world.canonicalCorpusId, canonicalKey);
    if (!dossier) return null;
    return {
      world,
      dossier,
      evidence: this.listEvidence(worldId, canonicalKey),
    };
  }
}
