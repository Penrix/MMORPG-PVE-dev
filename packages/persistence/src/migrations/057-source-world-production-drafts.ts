/**
 * Source World production drafts are deliberately separate from Project
 * WorldPack drafts. A mother-world reference is not a fake novel Project and
 * generated candidates do not become Source truth until explicit adoption.
 */
export const migration057 = {
  version: 57,
  name: "source-world-production-drafts",
  sql: `
    CREATE TABLE source_world_production_drafts (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES source_worlds(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','adopted')),
      version INTEGER NOT NULL CHECK(version > 0),
      request_json TEXT NOT NULL CHECK(json_valid(request_json)),
      document_json TEXT NOT NULL CHECK(json_valid(document_json)),
      adopted_keys_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(adopted_keys_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, request_id)
    ) STRICT;
    CREATE INDEX source_world_production_world_idx
      ON source_world_production_drafts(world_id, created_at DESC, id);
  `,
} as const;
