import { SqliteCanonRepository } from "./canon-repository.js";
import type { NarrativeDatabase } from "./database.js";

export interface CharacterCoreAnchor {
  projectId: string;
  entityId: string;
  sourceCorpusId: string | null;
  sourceKey: string | null;
  tags: string[];
  decisionPattern: string;
  sourceNote: string;
  createdAt: string;
}
export interface ForkFieldBinding {
  id: string;
  projectId: string;
  entityId: string;
  sourceCorpusId: string;
  sourceKey: string;
  sourceJsonPath: string;
  projectPredicate: string;
  sourceNote: string;
  createdAt: string;
}
export interface ForkFieldDiff {
  sourceCorpusId: string;
  sourceKey: string;
  sourceJsonPath: string;
  predicate: string;
  baseline: unknown;
  projectValue: unknown;
  projectFactIds: string[];
  status:
    | "reference_inherited"
    | "same_as_source"
    | "project_changed"
    | "project_conflict";
}
export interface ForkProjectAddition {
  predicate: string;
  projectValue: unknown;
  factId: string;
}
export interface ProjectForkDiff {
  entityId: string;
  core: CharacterCoreAnchor | null;
  compared: ForkFieldDiff[];
  additions: ForkProjectAddition[];
}

/** Compare canonical JSON values, ignoring object key insertion order. */
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(obj)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value) ?? "undefined";
};
const rowToAnchor = (r: Record<string, unknown>): CharacterCoreAnchor => ({
  projectId: r.project_id as string,
  entityId: r.entity_id as string,
  sourceCorpusId: r.source_corpus_id as string | null,
  sourceKey: r.source_key as string | null,
  tags: JSON.parse(r.traits_json as string) as string[],
  decisionPattern: r.decision_pattern as string,
  sourceNote: r.source_note as string,
  createdAt: r.created_at as string,
});
const scalarSourceValue = (kind: string, raw: unknown): unknown => {
  if (kind === "true") return true;
  if (kind === "false") return false;
  if (kind === "null") return null;
  if (kind === "array" || kind === "object") return JSON.parse(raw as string);
  return raw;
};

/**
 * This is an overlay INDEX, NOT a replacement Canon:
 * - source snapshots remain read-only references;
 * - actual novel changes MUST be in NarraLume canon_facts;
 * - absence of an override is NOT proof that the project enacted the entire
 * source future;
 * - character core is an explicit immutable author-approved interpretation.
 */
export class SqliteProjectForkRepository {
  private readonly canon: SqliteCanonRepository;

  constructor(private readonly db: NarrativeDatabase) {
    this.canon = new SqliteCanonRepository(db);
  }

  createCharacterCore(core: CharacterCoreAnchor): void {
    if (core.tags.length === 0 || core.tags.some((t) => !t.trim()))
      throw new Error("character.anchor.invalid_tags");
    if (new Set(core.tags).size !== core.tags.length)
      throw new Error("character.anchor.duplicate_tags");
    this.db.raw
      .prepare(
        `
      INSERT INTO project_character_anchors(
        project_id,entity_id,source_corpus_id,source_key,
        traits_json,decision_pattern,source_note,created_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `,
      )
      .run(
        core.projectId,
        core.entityId,
        core.sourceCorpusId,
        core.sourceKey,
        JSON.stringify(core.tags),
        core.decisionPattern,
        core.sourceNote,
        core.createdAt,
      );
  }

  getCharacterCore(
    projectId: string,
    entityId: string,
  ): CharacterCoreAnchor | null {
    const row = this.db.raw
      .prepare(
        `
      SELECT * FROM project_character_anchors
      WHERE project_id=? AND entity_id=?
    `,
      )
      .get(projectId, entityId) as Record<string, unknown> | undefined;
    return row ? rowToAnchor(row) : null;
  }

  bindSourceField(input: ForkFieldBinding): void {
    // A field is copied *once* as the source baseline for this project.
    // Reimporting later cannot silently shift the fork base.
    if (!/^\$(?:\.[A-Za-z_][\w-]*|\[\d+\])+$/.test(input.sourceJsonPath))
      throw new Error("world.fork.invalid_json_path");
    const row = this.db.raw
      .prepare(
        `
      SELECT json_type(raw_json,?) AS kind,
             json_extract(raw_json,?) AS value
      FROM source_records WHERE corpus_id=? AND source_key=?
    `,
      )
      .get(
        input.sourceJsonPath,
        input.sourceJsonPath,
        input.sourceCorpusId,
        input.sourceKey,
      ) as { kind: string | null; value: unknown } | undefined;
    if (!row || row.kind === null)
      throw new Error("world.fork.source_path_missing");
    const sourceValue = scalarSourceValue(row.kind, row.value);
    this.db.raw
      .prepare(
        `
      INSERT INTO project_fork_claim_baselines(
        id,project_id,entity_id,source_corpus_id,source_key,
        source_json_path,project_predicate,baseline_value_json,
        source_note,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `,
      )
      .run(
        input.id,
        input.projectId,
        input.entityId,
        input.sourceCorpusId,
        input.sourceKey,
        input.sourceJsonPath,
        input.projectPredicate,
        JSON.stringify(sourceValue),
        input.sourceNote,
        input.createdAt,
      );
  }

  diffEntity(projectId: string, entityId: string): ProjectForkDiff {
    const entity = this.canon.getEntity(projectId, entityId);
    if (!entity) throw new Error("world.entity_not_found");
    const rows = this.db.raw
      .prepare(
        `
      SELECT * FROM project_fork_claim_baselines
      WHERE project_id=? AND entity_id=? ORDER BY source_corpus_id,
      source_key,source_json_path,project_predicate
    `,
      )
      .all(projectId, entityId) as Array<Record<string, unknown>>;
    const accepted = this.canon
      .listEffectiveFacts(projectId, { subjectId: entityId })
      .filter((f) => f.authority === "confirmed" || f.authority === "locked");
    const tracked = new Set<string>();
    const compared: ForkFieldDiff[] = rows.map((row) => {
      const predicate = row.project_predicate as string;
      tracked.add(predicate);
      const matched = accepted.filter((f) => f.predicate === predicate);
      const values = matched.map((f) => f.objectEntityId ?? f.value);
      const baseline = JSON.parse(row.baseline_value_json as string) as unknown;
      let status: ForkFieldDiff["status"] = "reference_inherited";
      if (matched.length === 1)
        status =
          canonical(values[0]) === canonical(baseline)
            ? "same_as_source"
            : "project_changed";
      else if (matched.length > 1)
        status =
          new Set(values.map(canonical)).size === 1
            ? canonical(values[0]) === canonical(baseline)
              ? "same_as_source"
              : "project_changed"
            : "project_conflict";
      return {
        sourceCorpusId: row.source_corpus_id as string,
        sourceKey: row.source_key as string,
        sourceJsonPath: row.source_json_path as string,
        predicate,
        baseline,
        projectValue:
          values.length === 0 ? null : values.length === 1 ? values[0] : values,
        projectFactIds: matched.map((f) => f.id),
        status,
      };
    });
    const additions: ForkProjectAddition[] = accepted
      .filter((f) => !tracked.has(f.predicate))
      .map((f) => ({
        predicate: f.predicate,
        projectValue: f.objectEntityId ?? f.value,
        factId: f.id,
      }));
    return {
      entityId,
      core: this.getCharacterCore(projectId, entityId),
      compared,
      additions,
    };
  }
}
