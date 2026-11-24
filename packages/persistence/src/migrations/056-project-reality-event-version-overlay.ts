/**
 * Materialize the event-versioned Project Reality overlay already consumed by
 * SqliteProjectRealityRepository. The table does not duplicate Canon claims:
 * claim SET rows point at an accepted canon_fact_id; only non-claim world
 * sections persist their own event-versioned JSON value.
 */
export const migration056 = {
  version: 56,
  name: "project-reality-event-version-overlay",
  sql: `
    CREATE TABLE project_reality_revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE RESTRICT,
      branch_id TEXT REFERENCES project_time_branches(id) ON DELETE RESTRICT,
      facet TEXT NOT NULL CHECK(facet IN (
        'claim','lore','chronicle','organization','ability','relationship',
        'map','standing','production','value','asset','state','other'
      )),
      slot_key TEXT NOT NULL CHECK(length(trim(slot_key)) > 0),
      operation TEXT NOT NULL CHECK(operation IN ('set','unset')),
      canon_fact_id TEXT REFERENCES canon_facts(id) ON DELETE RESTRICT,
      value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      CHECK (
        (operation='unset' AND canon_fact_id IS NULL AND value_json IS NULL)
        OR
        (operation='set' AND facet='claim'
          AND canon_fact_id IS NOT NULL AND value_json IS NULL)
        OR
        (operation='set' AND facet<>'claim'
          AND canon_fact_id IS NULL AND value_json IS NOT NULL)
      )
    ) STRICT;

    CREATE INDEX project_reality_revisions_entity_idx
      ON project_reality_revisions(
        project_id,entity_id,branch_id,event_id,facet,slot_key
      );
    CREATE INDEX project_reality_revisions_fact_idx
      ON project_reality_revisions(canon_fact_id)
      WHERE canon_fact_id IS NOT NULL;

    CREATE TRIGGER project_reality_revision_validate_insert
    BEFORE INSERT ON project_reality_revisions BEGIN
      SELECT RAISE(ABORT,'reality.project_mismatch') WHERE NOT EXISTS (
        SELECT 1 FROM canon_entities e
        WHERE e.id=NEW.entity_id AND e.project_id=NEW.project_id
      );
      SELECT RAISE(ABORT,'reality.event_project_mismatch') WHERE NOT EXISTS (
        SELECT 1 FROM timeline_events ev
        WHERE ev.id=NEW.event_id AND ev.project_id=NEW.project_id
      );
      SELECT RAISE(ABORT,'reality.branch_project_mismatch') WHERE
        NEW.branch_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM project_time_branches b
          WHERE b.id=NEW.branch_id AND b.project_id=NEW.project_id
        );
      SELECT RAISE(ABORT,'reality.fact_project_mismatch') WHERE
        NEW.canon_fact_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM canon_facts f
          WHERE f.id=NEW.canon_fact_id
            AND f.project_id=NEW.project_id
            AND f.subject_id=NEW.entity_id
        );
    END;

    CREATE TRIGGER project_reality_revision_immutable
    BEFORE UPDATE ON project_reality_revisions BEGIN
      SELECT RAISE(ABORT,'reality.revision.immutable');
    END;
  `,
} as const;
