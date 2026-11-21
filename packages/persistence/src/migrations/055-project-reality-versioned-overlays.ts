/**
 * Project Reality is a read/write overlay on the existing Story Bible/Canon
 * and the *independent* source-world encyclopedia.
 *
 * This journal does not import/generate world content. For factual assertions
 * it stores a POINTER to a native accepted canon_fact; other project-specific
 * world sections are versioned JSON with explicit event provenance.
 *
 * SET and UNSET are both events. Absence must never be mistaken for deletion
 * (otherwise a deleted source fact silently returns after fallback).
 */
export const migration055 = {
  version: 55,
  name: "project-reality-versioned-overlays",
  sql: `
    CREATE TABLE project_reality_revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES project_time_branches(id) ON DELETE SET NULL,
      facet TEXT NOT NULL CHECK(facet IN (
        'claim','lore','chronicle','organization','ability','relationship',
        'map','standing','production','value','asset','state','other'
      )),
      slot_key TEXT NOT NULL CHECK(length(trim(slot_key))>0),
      operation TEXT NOT NULL CHECK(operation IN ('set','unset')),
      canon_fact_id TEXT REFERENCES canon_facts(id) ON DELETE RESTRICT,
      value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      CHECK(
        (operation='unset' AND canon_fact_id IS NULL AND value_json IS NULL)
        OR
        (operation='set' AND facet='claim'
          AND canon_fact_id IS NOT NULL AND value_json IS NULL)
        OR
        (operation='set' AND facet<>'claim'
          AND canon_fact_id IS NULL AND value_json IS NOT NULL)
      )
    ) STRICT;
    CREATE INDEX project_reality_revision_entity_idx
      ON project_reality_revisions(project_id,entity_id,facet,slot_key);
    CREATE INDEX project_reality_revision_event_idx
      ON project_reality_revisions(project_id,event_id,branch_id);
    CREATE UNIQUE INDEX project_reality_revision_once_idx
      ON project_reality_revisions(
        project_id,entity_id,event_id,facet,slot_key,COALESCE(branch_id,'')
      );

    CREATE TRIGGER project_reality_revision_guard
    BEFORE INSERT ON project_reality_revisions BEGIN
      SELECT RAISE(ABORT,'reality.project_mismatch') WHERE
        NOT EXISTS(
          SELECT 1 FROM canon_entities e
          WHERE e.id=NEW.entity_id AND e.project_id=NEW.project_id
        )
        OR NOT EXISTS(
          SELECT 1 FROM timeline_events e
          WHERE e.id=NEW.event_id AND e.project_id=NEW.project_id
        )
        OR (NEW.branch_id IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM project_time_branches b
          WHERE b.id=NEW.branch_id AND b.project_id=NEW.project_id
        ))
        OR (NEW.canon_fact_id IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM canon_facts f
          WHERE f.id=NEW.canon_fact_id
            AND f.project_id=NEW.project_id
            AND f.subject_id=NEW.entity_id
            AND f.predicate=NEW.slot_key
            AND f.authority IN ('confirmed','locked')
            AND NOT EXISTS(
              SELECT 1 FROM canon_fact_withdrawals w WHERE w.fact_id=f.id
            )
        ));
    END;

    -- Versions may be superseded by NEW events but never edited in place.
    CREATE TRIGGER project_reality_revision_no_update
    BEFORE UPDATE ON project_reality_revisions BEGIN
      SELECT RAISE(ABORT,'reality.revision_immutable');
    END;
  `,
} as const;
