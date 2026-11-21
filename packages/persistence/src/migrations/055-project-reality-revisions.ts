/**
 * Materializes the event-versioned Project Reality revision store already
 * consumed by SqliteProjectRealityRepository.
 *
 * This is not a second story-truth database. Native Canon / Timeline /
 * Relationship remain the accepted truth; this table stores only explicit
 * event-versioned Project Reality section overrides/masks.
 */
export const migration055 = {
  version: 55,
  name: "project-reality-revisions",
  sql: `
    CREATE TABLE project_reality_revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
      branch_id TEXT,
      facet TEXT NOT NULL CHECK(facet IN (
        'claim','lore','chronicle','organization','ability','relationship',
        'map','standing','production','value','asset','state','other'
      )),
      slot_key TEXT NOT NULL CHECK(length(trim(slot_key)) > 0),
      operation TEXT NOT NULL CHECK(operation IN ('set','unset')),
      canon_fact_id TEXT REFERENCES canon_facts(id),
      value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id,branch_id)
        REFERENCES project_time_branches(project_id,id),
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

    CREATE INDEX project_reality_entity_event_idx
      ON project_reality_revisions(project_id,entity_id,event_id,created_at);
    CREATE INDEX project_reality_branch_idx
      ON project_reality_revisions(project_id,branch_id,event_id);

    CREATE TRIGGER project_reality_revision_insert
      BEFORE INSERT ON project_reality_revisions
    BEGIN
      SELECT RAISE(ABORT,'reality.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)
          <> NEW.project_id
        OR
        (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)
          <> NEW.project_id
        OR
        (NEW.canon_fact_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM canon_facts fact
          WHERE fact.id=NEW.canon_fact_id
            AND fact.project_id=NEW.project_id
            AND fact.subject_id=NEW.entity_id
        ));
    END;

    CREATE TRIGGER project_reality_revision_update
      BEFORE UPDATE ON project_reality_revisions
    BEGIN
      SELECT RAISE(ABORT,'reality.revision.immutable');
    END;

    CREATE TRIGGER project_reality_revision_delete
      BEFORE DELETE ON project_reality_revisions
      WHEN EXISTS (
        SELECT 1 FROM projects
        WHERE id=OLD.project_id AND deleted_at IS NULL
      )
    BEGIN
      SELECT RAISE(ABORT,'reality.revision.immutable');
    END;
  `,
} as const;
