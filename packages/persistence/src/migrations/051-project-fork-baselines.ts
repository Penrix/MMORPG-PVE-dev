/**
 * A Project is one copy-on-write reality over many independent source corpora.
 * This migration stores ONLY:
 * - immutable character-core anchors explicitly accepted by the author;
 * - selective SOURCE claim snapshots to compare against native Canon facts.
 *
 * It does not clone Source Corpus into Canon or add a second Project truth store.
 * Different outcomes, relationships and positions remain in native Canon/
 * Timeline/Relationship records, not in these tables.
 */
export const migration051 = {
  version: 51,
  name: "project-fork-baselines-and-character-core",
  sql: `
    CREATE TABLE project_character_anchors (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      source_corpus_id TEXT,
      source_key TEXT,
      traits_json TEXT NOT NULL CHECK(json_valid(traits_json)
        AND json_type(traits_json)='array'
        AND json_array_length(traits_json)>0),
      decision_pattern TEXT NOT NULL CHECK(length(trim(decision_pattern))>0),
      source_note TEXT NOT NULL CHECK(length(trim(source_note))>0),
      created_at TEXT NOT NULL,
      PRIMARY KEY(project_id,entity_id),
      CHECK ((source_corpus_id IS NULL AND source_key IS NULL)
        OR (source_corpus_id IS NOT NULL AND source_key IS NOT NULL)),
      FOREIGN KEY(source_corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key)
    ) WITHOUT ROWID;
    CREATE INDEX project_character_anchor_source_idx
      ON project_character_anchors(source_corpus_id,source_key);

    CREATE TABLE project_fork_claim_baselines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      source_corpus_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      source_json_path TEXT NOT NULL CHECK(length(trim(source_json_path))>1),
      project_predicate TEXT NOT NULL CHECK(length(trim(project_predicate))>0),
      baseline_value_json TEXT NOT NULL CHECK(json_valid(baseline_value_json)),
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(project_id,entity_id,source_corpus_id,source_key,source_json_path,
        project_predicate),
      FOREIGN KEY(source_corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key)
    ) STRICT;
    CREATE INDEX project_fork_claims_entity_idx
      ON project_fork_claim_baselines(project_id,entity_id,project_predicate);

    -- An author's core-character baseline is never mutated by an ordinary
    -- plot state update or chapter settlement. A later deliberate character
    -- reinterpretation needs an explicit reviewed migration/decision.
    CREATE TRIGGER project_character_anchor_no_update
      BEFORE UPDATE ON project_character_anchors
    BEGIN
      SELECT RAISE(ABORT,'character.anchor.immutable');
    END;
    CREATE TRIGGER project_character_anchor_no_delete
      BEFORE DELETE ON project_character_anchors
      WHEN EXISTS (SELECT 1 FROM projects WHERE id=OLD.project_id AND deleted_at IS NULL)
    BEGIN
      SELECT RAISE(ABORT,'character.anchor.immutable');
    END;
    CREATE TRIGGER project_fork_claim_no_update
      BEFORE UPDATE ON project_fork_claim_baselines
    BEGIN
      SELECT RAISE(ABORT,'world.fork_baseline.immutable');
    END;
    CREATE TRIGGER project_fork_claim_no_delete
      BEFORE DELETE ON project_fork_claim_baselines
      WHEN EXISTS (SELECT 1 FROM projects WHERE id=OLD.project_id AND deleted_at IS NULL)
    BEGIN
      SELECT RAISE(ABORT,'world.fork_baseline.immutable');
    END;

    CREATE TRIGGER project_character_anchor_validate
      BEFORE INSERT ON project_character_anchors
    BEGIN
      SELECT RAISE(ABORT,'character.anchor.invalid_subject') WHERE NOT EXISTS(
        SELECT 1 FROM canon_entities e
        WHERE e.id=NEW.entity_id AND e.project_id=NEW.project_id
          AND e.type='character'
      );
      SELECT RAISE(ABORT,'world.source_not_linked') WHERE
        NEW.source_corpus_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM project_source_entity_links link
          JOIN project_source_bindings bound
            ON bound.project_id=link.project_id
           AND bound.corpus_id=link.corpus_id AND bound.enabled=1
          WHERE link.project_id=NEW.project_id AND link.entity_id=NEW.entity_id
            AND link.corpus_id=NEW.source_corpus_id
            AND link.source_key=NEW.source_key
        );
    END;
    CREATE TRIGGER project_fork_claim_validate
      BEFORE INSERT ON project_fork_claim_baselines
    BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE NOT EXISTS(
        SELECT 1 FROM canon_entities e
        WHERE e.id=NEW.entity_id AND e.project_id=NEW.project_id
      );
      SELECT RAISE(ABORT,'world.source_not_linked') WHERE NOT EXISTS(
        SELECT 1 FROM project_source_entity_links link
        JOIN project_source_bindings bound
          ON bound.project_id=link.project_id
         AND bound.corpus_id=link.corpus_id AND bound.enabled=1
        WHERE link.project_id=NEW.project_id AND link.entity_id=NEW.entity_id
          AND link.corpus_id=NEW.source_corpus_id
          AND link.source_key=NEW.source_key
      );
    END;
  `,
} as const;
