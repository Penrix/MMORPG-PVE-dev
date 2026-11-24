import {
  SourceWorldProductionDraftSchema,
  WorldPackDocumentSchema,
  WorldPackRequestSchema,
  type SourceWorldProductionDraft,
  type WorldPackDocument,
  type WorldPackRequest,
} from "@narralume/contracts";
import type { NarrativeDatabase } from "./database.js";

interface SourceWorldProductionRow {
  id: string;
  world_id: string;
  request_id: string;
  status: "draft" | "adopted";
  version: number;
  request_json: string;
  document_json: string;
  adopted_keys_json: string;
  created_at: string;
  updated_at: string;
}

function decode(row: SourceWorldProductionRow): SourceWorldProductionDraft {
  return SourceWorldProductionDraftSchema.parse({
    id: row.id,
    worldId: row.world_id,
    requestId: row.request_id,
    status: row.status,
    version: row.version,
    request: JSON.parse(row.request_json),
    document: JSON.parse(row.document_json),
    adoptedKeys: JSON.parse(row.adopted_keys_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SqliteSourceWorldProductionRepository {
  constructor(private readonly db: NarrativeDatabase) {}

  list(worldId: string): SourceWorldProductionDraft[] {
    const rows = this.db.raw
      .prepare(
        "SELECT * FROM source_world_production_drafts WHERE world_id=? ORDER BY created_at DESC,id DESC",
      )
      .all(worldId) as unknown as SourceWorldProductionRow[];
    return rows.map(decode);
  }

  get(worldId: string, id: string): SourceWorldProductionDraft | null {
    const row = this.db.raw
      .prepare(
        "SELECT * FROM source_world_production_drafts WHERE world_id=? AND id=?",
      )
      .get(worldId, id) as SourceWorldProductionRow | undefined;
    return row ? decode(row) : null;
  }

  byRequest(
    worldId: string,
    requestId: string,
  ): SourceWorldProductionDraft | null {
    const row = this.db.raw
      .prepare(
        "SELECT * FROM source_world_production_drafts WHERE world_id=? AND request_id=?",
      )
      .get(worldId, requestId) as SourceWorldProductionRow | undefined;
    return row ? decode(row) : null;
  }

  insert(input: {
    id: string;
    worldId: string;
    request: WorldPackRequest;
    document: WorldPackDocument;
    now: string;
  }): SourceWorldProductionDraft {
    const request = WorldPackRequestSchema.parse(input.request);
    const document = WorldPackDocumentSchema.parse(input.document);
    this.db.raw
      .prepare(
        `INSERT INTO source_world_production_drafts(
          id,world_id,request_id,status,version,request_json,document_json,
          adopted_keys_json,created_at,updated_at
        ) VALUES (?,?,?,'draft',1,?,?,'{}',?,?)
        ON CONFLICT(world_id,request_id) DO NOTHING`,
      )
      .run(
        input.id,
        input.worldId,
        request.requestId,
        JSON.stringify(request),
        JSON.stringify(document),
        input.now,
        input.now,
      );
    return this.byRequest(input.worldId, request.requestId)!;
  }

  revise(input: {
    worldId: string;
    id: string;
    expectedVersion: number;
    document: WorldPackDocument;
    now: string;
  }): SourceWorldProductionDraft {
    const result = this.db.raw
      .prepare(
        `UPDATE source_world_production_drafts
         SET document_json=?,version=version+1,updated_at=?
         WHERE world_id=? AND id=? AND status='draft' AND version=?`,
      )
      .run(
        JSON.stringify(WorldPackDocumentSchema.parse(input.document)),
        input.now,
        input.worldId,
        input.id,
        input.expectedVersion,
      );
    if (result.changes !== 1)
      throw new SourceWorldProductionVersionError(
        "source.world.production.stale",
        "Source World production draft is missing, adopted, or has changed",
      );
    return this.get(input.worldId, input.id)!;
  }

  markAdopted(
    worldId: string,
    id: string,
    expectedVersion: number,
    adoptedKeys: Record<string, string>,
    now: string,
  ): SourceWorldProductionDraft {
    const result = this.db.raw
      .prepare(
        `UPDATE source_world_production_drafts
         SET status='adopted',version=version+1,adopted_keys_json=?,updated_at=?
         WHERE world_id=? AND id=? AND status='draft' AND version=?`,
      )
      .run(
        JSON.stringify(adoptedKeys),
        now,
        worldId,
        id,
        expectedVersion,
      );
    if (result.changes !== 1)
      throw new SourceWorldProductionVersionError(
        "source.world.production.stale",
        "Source World production adoption requires the latest draft version",
      );
    return this.get(worldId, id)!;
  }
}

export class SourceWorldProductionVersionError extends Error {
  readonly statusCode = 409;
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SourceWorldProductionVersionError";
  }
}
