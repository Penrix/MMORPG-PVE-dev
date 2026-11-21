/** World database second slice: a typed read/write structure shared by
 * v0.1-v0.7. Original Canon remains the only accepted fact/event authority.
 * All tables are cross-referenced to Canon entities, facts and timeline IDs.
 */
export const migration048 = {
  version: 48,
  name: "world-map-power-production-information",
  sql: `
    CREATE TABLE world_map_edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      from_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      to_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      layer TEXT NOT NULL CHECK(layer IN ('physical','control','social','information')),
      edge_kind TEXT NOT NULL CHECK(length(trim(edge_kind))>0),
      intermediary_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      access_conditions TEXT NOT NULL DEFAULT '',
      time_conditions TEXT NOT NULL DEFAULT '',
      valid_from_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      valid_to_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown',
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      CHECK(from_entity_id<>to_entity_id)
    ) STRICT;
    CREATE INDEX world_map_edges_project_idx ON world_map_edges(project_id);
    CREATE TABLE world_capability_profiles (
      entity_id TEXT PRIMARY KEY REFERENCES canon_entities(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      power_mode TEXT NOT NULL CHECK(power_mode IN ('ordinary','supernatural')),
      mechanism TEXT NOT NULL CHECK(length(trim(mechanism))>0),
      actual_actions TEXT NOT NULL,
      effective_scope TEXT NOT NULL DEFAULT '',
      activation_conditions TEXT NOT NULL DEFAULT '',
      countermeasures TEXT NOT NULL DEFAULT '',
      knowledge_or_training TEXT NOT NULL DEFAULT '',
      social_effects TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'unknown',
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_capability_profiles_project_idx ON world_capability_profiles(project_id);
    CREATE TABLE world_capability_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      target_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      relation TEXT NOT NULL CHECK(relation IN ('prerequisite','combines_with','counters','improves','transforms_to','transmitted_by','licensed_by','used_by')),
      mechanism TEXT NOT NULL DEFAULT '',
      evidence_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown',
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      CHECK(source_entity_id<>target_entity_id)
    ) STRICT;
    CREATE INDEX world_capability_links_project_idx ON world_capability_links(project_id);
    CREATE TABLE world_production_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      input_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      output_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      operator_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      site_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      intermediary_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      process_kind TEXT NOT NULL CHECK(process_kind IN ('extract','train','produce','transform','transport','trade','consume','repair','distribute','other')),
      concrete_process TEXT NOT NULL CHECK(length(trim(concrete_process))>0),
      prerequisites TEXT NOT NULL DEFAULT '',
      resource_value TEXT NOT NULL DEFAULT '',
      realization_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown',
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_production_links_project_idx ON world_production_links(project_id);
    CREATE TABLE world_information_flows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      fact_id TEXT NOT NULL REFERENCES canon_facts(id) ON DELETE CASCADE,
      sender_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      receiver_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      carrier_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      world_time TEXT NOT NULL,
      belief TEXT NOT NULL CHECK(belief IN ('known','believed','suspected','false_belief','rejected','withheld')),
      transmission TEXT NOT NULL CHECK(length(trim(transmission))>0),
      source_type TEXT NOT NULL DEFAULT 'unknown',
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_information_flows_project_idx ON world_information_flows(project_id);
    CREATE TRIGGER world_map_edges_insert_project_guard
    BEFORE INSERT ON world_map_edges BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.from_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.from_entity_id)<>NEW.project_id)
        OR         (NEW.to_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.to_entity_id)<>NEW.project_id)
        OR         (NEW.intermediary_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR         (NEW.valid_from_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.valid_from_event_id)<>NEW.project_id)
        OR         (NEW.valid_to_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.valid_to_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_map_edges_update_project_guard
    BEFORE UPDATE ON world_map_edges BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.from_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.from_entity_id)<>NEW.project_id)
        OR         (NEW.to_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.to_entity_id)<>NEW.project_id)
        OR         (NEW.intermediary_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR         (NEW.valid_from_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.valid_from_event_id)<>NEW.project_id)
        OR         (NEW.valid_to_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.valid_to_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_capability_profiles_insert_project_guard
    BEFORE INSERT ON world_capability_profiles BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_capability_profiles_update_project_guard
    BEFORE UPDATE ON world_capability_profiles BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_capability_links_insert_project_guard
    BEFORE INSERT ON world_capability_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.source_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.source_entity_id)<>NEW.project_id)
        OR         (NEW.target_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.target_entity_id)<>NEW.project_id)
        OR         (NEW.evidence_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_capability_links_update_project_guard
    BEFORE UPDATE ON world_capability_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.source_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.source_entity_id)<>NEW.project_id)
        OR         (NEW.target_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.target_entity_id)<>NEW.project_id)
        OR         (NEW.evidence_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_production_links_insert_project_guard
    BEFORE INSERT ON world_production_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.input_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.input_entity_id)<>NEW.project_id)
        OR         (NEW.output_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.output_entity_id)<>NEW.project_id)
        OR         (NEW.operator_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.operator_entity_id)<>NEW.project_id)
        OR         (NEW.site_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.site_entity_id)<>NEW.project_id)
        OR         (NEW.intermediary_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR         (NEW.realization_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.realization_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_production_links_update_project_guard
    BEFORE UPDATE ON world_production_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.input_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.input_entity_id)<>NEW.project_id)
        OR         (NEW.output_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.output_entity_id)<>NEW.project_id)
        OR         (NEW.operator_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.operator_entity_id)<>NEW.project_id)
        OR         (NEW.site_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.site_entity_id)<>NEW.project_id)
        OR         (NEW.intermediary_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR         (NEW.realization_event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.realization_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_information_flows_insert_project_guard
    BEFORE INSERT ON world_information_flows BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.sender_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.sender_entity_id)<>NEW.project_id)
        OR         (NEW.receiver_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.receiver_entity_id)<>NEW.project_id)
        OR         (NEW.carrier_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.carrier_entity_id)<>NEW.project_id)
        OR         (NEW.event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)<>NEW.project_id)
        OR         (NEW.fact_id IS NOT NULL AND (SELECT project_id FROM canon_facts WHERE id=NEW.fact_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_information_flows_update_project_guard
    BEFORE UPDATE ON world_information_flows BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (NEW.sender_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.sender_entity_id)<>NEW.project_id)
        OR         (NEW.receiver_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.receiver_entity_id)<>NEW.project_id)
        OR         (NEW.carrier_entity_id IS NOT NULL AND (SELECT project_id FROM canon_entities WHERE id=NEW.carrier_entity_id)<>NEW.project_id)
        OR         (NEW.event_id IS NOT NULL AND (SELECT project_id FROM timeline_events WHERE id=NEW.event_id)<>NEW.project_id)
        OR         (NEW.fact_id IS NOT NULL AND (SELECT project_id FROM canon_facts WHERE id=NEW.fact_id)<>NEW.project_id);
    END;
  `,
} as const;
