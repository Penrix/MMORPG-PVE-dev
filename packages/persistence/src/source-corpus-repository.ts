import type { WorldAtlasCardKind } from "@narralume/contracts";
import { inverseRelation } from "./source-card-links.js";
import type { NarrativeDatabase } from "./database.js";

export type SourceKind = WorldAtlasCardKind;

export interface SourceCorpus {
  id: string;
  title: string;
  sourceUrl: string;
  rightsNotice: string;
  importer: string;
  metadata: Record<string, unknown>;
  importedAt: string;
  recordCount?: number;
  relationCount?: number;
}

export interface SourceRecord {
  corpusId: string;
  sourceKey: string;
  kind: SourceKind;
  name: string;
  aliases: string[];
  summary: string;
  raw: Record<string, unknown>;
  sourceUrl: string;
  originCollection: string;
  importedAt: string;
}

export interface SourceRelation {
  corpusId: string;
  fromKey: string;
  toKey: string;
  relation: string;
  sourceNote: string;
}

export interface SourceRecordHit {
  corpusId: string;
  sourceKey: string;
  name: string;
  kind: SourceKind;
  summary: string;
  originCollection: string;
}

export interface SourceRelationView extends SourceRelation {
  otherName: string;
  otherKind: SourceKind;
  direction: "out" | "in";
  /** Author-facing label from the current card's point of view. */
  displayRelation: string;
}

type CorpusRow = {
  id: string;
  title: string;
  source_url: string;
  rights_notice: string;
  importer: string;
  metadata_json: string;
  imported_at: string;
  record_count?: number;
  relation_count?: number;
};
type RecordRow = {
  corpus_id: string;
  source_key: string;
  kind: SourceKind;
  name: string;
  aliases_json: string;
  summary: string;
  raw_json: string;
  source_url: string;
  origin_collection: string;
  imported_at: string;
};

function corpusFromRow(row: CorpusRow): SourceCorpus {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    rightsNotice: row.rights_notice,
    importer: row.importer,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    importedAt: row.imported_at,
    ...(row.record_count === undefined
      ? {}
      : { recordCount: row.record_count }),
    ...(row.relation_count === undefined
      ? {}
      : { relationCount: row.relation_count }),
  };
}
function recordFromRow(row: RecordRow): SourceRecord {
  return {
    corpusId: row.corpus_id,
    sourceKey: row.source_key,
    kind: row.kind,
    name: row.name,
    aliases: JSON.parse(row.aliases_json) as string[],
    summary: row.summary,
    raw: JSON.parse(row.raw_json) as Record<string, unknown>,
    sourceUrl: row.source_url,
    originCollection: row.origin_collection,
    importedAt: row.imported_at,
  };
}

export class SqliteSourceCorpusRepository {
  constructor(private readonly db: NarrativeDatabase) {}

