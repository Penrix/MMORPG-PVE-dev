/** WorldPack drafts are NOT a second Canon. Only adoption promotes items. */
export const migration046 = {
  version: 46,
  name: "mmorpg-world-pack-drafts",
  sql: `
    CREATE TABLE world_pack_drafts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('draft','adopted')),
      version INTEGER NOT NULL CHECK(version > 0),
      request_json TEXT NOT NULL CHECK(json_valid(request_json)),
      document_json TEXT NOT NULL CHECK(json_valid(document_json)),
      canon_ids_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(canon_ids_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX world_pack_drafts_project_idx
      ON world_pack_drafts(project_id, created_at DESC, id);
    CREATE TRIGGER world_pack_drafts_active_insert BEFORE INSERT ON world_pack_drafts
    BEGIN
      SELECT RAISE(ABORT,'project.not_found')
      WHERE EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND deleted_at IS NOT NULL);
    END;
    CREATE TRIGGER world_pack_drafts_active_update BEFORE UPDATE ON world_pack_drafts
    BEGIN
      SELECT RAISE(ABORT,'project.not_found')
      WHERE EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND deleted_at IS NOT NULL);
    END;
  `,
} as const;
