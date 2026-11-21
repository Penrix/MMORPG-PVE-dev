/**
 * Project identity is NOT (name,type). A single novel may contain people
 * named alike in Naruto, One Piece, an alternate era and a separate branch.
 *
 * Preserve all existing native Canon rowids, FTS references, FK references,
 * legacy unscoped uniqueness and project write guards. Only explicitly scoped
 * entities may repeat a display name across distinct project spaces.
 */
export const migration052 = {
  version: 52,
  name: "canon-entity-world-scoped-display-names",
  foreignKeysOff: true,
  sql: `
    -- This is a rebuild of one heavily referenced table. SQLite's normal
    -- ALTER TABLE rename validator rejects OTHER tables' existing triggers
    -- while the old table name is briefly absent. Legacy mode keeps their
    -- textual SQL untouched; the new table is restored under the same name.
    -- The FK checker still runs before committing this migration.
    PRAGMA legacy_alter_table = ON;
    -- SQLite validates existing VIEW SQL during ALTER TABLE RENAME.
    -- Temporarily remove the 047 projection while canon_entities is rebuilt.
    DROP VIEW IF EXISTS world_organization_dossier_index;
    DROP TRIGGER IF EXISTS canon_entities_fts_insert;
    DROP TRIGGER IF EXISTS canon_entities_fts_delete;
    DROP TRIGGER IF EXISTS canon_entities_fts_update;
    DROP TABLE canon_entities_fts;

    CREATE TABLE canon_entities_scoped (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN (
        'character','location','organization','item','rule','concept'
      )),
      name TEXT NOT NULL,
      world_scope_id TEXT NOT NULL DEFAULT '',
      aliases_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(aliases_json)),
      description TEXT,
      attributes_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(attributes_json)),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id,world_scope_id,type,name)
    ) STRICT;
    INSERT INTO canon_entities_scoped(
      rowid,id,project_id,type,name,world_scope_id,aliases_json,
      description,attributes_json,status,created_at,updated_at
    ) SELECT rowid,id,project_id,type,name,'',aliases_json,
        description,attributes_json,status,created_at,updated_at
      FROM canon_entities;

    -- Foreign keys must be disabled AROUND this rebuild by migrate().
    -- The old table is dropped directly rather than renamed first so
    -- dependent FKs retain canon_entities as their referenced table.
    DROP TABLE canon_entities;
    ALTER TABLE canon_entities_scoped RENAME TO canon_entities;

    CREATE INDEX canon_entities_project_type_idx
      ON canon_entities(project_id,type,status,name);
    CREATE INDEX canon_entities_project_scope_idx
      ON canon_entities(project_id,world_scope_id,type,name);

    CREATE VIRTUAL TABLE canon_entities_fts USING fts5(
      name,aliases,description,
      content='canon_entities',content_rowid='rowid',tokenize='trigram'
    );
    -- Legacy FTS exposes an 'aliases' search column while the actual Canon
    -- table stores aliases_json. FTS5's built-in REBUILD tries to read
    -- canon_entities.aliases and therefore fails. Reindex by explicit rows.
    INSERT INTO canon_entities_fts(rowid,name,aliases,description)
      SELECT rowid,name,aliases_json,COALESCE(description,'')
      FROM canon_entities;
    CREATE TRIGGER canon_entities_fts_insert AFTER INSERT ON canon_entities BEGIN
      INSERT INTO canon_entities_fts(rowid,name,aliases,description)
      VALUES(new.rowid,new.name,new.aliases_json,COALESCE(new.description,''));
    END;
    CREATE TRIGGER canon_entities_fts_delete AFTER DELETE ON canon_entities BEGIN
      INSERT INTO canon_entities_fts(
        canon_entities_fts,rowid,name,aliases,description
      ) VALUES('delete',old.rowid,old.name,old.aliases_json,
        COALESCE(old.description,''));
    END;
    CREATE TRIGGER canon_entities_fts_update AFTER UPDATE ON canon_entities BEGIN
      INSERT INTO canon_entities_fts(
        canon_entities_fts,rowid,name,aliases,description
      ) VALUES('delete',old.rowid,old.name,old.aliases_json,
        COALESCE(old.description,''));
      INSERT INTO canon_entities_fts(rowid,name,aliases,description)
      VALUES(new.rowid,new.name,new.aliases_json,COALESCE(new.description,''));
    END;

    -- Rebuilding a table drops table-specific guards introduced in 040.
    CREATE TRIGGER "canon-entities-project-write-guard-insert"
    BEFORE INSERT ON canon_entities BEGIN
      SELECT RAISE(ABORT,'project.not_found') WHERE EXISTS (
        SELECT 1 FROM projects
        WHERE id=NEW.project_id AND deleted_at IS NOT NULL
      );
    END;
    CREATE TRIGGER "canon-entities-project-write-guard-update"
    BEFORE UPDATE ON canon_entities BEGIN
      SELECT RAISE(ABORT,'project.not_found') WHERE EXISTS (
        SELECT 1 FROM projects
        WHERE id=NEW.project_id AND deleted_at IS NOT NULL
      );
    END;

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

    CREATE TRIGGER canon_entities_world_scope_insert
    BEFORE INSERT ON canon_entities BEGIN
      SELECT RAISE(ABORT,'world.scope_not_found') WHERE
        NEW.world_scope_id<>'' AND NOT EXISTS (
          SELECT 1 FROM project_world_spaces scope
          WHERE scope.id=NEW.world_scope_id
            AND scope.project_id=NEW.project_id
        );
    END;
    CREATE TRIGGER canon_entities_world_scope_update
    BEFORE UPDATE OF world_scope_id,project_id ON canon_entities BEGIN
      SELECT RAISE(ABORT,'world.scope_not_found') WHERE
        NEW.world_scope_id<>'' AND NOT EXISTS (
          SELECT 1 FROM project_world_spaces scope
          WHERE scope.id=NEW.world_scope_id
            AND scope.project_id=NEW.project_id
        );
    END;
    PRAGMA legacy_alter_table = OFF;
  `,
} as const;
