/**
 * Migration 052 rebuilt canon_entities with aliases_json while accidentally
 * recreating the external-content FTS table with a virtual column named
 * "aliases". FTS5 resolves external content columns against canon_entities,
 * so any read that materializes the FTS row tries to access T.aliases and
 * fails because the real column is aliases_json.
 *
 * Repair existing databases instead of mutating migration 052: old and new
 * installations converge through this migration.
 */
export const migration055 = {
  version: 55,
  name: "repair-scoped-canon-fts-content-columns",
  sql: `
    DROP TRIGGER IF EXISTS canon_entities_fts_insert;
    DROP TRIGGER IF EXISTS canon_entities_fts_delete;
    DROP TRIGGER IF EXISTS canon_entities_fts_update;
    DROP TABLE IF EXISTS canon_entities_fts;

    CREATE VIRTUAL TABLE canon_entities_fts USING fts5(
      name,aliases_json,description,
      content='canon_entities',content_rowid='rowid',tokenize='trigram'
    );

    INSERT INTO canon_entities_fts(rowid,name,aliases_json,description)
      SELECT rowid,name,aliases_json,COALESCE(description,'')
      FROM canon_entities;

    CREATE TRIGGER canon_entities_fts_insert AFTER INSERT ON canon_entities BEGIN
      INSERT INTO canon_entities_fts(rowid,name,aliases_json,description)
      VALUES(new.rowid,new.name,new.aliases_json,COALESCE(new.description,''));
    END;

    CREATE TRIGGER canon_entities_fts_delete AFTER DELETE ON canon_entities BEGIN
      INSERT INTO canon_entities_fts(
        canon_entities_fts,rowid,name,aliases_json,description
      ) VALUES(
        'delete',old.rowid,old.name,old.aliases_json,COALESCE(old.description,'')
      );
    END;

    CREATE TRIGGER canon_entities_fts_update AFTER UPDATE ON canon_entities BEGIN
      INSERT INTO canon_entities_fts(
        canon_entities_fts,rowid,name,aliases_json,description
      ) VALUES(
        'delete',old.rowid,old.name,old.aliases_json,COALESCE(old.description,'')
      );
      INSERT INTO canon_entities_fts(rowid,name,aliases_json,description)
      VALUES(new.rowid,new.name,new.aliases_json,COALESCE(new.description,''));
    END;
  `,
} as const;
