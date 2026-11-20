/**
 * An original-work SOURCE corpus lives in the very same NarraLume SQLite file,
 * but has no Project Reality authority. A novel can reference several corpora
 * while still having exactly one project Canon and one continuing protagonist.
 *
 * No copyrighted wiki/novel text is bundled with this migration.
 */
export const migration049 = {
  version: 49,
  name: "shared-source-corpora",
  sql: `
    CREATE TABLE source_corpora (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_url TEXT NOT NULL,
      rights_notice TEXT NOT NULL DEFAULT '',
      importer TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
      imported_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE source_records (
      corpus_id TEXT NOT NULL REFERENCES source_corpora(id) ON DELETE CASCADE,
      source_key TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN (
        'character','organization','location','ability','creature','item','event','other'
      )),
      name TEXT NOT NULL,
      aliases_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(aliases_json)),
      summary TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
      source_url TEXT NOT NULL DEFAULT '',
      origin_collection TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      PRIMARY KEY(corpus_id,source_key)
    ) WITHOUT ROWID;
    CREATE INDEX source_records_name_idx ON source_records(corpus_id,name,kind);
    CREATE INDEX source_records_kind_idx ON source_records(corpus_id,kind,name);

    -- All edges are source assertions, NOT events in a novel's Reality.
    CREATE TABLE source_relations (
      corpus_id TEXT NOT NULL REFERENCES source_corpora(id) ON DELETE CASCADE,
      from_key TEXT NOT NULL,
      to_key TEXT NOT NULL,
      relation TEXT NOT NULL,
      source_note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(corpus_id,from_key,to_key,relation),
      FOREIGN KEY(corpus_id,from_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE,
      FOREIGN KEY(corpus_id,to_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX source_relations_to_idx ON source_relations(corpus_id,to_key,relation);

    -- A single book may use Naruto, One Piece and several historical corpora.
    -- Binding grants reference visibility; it does NOT copy facts into Canon.
    CREATE TABLE project_source_bindings (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      corpus_id TEXT NOT NULL REFERENCES source_corpora(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      created_at TEXT NOT NULL,
      PRIMARY KEY(project_id,corpus_id)
    ) WITHOUT ROWID;
    CREATE INDEX project_source_bindings_corpus_idx
      ON project_source_bindings(corpus_id,project_id);
  `,
} as const;
