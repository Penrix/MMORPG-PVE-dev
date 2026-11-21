/**
 * World database extension v0.1-v0.7, first slice: an entity-centred *world*,
 * not one shallow info card per organization.
 *
 * NO SECOND CANON. Entities, relationships, facts, timeline and lore remain
 * in NarraLume. These tables store typed and traceable INDEXES / FACETS that
 * refer to those pre-existing identities and their chronology.
 *
 * Working sources: world-v02 §§3.01-3.10, 4.1-4.3;
 * world-v05 §H; world-v06 §§2-4,12; world-v07 §12.
 */
export const migration047 = {
  version: 47,
  name: "world-database-crosswalk",
  sql: `
    -- Rich existing Lorebook prose can now explicitly belong to a world
    -- entity and a named facet, instead of being merely keyword-triggered.
    CREATE TABLE world_lore_bindings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      lore_entry_id TEXT NOT NULL REFERENCES lore_entries(id) ON DELETE CASCADE,
      facet TEXT NOT NULL CHECK(length(trim(facet)) > 0),
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(project_id, entity_id, lore_entry_id, facet)
    ) STRICT;
    CREATE INDEX world_lore_subject_idx
      ON world_lore_bindings(project_id, entity_id, facet);

    -- A clan's chronicle is a VIEW ON established timeline events. The same
    -- battle/decision is never duplicated into a disconnected clan history.
    CREATE TABLE world_chronicle_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      timeline_event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
      relevance TEXT NOT NULL CHECK(length(trim(relevance)) > 0),
      consequence TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(project_id, entity_id, timeline_event_id, relevance)
    ) STRICT;
    CREATE INDEX world_chronicle_subject_idx
      ON world_chronicle_links(project_id, entity_id, timeline_event_id);

    -- Distinguish formal organization, faction, temporary alliance, clan
    -- network and social field (v0.2 §3.02). Never flatten them to one camp.
    CREATE TABLE world_organization_profiles (
      organization_id TEXT PRIMARY KEY REFERENCES canon_entities(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      social_kind TEXT NOT NULL CHECK(social_kind IN (
        'formal_organization','faction','alliance','clan_network','social_field'
      )),
      governance TEXT NOT NULL DEFAULT '',
      membership TEXT NOT NULL DEFAULT '',
      succession TEXT NOT NULL DEFAULT '',
      funding TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      current_agenda TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_org_profile_project_idx
      ON world_organization_profiles(project_id, social_kind);

    -- Whose actual job and signature can move this organization? A clan
    -- council, militia and police corps can have distinct jurisdictions.
    CREATE TABLE world_organization_functions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      unit_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      officeholder_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      jurisdiction_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      resource_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      function_name TEXT NOT NULL CHECK(length(trim(function_name)) > 0),
      responsibility TEXT NOT NULL DEFAULT '',
      decision_right TEXT NOT NULL DEFAULT '',
      real_process TEXT NOT NULL DEFAULT '',
      valid_from_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      valid_to_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_org_function_subject_idx
      ON world_organization_functions(project_id, organization_id, function_name);

    -- A stance is an actor's *position on an issue*, not a universal
    -- faction-alignment score. It may differ from its public reputation.
    CREATE TABLE world_stances (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      actor_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      issue_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      target_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      stance TEXT NOT NULL CHECK(length(trim(stance)) > 0),
      interest TEXT NOT NULL DEFAULT '',
      intended_action TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'author_secret'
        CHECK(visibility IN ('public','private','author_secret')),
      valid_from_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      valid_to_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      evidence_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_stance_actor_idx
      ON world_stances(project_id, actor_entity_id, issue_entity_id);

    -- Reputation belongs to an evaluator, dimension and historical moment.
    -- Standing is NOT legal clearance, asset ownership or global favor 100.
    CREATE TABLE world_standings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      subject_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      evaluator_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      dimension TEXT NOT NULL CHECK(length(trim(dimension)) > 0),
      assessment TEXT NOT NULL CHECK(length(trim(assessment)) > 0),
      evidence_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      intermediary_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      actual_response TEXT NOT NULL DEFAULT '',
      actual_right_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      world_time TEXT,
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_standing_subject_idx
      ON world_standings(project_id, subject_entity_id, evaluator_entity_id, dimension);

    -- A power-holder may reach a resource through a *different* actual
    -- mediator; this is not a relationship edge that grants global access.
    CREATE TABLE world_power_channels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      holder_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      intermediary_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      authority_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      target_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      jurisdiction_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      real_action TEXT NOT NULL CHECK(length(trim(real_action)) > 0),
      prerequisites TEXT NOT NULL DEFAULT '',
      cannot_grant TEXT NOT NULL DEFAULT '',
      evidence_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_power_holder_idx
      ON world_power_channels(project_id, holder_entity_id, target_entity_id);

    -- An expensive person, technique, office or possession can be valued by
    -- different stakeholders. Potential importance does NOT mean the hero
    -- owns it, has recruited that person, or obtained its authority.
    CREATE TABLE world_value_appraisals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      subject_entity_id TEXT NOT NULL REFERENCES canon_entities(id) ON DELETE CASCADE,
      evaluator_entity_id TEXT REFERENCES canon_entities(id) ON DELETE SET NULL,
      value_kind TEXT NOT NULL CHECK(value_kind IN (
        'person','ability','asset','office','territory','access','relationship','opportunity','other'
      )),
      value_basis TEXT NOT NULL CHECK(length(trim(value_basis)) > 0),
      scarcity TEXT NOT NULL DEFAULT '',
      access_path TEXT NOT NULL DEFAULT '',
      future_use TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'potential'
        CHECK(status IN ('potential','contested','available','realized','retired')),
      realization_event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown' CHECK(source_type IN (
        'original_work','historical_record','author_design','inferred','simulation','unknown'
      )),
      source_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      CHECK(status != 'realized' OR realization_event_id IS NOT NULL)
    ) STRICT;
    CREATE INDEX world_value_subject_idx
      ON world_value_appraisals(project_id, subject_entity_id, status);

    -- Queryable basis for an exhaustive entity dossier. All rows are joined
    -- to existing Canon identities; none is an independent "world truth".
    CREATE VIEW world_organization_dossier_index AS
      SELECT e.project_id AS project_id, e.id AS entity_id, e.name AS name,
             p.social_kind AS social_kind, p.governance AS governance,
             (SELECT COUNT(*) FROM world_organization_functions f
               WHERE f.organization_id=e.id) AS function_count,
             (SELECT COUNT(*) FROM world_chronicle_links c
               WHERE c.entity_id=e.id) AS chronicle_count,
             (SELECT COUNT(*) FROM world_lore_bindings l
               WHERE l.entity_id=e.id) AS lore_section_count,
             (SELECT COUNT(*) FROM world_stances s
               WHERE s.actor_entity_id=e.id) AS stance_count,
             (SELECT COUNT(*) FROM world_standings s
               WHERE s.subject_entity_id=e.id) AS standing_count,
             (SELECT COUNT(*) FROM world_value_appraisals v
               WHERE v.subject_entity_id=e.id OR v.evaluator_entity_id=e.id
             ) AS value_count,
             (SELECT COUNT(*) FROM world_power_channels pc
               WHERE pc.holder_entity_id=e.id OR pc.target_entity_id=e.id
                  OR pc.intermediary_entity_id=e.id
             ) AS power_channel_count
      FROM canon_entities e
      LEFT JOIN world_organization_profiles p ON p.organization_id=e.id
      WHERE e.type='organization';

    -- Core world links must remain inside the same project. The Canon
    -- tables supply identity; these guards prevent cross-novel leakage.
    CREATE TRIGGER world_lore_binding_project_guard
    BEFORE INSERT ON world_lore_bindings BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id
        OR (SELECT project_id FROM lorebooks WHERE id=
          (SELECT lorebook_id FROM lore_entries WHERE id=NEW.lore_entry_id))<>NEW.project_id;
    END;
    CREATE TRIGGER world_chronicle_project_guard
    BEFORE INSERT ON world_chronicle_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id
        OR (SELECT project_id FROM timeline_events WHERE id=NEW.timeline_event_id)<>NEW.project_id;
    END;
    CREATE TRIGGER world_profile_project_guard
    BEFORE INSERT ON world_organization_profiles BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.organization_id)<>NEW.project_id
        OR (SELECT type FROM canon_entities WHERE id=NEW.organization_id)<>'organization';
    END;
    CREATE TRIGGER world_org_function_project_guard
    BEFORE INSERT ON world_organization_functions BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.organization_id)<>NEW.project_id
        OR (SELECT type FROM canon_entities WHERE id=NEW.organization_id)<>'organization'
        OR (NEW.officeholder_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.officeholder_entity_id)<>NEW.project_id)
        OR (NEW.unit_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.unit_entity_id)<>NEW.project_id)
        OR (NEW.jurisdiction_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.jurisdiction_entity_id)<>NEW.project_id)
        OR (NEW.resource_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.resource_entity_id)<>NEW.project_id)
        OR (NEW.valid_from_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_from_event_id)<>NEW.project_id)
        OR (NEW.valid_to_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_to_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_stance_project_guard
    BEFORE INSERT ON world_stances BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.actor_entity_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.issue_entity_id)<>NEW.project_id
        OR (NEW.target_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.target_entity_id)<>NEW.project_id)
        OR (NEW.valid_from_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_from_event_id)<>NEW.project_id)
        OR (NEW.valid_to_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_to_event_id)<>NEW.project_id)
        OR (NEW.evidence_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_standing_project_guard
    BEFORE INSERT ON world_standings BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.subject_entity_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.evaluator_entity_id)<>NEW.project_id
        OR (NEW.intermediary_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR (NEW.actual_right_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.actual_right_entity_id)<>NEW.project_id)
        OR (NEW.evidence_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_power_channel_project_guard
    BEFORE INSERT ON world_power_channels BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.holder_entity_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.target_entity_id)<>NEW.project_id
        OR (NEW.intermediary_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR (NEW.authority_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.authority_entity_id)<>NEW.project_id)
        OR (NEW.jurisdiction_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.jurisdiction_entity_id)<>NEW.project_id)
        OR (NEW.evidence_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_value_project_guard
    BEFORE INSERT ON world_value_appraisals BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.subject_entity_id)<>NEW.project_id
        OR (NEW.evaluator_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.evaluator_entity_id)<>NEW.project_id)
        OR (NEW.realization_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.realization_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_lore_binding_project_guard_update
    BEFORE UPDATE ON world_lore_bindings BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id
        OR (SELECT project_id FROM lorebooks WHERE id=
          (SELECT lorebook_id FROM lore_entries WHERE id=NEW.lore_entry_id))<>NEW.project_id;
    END;
    CREATE TRIGGER world_chronicle_project_guard_update
    BEFORE UPDATE ON world_chronicle_links BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.entity_id)<>NEW.project_id
        OR (SELECT project_id FROM timeline_events WHERE id=NEW.timeline_event_id)<>NEW.project_id;
    END;
    CREATE TRIGGER world_profile_project_guard_update
    BEFORE UPDATE ON world_organization_profiles BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.organization_id)<>NEW.project_id
        OR (SELECT type FROM canon_entities WHERE id=NEW.organization_id)<>'organization';
    END;
    CREATE TRIGGER world_org_function_project_guard_update
    BEFORE UPDATE ON world_organization_functions BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.organization_id)<>NEW.project_id
        OR (SELECT type FROM canon_entities WHERE id=NEW.organization_id)<>'organization'
        OR (NEW.officeholder_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.officeholder_entity_id)<>NEW.project_id)
        OR (NEW.unit_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.unit_entity_id)<>NEW.project_id)
        OR (NEW.jurisdiction_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.jurisdiction_entity_id)<>NEW.project_id)
        OR (NEW.resource_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.resource_entity_id)<>NEW.project_id)
        OR (NEW.valid_from_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_from_event_id)<>NEW.project_id)
        OR (NEW.valid_to_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_to_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_stance_project_guard_update
    BEFORE UPDATE ON world_stances BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.actor_entity_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.issue_entity_id)<>NEW.project_id
        OR (NEW.target_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.target_entity_id)<>NEW.project_id)
        OR (NEW.valid_from_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_from_event_id)<>NEW.project_id)
        OR (NEW.valid_to_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.valid_to_event_id)<>NEW.project_id)
        OR (NEW.evidence_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_standing_project_guard_update
    BEFORE UPDATE ON world_standings BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.subject_entity_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.evaluator_entity_id)<>NEW.project_id
        OR (NEW.intermediary_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR (NEW.actual_right_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.actual_right_entity_id)<>NEW.project_id)
        OR (NEW.evidence_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_power_channel_project_guard_update
    BEFORE UPDATE ON world_power_channels BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.holder_entity_id)<>NEW.project_id
        OR (SELECT project_id FROM canon_entities WHERE id=NEW.target_entity_id)<>NEW.project_id
        OR (NEW.intermediary_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.intermediary_entity_id)<>NEW.project_id)
        OR (NEW.authority_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.authority_entity_id)<>NEW.project_id)
        OR (NEW.jurisdiction_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.jurisdiction_entity_id)<>NEW.project_id)
        OR (NEW.evidence_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.evidence_event_id)<>NEW.project_id);
    END;
    CREATE TRIGGER world_value_project_guard_update
    BEFORE UPDATE ON world_value_appraisals BEGIN
      SELECT RAISE(ABORT,'world.project_mismatch') WHERE
        (SELECT project_id FROM canon_entities WHERE id=NEW.subject_entity_id)<>NEW.project_id
        OR (NEW.evaluator_entity_id IS NOT NULL AND
          (SELECT project_id FROM canon_entities WHERE id=NEW.evaluator_entity_id)<>NEW.project_id)
        OR (NEW.realization_event_id IS NOT NULL AND
          (SELECT project_id FROM timeline_events WHERE id=NEW.realization_event_id)<>NEW.project_id);
    END;
  `,
} as const;
