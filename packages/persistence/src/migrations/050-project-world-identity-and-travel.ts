/**
 * Module 2: one Project Reality may travel through MANY source mother-worlds.
 * Extends existing 049 source corpora and native 002 Canon/Timeline, without
 * inventing a second project or copying sources into confirmed Canon.
 *
 * Coordinates are authored story facts; travel does NOT automatically
 * create temporal branches, transfer abilities, or apply future canon.
 */
export const migration050 = {
  version: 50,
  name: "project-world-identity-and-travel",
  sql: `
    CREATE TABLE project_world_spaces (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      kind TEXT NOT NULL CHECK(kind IN ('realm','region','site','dimension','other')),
      parent_space_id TEXT,
      source_corpus_id TEXT REFERENCES source_corpora(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(project_id,id),
      FOREIGN KEY(project_id,parent_space_id)
        REFERENCES project_world_spaces(project_id,id)
    ) STRICT;
    CREATE INDEX project_world_spaces_project_idx
      ON project_world_spaces(project_id,kind,parent_space_id);

    -- Explicit only. No branch is produced merely because a hero travels
    -- to the past, nor is source history silently restored afterward.
    CREATE TABLE project_time_branches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      parent_branch_id TEXT,
      divergence_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      causal_rule TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(project_id,id),
      FOREIGN KEY(project_id,parent_branch_id)
        REFERENCES project_time_branches(project_id,id)
    ) STRICT;

    -- A source record is a reference, not a copy of an accepted Project fact.
    -- The same project character may have several source references, and a
    -- source character may inspire several different project identities.
    CREATE TABLE project_source_entity_links (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      corpus_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      link_kind TEXT NOT NULL CHECK(link_kind IN (
        'counterpart','adaptation','inspiration','possible_match','alias'
      )),
      confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY(project_id,entity_id,corpus_id,source_key,link_kind),
      FOREIGN KEY(corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key),
      FOREIGN KEY(project_id,corpus_id)
        REFERENCES project_source_bindings(project_id,corpus_id)
    ) WITHOUT ROWID;
    CREATE INDEX project_source_entity_lookup_idx
      ON project_source_entity_links(corpus_id,source_key,project_id);

    -- Identity origin/home/affiliation is NOT the hero's current position.
    -- Current presence is derived from actual events/transitions.
    CREATE TABLE project_entity_space_links (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      space_id TEXT NOT NULL,
      link_kind TEXT NOT NULL CHECK(link_kind IN (
        'origin','home','affiliated','world_rule_scope','other'
      )),
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY(project_id,entity_id,space_id,link_kind),
      FOREIGN KEY(project_id,space_id)
        REFERENCES project_world_spaces(project_id,id)
    ) WITHOUT ROWID;
    CREATE INDEX project_entity_space_reverse_idx
      ON project_entity_space_links(project_id,space_id,link_kind);

    -- The same one event can have an origin and an arrival coordinate.
    -- Story sequence belongs to native timeline_events.sequence; local
    -- time can move backwards and is intentionally NOT used for story order.
    CREATE TABLE project_event_coordinates (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
      coordinate_role TEXT NOT NULL CHECK(coordinate_role IN (
        'occurrence','departure','arrival','waypoint'
      )),
      space_id TEXT NOT NULL,
      local_time TEXT NOT NULL,
      branch_id TEXT,
      description TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(project_id,event_id,ordinal),
      FOREIGN KEY(project_id,space_id)
        REFERENCES project_world_spaces(project_id,id),
      FOREIGN KEY(project_id,branch_id)
        REFERENCES project_time_branches(project_id,id)
    ) WITHOUT ROWID;
    CREATE INDEX project_event_coordinate_space_idx
      ON project_event_coordinates(project_id,space_id,local_time);

    CREATE TABLE project_travel_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
      traveler_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      from_space_id TEXT NOT NULL,
      to_space_id TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      from_branch_id TEXT,
      to_branch_id TEXT,
      travel_kind TEXT NOT NULL CHECK(travel_kind IN (
        'spatial','cross_world','time_travel','cross_world_time'
      )),
      mechanism_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      consequence_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(project_id,event_id,traveler_entity_id),
      FOREIGN KEY(project_id,from_space_id)
        REFERENCES project_world_spaces(project_id,id),
      FOREIGN KEY(project_id,to_space_id)
        REFERENCES project_world_spaces(project_id,id),
      FOREIGN KEY(project_id,from_branch_id)
        REFERENCES project_time_branches(project_id,id),
      FOREIGN KEY(project_id,to_branch_id)
        REFERENCES project_time_branches(project_id,id)
    ) STRICT;
    CREATE INDEX project_travel_actor_sequence_idx
      ON project_travel_events(project_id,traveler_entity_id,event_id);

    -- Only when two simultaneous instantiations genuinely occur. The stable
    -- project character identity (entity_id) is never replaced by instance.
    CREATE TABLE project_entity_instances (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      space_id TEXT,
      branch_id TEXT,
      instance_kind TEXT NOT NULL CHECK(instance_kind IN (
        'temporal_self','separate_body','projection','other'
      )),
      appeared_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      ended_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id,space_id)
        REFERENCES project_world_spaces(project_id,id),
      FOREIGN KEY(project_id,branch_id)
        REFERENCES project_time_branches(project_id,id)
    ) STRICT;
    CREATE INDEX project_entity_instances_subject_idx
      ON project_entity_instances(project_id,entity_id);

    -- Identity/space/chronology guards: a global foreign key alone prevents
    -- dangling IDs but does not prevent cross-NOVEL references.
    CREATE TRIGGER pw_spaces_insert BEFORE INSERT ON project_world_spaces BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.parent_space_id IS NOT NULL AND
         (SELECT project_id FROM project_world_spaces WHERE id=NEW.parent_space_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_spaces_update BEFORE UPDATE ON project_world_spaces BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.parent_space_id IS NOT NULL AND
         (SELECT project_id FROM project_world_spaces WHERE id=NEW.parent_space_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_branches_insert BEFORE INSERT ON project_time_branches BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.parent_branch_id IS NOT NULL AND
         (SELECT project_id FROM project_time_branches WHERE id=NEW.parent_branch_id)<>NEW.project_id)
        OR (NEW.divergence_event_id IS NOT NULL AND
         (SELECT project_id FROM timeline_events WHERE id=NEW.divergence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_branches_update BEFORE UPDATE ON project_time_branches BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.parent_branch_id IS NOT NULL AND
         (SELECT project_id FROM project_time_branches WHERE id=NEW.parent_branch_id)<>NEW.project_id)
        OR (NEW.divergence_event_id IS NOT NULL AND
         (SELECT project_id FROM timeline_events WHERE id=NEW.divergence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_source_links_insert BEFORE INSERT ON project_source_entity_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id;
    END;
    CREATE TRIGGER pw_source_links_update BEFORE UPDATE ON project_source_entity_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id;
    END;
    CREATE TRIGGER pw_entity_spaces_insert BEFORE INSERT ON project_entity_space_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id;
    END;
    CREATE TRIGGER pw_entity_spaces_update BEFORE UPDATE ON project_entity_space_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id;
    END;
    CREATE TRIGGER pw_coordinates_insert BEFORE INSERT ON project_event_coordinates BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)<>NEW.project_id;
    END;
    CREATE TRIGGER pw_coordinates_update BEFORE UPDATE ON project_event_coordinates BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)<>NEW.project_id;
    END;
    CREATE TRIGGER pw_travel_insert BEFORE INSERT ON project_travel_events BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.traveler_entity_id)<>NEW.project_id
        OR (NEW.mechanism_entity_id IS NOT NULL AND
         (SELECT project_id FROM canon_entities WHERE id=NEW.mechanism_entity_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_travel_update BEFORE UPDATE ON project_travel_events BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.traveler_entity_id)<>NEW.project_id
        OR (NEW.mechanism_entity_id IS NOT NULL AND
         (SELECT project_id FROM canon_entities WHERE id=NEW.mechanism_entity_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_instances_insert BEFORE INSERT ON project_entity_instances BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id
        OR (NEW.appeared_event_id IS NOT NULL AND
         (SELECT project_id FROM timeline_events WHERE id=NEW.appeared_event_id)<>NEW.project_id)
        OR (NEW.ended_event_id IS NOT NULL AND
         (SELECT project_id FROM timeline_events WHERE id=NEW.ended_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER pw_instances_update BEFORE UPDATE ON project_entity_instances BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id
        OR (NEW.appeared_event_id IS NOT NULL AND
         (SELECT project_id FROM timeline_events WHERE id=NEW.appeared_event_id)<>NEW.project_id)
        OR (NEW.ended_event_id IS NOT NULL AND
         (SELECT project_id FROM timeline_events WHERE id=NEW.ended_event_id)<>NEW.project_id);
    END;
  `,
} as const;
