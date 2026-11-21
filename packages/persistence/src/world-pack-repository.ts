import {
  WorldPackDocumentSchema,
  WorldPackRecordSchema,
  WorldPackRequestSchema,
  type WorldPackDocument,
  type WorldPackRecord,
  type WorldPackRequest,
} from "@narralume/contracts";
import type { NarrativeDatabase } from "./database.js";

interface WorldPackRow {
  id: string;
  project_id: string;
  run_id: string;
  status: "draft" | "adopted";
  version: number;
  request_json: string;
  document_json: string;
  canon_ids_json: string;
  created_at: string;
  updated_at: string;
}

const decode = (row: WorldPackRow): WorldPackRecord =>
  WorldPackRecordSchema.parse({
    id: row.id,
    projectId: row.project_id,
    runId: row.run_id,
    status: row.status,
    version: row.version,
    request: JSON.parse(row.request_json),
    document: JSON.parse(row.document_json),
    canonIds: JSON.parse(row.canon_ids_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export class SqliteWorldPackRepository {
  constructor(private readonly database: NarrativeDatabase) {}

  list(projectId: string): WorldPackRecord[] {
    const rows = this.database.raw
      .prepare(
        "SELECT * FROM world_pack_drafts WHERE project_id=? ORDER BY created_at DESC, id DESC",
      )
      .all(projectId) as WorldPackRow[];
    return rows.map(decode);
  }

  get(projectId: string, id: string): WorldPackRecord | null {
    const row = this.database.raw
      .prepare("SELECT * FROM world_pack_drafts WHERE project_id=? AND id=?")
      .get(projectId, id) as WorldPackRow | undefined;
    return row ? decode(row) : null;
  }

  byRun(projectId: string, runId: string): WorldPackRecord | null {
    const row = this.database.raw
      .prepare(
        "SELECT * FROM world_pack_drafts WHERE project_id=? AND run_id=?",
      )
      .get(projectId, runId) as WorldPackRow | undefined;
    return row ? decode(row) : null;
  }

  /** Idempotent if the worker is retried after saving a draft. */
  insert(input: {
    id: string;
    projectId: string;
    runId: string;
    request: WorldPackRequest;
    document: WorldPackDocument;
    now: string;
  }): WorldPackRecord {
    this.database.raw
      .prepare(
        `
      INSERT INTO world_pack_drafts(
        id, project_id, run_id, status, version, request_json,
        document_json, canon_ids_json, created_at, updated_at
      ) VALUES (?,?,?,'draft',1,?,?,'{}',?,?)
      ON CONFLICT(id) DO NOTHING
    `,
      )
      .run(
        input.id,
        input.projectId,
        input.runId,
        JSON.stringify(WorldPackRequestSchema.parse(input.request)),
        JSON.stringify(WorldPackDocumentSchema.parse(input.document)),
        input.now,
        input.now,
      );
    return this.get(input.projectId, input.id)!;
  }

  revise(input: {
    projectId: string;
    id: string;
    expectedVersion: number;
    document: WorldPackDocument;
    now: string;
  }): WorldPackRecord {
    const result = this.database.raw
      .prepare(
        `
      UPDATE world_pack_drafts
      SET document_json=?, version=version+1, updated_at=?
      WHERE project_id=? AND id=? AND status='draft' AND version=?
    `,
      )
      .run(
        JSON.stringify(WorldPackDocumentSchema.parse(input.document)),
        input.now,
        input.projectId,
        input.id,
        input.expectedVersion,
      );
    if (result.changes !== 1)
      throw new WorldPackVersionError(
        "world_pack.stale",
        "WorldPack is missing, already adopted, or has changed",
      );
    return this.get(input.projectId, input.id)!;
  }

  markAdopted(
    projectId: string,
    id: string,
    expectedVersion: number,
    canonIds: Record<string, string>,
    now: string,
  ): WorldPackRecord {
    const result = this.database.raw
      .prepare(
        `
      UPDATE world_pack_drafts
      SET status='adopted', version=version+1,
          canon_ids_json=?, updated_at=?
      WHERE project_id=? AND id=? AND status='draft' AND version=?
    `,
      )
      .run(JSON.stringify(canonIds), now, projectId, id, expectedVersion);
    if (result.changes !== 1)
      throw new WorldPackVersionError(
        "world_pack.stale",
        "WorldPack adoption requires the latest draft version",
      );
    return this.get(projectId, id)!;
  }
}

export class WorldPackVersionError extends Error {
  readonly code: string;
  readonly statusCode = 409;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