  upsertCorpus(corpus: SourceCorpus): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_corpora(id,title,source_url,rights_notice,importer,metadata_json,imported_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, source_url=excluded.source_url,
        rights_notice=excluded.rights_notice, importer=excluded.importer,
        metadata_json=excluded.metadata_json, imported_at=excluded.imported_at
    `,
      )
      .run(
        corpus.id,
        corpus.title,
        corpus.sourceUrl,
        corpus.rightsNotice,
        corpus.importer,
        JSON.stringify(corpus.metadata),
        corpus.importedAt,
      );
  }

  getCorpus(id: string): SourceCorpus | null {
    const row = this.db.raw
      .prepare(
        `
      SELECT c.*, (SELECT COUNT(*) FROM source_records r
        LEFT JOIN source_record_presence presence ON
          presence.corpus_id=r.corpus_id AND presence.source_key=r.source_key
        WHERE r.corpus_id=c.id AND COALESCE(presence.active,1)=1) AS record_count,
        (SELECT COUNT(*) FROM source_relations e WHERE e.corpus_id=c.id) AS relation_count
      FROM source_corpora c WHERE id=?
    `,
      )
      .get(id) as CorpusRow | undefined;
    return row ? corpusFromRow(row) : null;
  }

  listCorpora(): SourceCorpus[] {
    const rows = this.db.raw
      .prepare(
        `
      SELECT c.*, (SELECT COUNT(*) FROM source_records r
        LEFT JOIN source_record_presence presence ON
          presence.corpus_id=r.corpus_id AND presence.source_key=r.source_key
        WHERE r.corpus_id=c.id AND COALESCE(presence.active,1)=1) AS record_count,
        (SELECT COUNT(*) FROM source_relations e WHERE e.corpus_id=c.id) AS relation_count
      FROM source_corpora c ORDER BY title
    `,
      )
      .all() as unknown as CorpusRow[];
    return rows.map(corpusFromRow);
  }

  upsertRecord(record: SourceRecord): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_records(
        corpus_id,source_key,kind,name,aliases_json,summary,raw_json,
        source_url,origin_collection,imported_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(corpus_id,source_key) DO UPDATE SET
        kind=excluded.kind,name=excluded.name,aliases_json=excluded.aliases_json,
        summary=excluded.summary,raw_json=excluded.raw_json,
        source_url=excluded.source_url,origin_collection=excluded.origin_collection,
        imported_at=excluded.imported_at
    `,
      )
      .run(
        record.corpusId,
        record.sourceKey,
        record.kind,
        record.name,
        JSON.stringify(record.aliases),
        record.summary,
        JSON.stringify(record.raw),
        record.sourceUrl,
        record.originCollection,
        record.importedAt,
      );
    this.db.raw
      .prepare(
        `
      INSERT INTO source_record_presence(corpus_id,source_key,active,last_seen_at)
      VALUES (?,?,1,?)
      ON CONFLICT(corpus_id,source_key)
        DO UPDATE SET active=1,last_seen_at=excluded.last_seen_at
    `,
      )
      .run(record.corpusId, record.sourceKey, record.importedAt);
  }

  /** Called inside an importer transaction. Historic source IDs and expert
   * curated encyclopedia content survive reimports. Absentees are archived
   * and hidden from search, never deleted from referenced project records. */
  beginCorpusSnapshot(corpusId: string): void {
    this.db.raw
      .prepare(
        `
      UPDATE source_record_presence SET active=0 WHERE corpus_id=?
    `,
      )
      .run(corpusId);
    this.clearRelations(corpusId);
  }

  getRecord(corpusId: string, sourceKey: string): SourceRecord | null {
    const row = this.db.raw
      .prepare(
        "SELECT * FROM source_records WHERE corpus_id=? AND source_key=?",
      )
      .get(corpusId, sourceKey) as RecordRow | undefined;
    return row ? recordFromRow(row) : null;
  }

  /**
   * Resolve a wiki-link target inside one source world. An explicit source key
   * wins; otherwise exact name/alias matching is used. This is deliberately a
   * lookup helper, not an identity-merging rule.
   */
  findRecordByReference(
    corpusId: string,
    reference: string,
  ): SourceRecord | null {
    const ref = reference.trim();
    if (!ref) return null;
    const exactKey = this.getRecord(corpusId, ref);
    if (exactKey) return exactKey;
    const rows = this.db.raw
      .prepare(
        `
      SELECT r.*
      FROM source_records r
      LEFT JOIN source_record_presence presence
        ON presence.corpus_id=r.corpus_id AND presence.source_key=r.source_key
      WHERE r.corpus_id=? AND COALESCE(presence.active,1)=1
        AND (
          r.name=?
          OR EXISTS (
            SELECT 1 FROM json_each(r.aliases_json) alias WHERE alias.value=?
          )
        )
      ORDER BY CASE WHEN r.name=? THEN 0 ELSE 1 END, r.source_key
      LIMIT 2
    `,
      )
      .all(corpusId, ref, ref, ref) as unknown as RecordRow[];
    // A human-readable wiki link may be ambiguous. Never silently choose the
    // first same-name card; use [[stable-key|display name]] to disambiguate.
    return rows.length === 1 ? recordFromRow(rows[0]!) : null;
  }

  upsertRelation(edge: SourceRelation): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_relations(corpus_id,from_key,to_key,relation,source_note)
      VALUES (?,?,?,?,?)
      ON CONFLICT(corpus_id,from_key,to_key,relation)
      DO UPDATE SET source_note=excluded.source_note
    `,
      )
      .run(
        edge.corpusId,
        edge.fromKey,
        edge.toKey,
        edge.relation,
        edge.sourceNote,
      );
  }

  listRelations(corpusId: string, sourceKey: string): SourceRelationView[] {
    const rows = this.db.raw
      .prepare(
        `
      SELECT r.corpus_id AS corpusId, r.from_key AS fromKey, r.to_key AS toKey,
        r.relation, r.source_note AS sourceNote,
        CASE WHEN r.from_key=? THEN 'out' ELSE 'in' END AS direction,
        other.name AS otherName, other.kind AS otherKind
      FROM source_relations r JOIN source_records other
        ON other.corpus_id=r.corpus_id
        AND other.source_key=(CASE WHEN r.from_key=? THEN r.to_key ELSE r.from_key END)
      WHERE r.corpus_id=? AND (r.from_key=? OR r.to_key=?)
      ORDER BY r.relation,other.name
    `,
      )
      .all(sourceKey, sourceKey, corpusId, sourceKey, sourceKey) as Array<
      SourceRelation & {
        otherName: string;
        otherKind: SourceKind;
        direction: "out" | "in";
      }
    >;
    return rows.map((row) => ({
      ...row,
      displayRelation:
        row.direction === "out"
          ? row.relation
          : (inverseRelation(row.relation) ?? `← ${row.relation}`),
    }));
  }

  /** Rebuild only one card's outgoing derived index; incoming edges belong to
   * the other cards and are left intact. */
  clearOutgoingRelations(corpusId: string, sourceKey: string): void {
    this.db.raw
      .prepare("DELETE FROM source_relations WHERE corpus_id=? AND from_key=?")
      .run(corpusId, sourceKey);
  }

  bindProject(projectId: string, corpusId: string, enabled = true): void {
    const project = this.db.raw
      .prepare("SELECT id FROM projects WHERE id=? AND deleted_at IS NULL")
      .get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    if (!this.getCorpus(corpusId))
      throw new Error(`Source corpus not found: ${corpusId}`);
    this.db.raw
      .prepare(
        `
      INSERT INTO project_source_bindings(project_id,corpus_id,enabled,created_at)
      VALUES (?,?,?,?)
      ON CONFLICT(project_id,corpus_id) DO UPDATE SET enabled=excluded.enabled
    `,
      )
      .run(projectId, corpusId, enabled ? 1 : 0, new Date().toISOString());
  }

  listProjectCorpora(projectId: string): SourceCorpus[] {
    const rows = this.db.raw
      .prepare(
        `
      SELECT c.*, (SELECT COUNT(*) FROM source_records r
        LEFT JOIN source_record_presence presence ON
          presence.corpus_id=r.corpus_id AND presence.source_key=r.source_key
        WHERE r.corpus_id=c.id AND COALESCE(presence.active,1)=1) AS record_count,
        (SELECT COUNT(*) FROM source_relations e WHERE e.corpus_id=c.id) AS relation_count
      FROM source_corpora c JOIN project_source_bindings b ON b.corpus_id=c.id
      WHERE b.project_id=? AND b.enabled=1 ORDER BY c.title
    `,
      )
      .all(projectId) as unknown as CorpusRow[];
    return rows.map(corpusFromRow);
  }

  search(
    query: string,
    options: {
      corpusId?: string;
      projectId?: string;
      kind?: SourceKind;
      limit?: number;
      offset?: number;
    } = {},
  ): SourceRecordHit[] {
    const clauses: string[] = [];
    const args: Array<string | number> = [];
    if (options.corpusId) {
      clauses.push("r.corpus_id=?");
      args.push(options.corpusId);
    }
    if (options.projectId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM project_source_bindings b
        WHERE b.project_id=? AND b.corpus_id=r.corpus_id AND b.enabled=1
      )`);
      args.push(options.projectId);
    }
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM source_record_presence presence
      WHERE presence.corpus_id=r.corpus_id AND presence.source_key=r.source_key
        AND presence.active=0
    )`);
    if (options.kind) {
      clauses.push("r.kind=?");
      args.push(options.kind);
    }
    const normalized = query.trim();
    if (normalized) {
      const escaped = normalized
        .replaceAll("\\", "\\\\")
        .replaceAll("%", "\\%")
        .replaceAll("_", "\\_");
      clauses.push(`(r.name LIKE ? ESCAPE '\\' OR r.aliases_json LIKE ? ESCAPE '\\'
                      OR r.summary LIKE ? ESCAPE '\\')`);
      args.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    const rows = this.db.raw
      .prepare(
        `
      SELECT r.corpus_id AS corpusId, r.source_key AS sourceKey,
        r.name, r.kind, r.summary, r.origin_collection AS originCollection
      FROM source_records r
      ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""}
      ORDER BY r.kind,r.name,r.source_key LIMIT ? OFFSET ?
    `,
      )
      .all(...args, limit, offset);
    return rows as SourceRecordHit[];
  }

  /** Upstream re-import replaces only this corpus's computed relations.
   * Neither Project Canon nor other corpora are touched. */
  clearRelations(corpusId: string): void {
    this.db.raw
      .prepare("DELETE FROM source_relations WHERE corpus_id=?")
      .run(corpusId);
  }
}
