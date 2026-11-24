/**
 * Module-2 global Creative Material Library (M03 + future libraries).
 *
 * Stores all reusable creative material cards (both semantically curated and
 * coarse/raw historical cards, plus high-weight TR-01 market trend cards) at
 * the global Module-2 substrate level with Chinese trigram FTS5 search and a
 * dedicated embedding table for hybrid lexical + vector recall.
 */
export const migration058 = {
  version: 58,
  name: "global-creative-material-library",
  sql: `
    CREATE TABLE creative_material_library (
      row_id INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      library_id TEXT NOT NULL DEFAULT 'M03',
      material_id TEXT NOT NULL,
      material_type TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'candidate', 'merged', 'retired')),
      curation_tier TEXT NOT NULL DEFAULT 'coarse'
        CHECK(curation_tier IN ('curated', 'coarse', 'market_trend')),
      curation_stage TEXT,
      trend_weight REAL NOT NULL DEFAULT 1.0 CHECK(trend_weight > 0),
      call_when_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(call_when_json)),
      tags_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags_json)),
      source_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(library_id, material_id)
    );

    CREATE INDEX creative_material_library_filter_idx
      ON creative_material_library(library_id, status, curation_tier, material_type, trend_weight DESC);

    CREATE VIRTUAL TABLE creative_material_library_fts USING fts5(
      name,
      summary,
      content,
      tags_json,
      content='creative_material_library',
      content_rowid='row_id',
      tokenize='trigram'
    );

    CREATE TRIGGER creative_material_library_fts_insert
    AFTER INSERT ON creative_material_library BEGIN
      INSERT INTO creative_material_library_fts(rowid, name, summary, content, tags_json)
      VALUES (new.row_id, new.name, new.summary, new.content, new.tags_json);
    END;

    CREATE TRIGGER creative_material_library_fts_delete
    AFTER DELETE ON creative_material_library BEGIN
      INSERT INTO creative_material_library_fts(creative_material_library_fts, rowid, name, summary, content, tags_json)
      VALUES ('delete', old.row_id, old.name, old.summary, old.content, old.tags_json);
    END;

    CREATE TRIGGER creative_material_library_fts_update
    AFTER UPDATE ON creative_material_library BEGIN
      INSERT INTO creative_material_library_fts(creative_material_library_fts, rowid, name, summary, content, tags_json)
      VALUES ('delete', old.row_id, old.name, old.summary, old.content, old.tags_json);
      INSERT INTO creative_material_library_fts(rowid, name, summary, content, tags_json)
      VALUES (new.row_id, new.name, new.summary, new.content, new.tags_json);
    END;

    CREATE TABLE creative_material_embeddings (
      material_id TEXT NOT NULL REFERENCES creative_material_library(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL CHECK(dimensions > 0),
      embedding_json TEXT NOT NULL CHECK(json_valid(embedding_json)),
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(material_id, model)
    ) STRICT;
  `,
};
