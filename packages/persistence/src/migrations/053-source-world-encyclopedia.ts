/**
 * Original/historical mother-world encyclopedia is independently queryable.
 * It is NOT the Project Canon; reference assertions have evidence and source
 * time, never story-settlement authority. All source-world IDs are composite
 * (corpus_id,source_key), preventing IP/era cross contamination.
 */
export const migration053 = {
  version: 53,
  name: "source-world-professional-encyclopedia",
  sql: `
    -- Preserve stable source identities and curated details across reimports.
    -- Inactive means absent from the latest upstream snapshot, not erased.
    CREATE TABLE source_record_presence (
      corpus_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY(corpus_id,source_key),
      FOREIGN KEY(corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX source_record_presence_active_idx
      ON source_record_presence(corpus_id,active);
    -- Upgrade existing source records without changing their imported IDs.
    INSERT INTO source_record_presence(corpus_id,source_key,active,last_seen_at)
      SELECT corpus_id,source_key,1,imported_at FROM source_records;

    -- Complete prose belongs to the reference object, not to a novel.
    CREATE TABLE source_world_lore_sections (
      corpus_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      section_key TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL CHECK(length(trim(content))>0),
      source_url TEXT NOT NULL DEFAULT '',
      source_pointer TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY(corpus_id,source_key,section_key),
      FOREIGN KEY(corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;

    -- Global source history; NOT project-native timeline_events.
    CREATE TABLE source_world_chronicle (
      corpus_id TEXT NOT NULL REFERENCES source_corpora(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      title TEXT NOT NULL,
      world_time TEXT NOT NULL DEFAULT '',
      sequence INTEGER,
      description TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      source_pointer TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY(corpus_id,event_key)
    ) WITHOUT ROWID;
    CREATE INDEX source_world_chronicle_order_idx
      ON source_world_chronicle(corpus_id,sequence,world_time);

    CREATE TABLE source_world_chronicle_subjects (
      corpus_id TEXT NOT NULL,
      event_key TEXT NOT NULL,
      source_key TEXT NOT NULL,
      role TEXT NOT NULL CHECK(length(trim(role))>0),
      consequence TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(corpus_id,event_key,source_key,role),
      FOREIGN KEY(corpus_id,event_key)
        REFERENCES source_world_chronicle(corpus_id,event_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX source_world_subject_chronicle_idx
      ON source_world_chronicle_subjects(corpus_id,source_key,event_key);

    -- Queryable sourced assertions with explicit target/reference and era.
    -- No assumption that a character's full-life history holds at every age.
    CREATE TABLE source_world_claims (
      id TEXT PRIMARY KEY,
      corpus_id TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      predicate TEXT NOT NULL CHECK(length(trim(predicate))>0),
      object_key TEXT,
      value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
      world_time_from TEXT NOT NULL DEFAULT '',
      world_time_to TEXT NOT NULL DEFAULT '',
      assertion TEXT NOT NULL DEFAULT 'recorded' CHECK(assertion IN (
        'recorded','disputed','uncertain','inferred'
      )),
      source_url TEXT NOT NULL DEFAULT '',
      source_pointer TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      CHECK((object_key IS NOT NULL) != (value_json IS NOT NULL)),
      FOREIGN KEY(corpus_id,subject_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,object_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX source_world_claim_subject_idx
      ON source_world_claims(corpus_id,subject_key,predicate);
    CREATE INDEX source_world_claim_object_idx
      ON source_world_claims(corpus_id,object_key,predicate);

    CREATE TABLE source_world_organization_profiles (
      corpus_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      organization_form TEXT NOT NULL DEFAULT '',
      governance TEXT NOT NULL DEFAULT '',
      succession TEXT NOT NULL DEFAULT '',
      duties TEXT NOT NULL DEFAULT '',
      jurisdiction TEXT NOT NULL DEFAULT '',
      assets_and_income TEXT NOT NULL DEFAULT '',
      internal_factions TEXT NOT NULL DEFAULT '',
      ordinary_life TEXT NOT NULL DEFAULT '',
      era TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY(corpus_id,source_key),
      FOREIGN KEY(corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;

    -- Both ordinary institutional power and supernatural systems.
    -- An empty countermeasure/limitation is allowed: never invent weakness.
    CREATE TABLE source_world_capability_profiles (
      corpus_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      power_mode TEXT NOT NULL CHECK(power_mode IN ('ordinary','supernatural')),
      mechanism TEXT NOT NULL DEFAULT '',
      actual_effects TEXT NOT NULL DEFAULT '',
      acquisition TEXT NOT NULL DEFAULT '',
      progression TEXT NOT NULL DEFAULT '',
      combinations TEXT NOT NULL DEFAULT '',
      constraints TEXT NOT NULL DEFAULT '',
      counters TEXT NOT NULL DEFAULT '',
      social_value TEXT NOT NULL DEFAULT '',
      era TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY(corpus_id,source_key),
      FOREIGN KEY(corpus_id,source_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;

    CREATE TABLE source_world_map_edges (
      id TEXT PRIMARY KEY,
      corpus_id TEXT NOT NULL,
      from_key TEXT NOT NULL,
      to_key TEXT NOT NULL,
      layer TEXT NOT NULL CHECK(layer IN (
        'physical','control','social','information'
      )),
      relation TEXT NOT NULL CHECK(length(trim(relation))>0),
      intermediary_key TEXT,
      access_conditions TEXT NOT NULL DEFAULT '',
      world_time TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(corpus_id,from_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,to_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,intermediary_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX source_world_map_subject_idx
      ON source_world_map_edges(corpus_id,from_key,layer);
    CREATE INDEX source_world_map_target_idx
      ON source_world_map_edges(corpus_id,to_key,layer);

    -- A reputation is another actor's assessment, not one global score.
    CREATE TABLE source_world_social_standings (
      id TEXT PRIMARY KEY,
      corpus_id TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      evaluator_key TEXT NOT NULL,
      dimension TEXT NOT NULL CHECK(length(trim(dimension))>0),
      assessment TEXT NOT NULL,
      world_time TEXT NOT NULL DEFAULT '',
      evidence_event_key TEXT,
      actual_response TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(corpus_id,subject_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,evaluator_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,evidence_event_key)
        REFERENCES source_world_chronicle(corpus_id,event_key)
    ) STRICT;
    CREATE INDEX source_world_standing_subject_idx
      ON source_world_social_standings(corpus_id,subject_key,dimension);

    CREATE TABLE source_world_resource_flows (
      id TEXT PRIMARY KEY,
      corpus_id TEXT NOT NULL,
      input_key TEXT,
      output_key TEXT NOT NULL,
      operator_key TEXT,
      site_key TEXT,
      process_kind TEXT NOT NULL CHECK(process_kind IN (
        'extract','train','produce','transform','transport','trade',
        'consume','repair','distribute','other'
      )),
      process TEXT NOT NULL CHECK(length(trim(process))>0),
      prerequisites TEXT NOT NULL DEFAULT '',
      world_time TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(corpus_id,input_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,output_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,operator_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,site_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX source_world_resource_subject_idx
      ON source_world_resource_flows(corpus_id,output_key,process_kind);

    -- High-price people/abilities/assets exist independently of any hero.
    CREATE TABLE source_world_value_appraisals (
      id TEXT PRIMARY KEY,
      corpus_id TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      evaluator_key TEXT,
      value_kind TEXT NOT NULL CHECK(value_kind IN (
        'person','ability','asset','office','territory','access','relationship',
        'opportunity','other'
      )),
      value_basis TEXT NOT NULL CHECK(length(trim(value_basis))>0),
      scarcity TEXT NOT NULL DEFAULT '',
      world_time TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(corpus_id,subject_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,evaluator_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX source_world_value_subject_idx
      ON source_world_value_appraisals(corpus_id,subject_key,value_kind);
  `,
} as const;
