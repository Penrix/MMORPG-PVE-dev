import type { NarrativeDatabase } from "./database.js";
import {
  SqliteSourceCorpusRepository,
  type SourceKind,
  type SourceRecord,
} from "./source-corpus-repository.js";
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
