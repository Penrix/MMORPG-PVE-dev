import type { NarrativeDatabase } from "@narralume/persistence";
import { z } from "zod";
import type { RouteApp } from "./route-app.js";
import { ServiceError } from "./service-error.js";

const ListM03QuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.string().trim().max(40).optional(),
  tier: z.enum(["all", "curated", "coarse", "market_trend"]).default("all"),
  status: z
    .enum(["all", "active", "candidate", "merged", "retired"])
    .default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

interface LibraryRow {
  id: string;
  library_id: string;
  material_id: string;
  material_type: string;
  name: string;
  summary: string;
  content: string;
  status: string;
  curation_tier: string;
  curation_stage: string | null;
  trend_weight: number;
  call_when_json: string;
  tags_json: string;
  source_path: string;
  updated_at: string;
}

function parseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toDto(row: LibraryRow, includeContent: boolean) {
  return {
    id: row.id,
    libraryId: row.library_id,
    materialId: row.material_id,
    materialType: row.material_type,
    name: row.name,
    summary: row.summary,
    ...(includeContent ? { content: row.content } : {}),
    status: row.status,
    curationTier: row.curation_tier,
    curationStage: row.curation_stage,
    trendWeight: row.trend_weight,
    callWhen: parseArray(row.call_when_json),
    tags: parseArray(row.tags_json),
    sourcePath: row.source_path,
    updatedAt: row.updated_at,
  };
}

export function registerM03LibraryRoutes(
  app: RouteApp,
  database: NarrativeDatabase,
): void {
  app.route("GET", "/api/m03/stats", () => {
    const total = (
      database.raw
        .prepare("SELECT COUNT(*) AS count FROM creative_material_library")
        .get() as { count: number }
    ).count;
    const byTierRows = database.raw
      .prepare(
        "SELECT curation_tier AS key, COUNT(*) AS count FROM creative_material_library GROUP BY curation_tier",
      )
      .all() as Array<{ key: string; count: number }>;
    const byStatusRows = database.raw
      .prepare(
        "SELECT status AS key, COUNT(*) AS count FROM creative_material_library GROUP BY status",
      )
      .all() as Array<{ key: string; count: number }>;
    const byTypeRows = database.raw
      .prepare(
        "SELECT material_type AS key, COUNT(*) AS count FROM creative_material_library WHERE status IN ('active', 'candidate') GROUP BY material_type ORDER BY count DESC",
      )
      .all() as Array<{ key: string; count: number }>;
    const embeddingCount = (
      database.raw
        .prepare("SELECT COUNT(*) AS count FROM creative_material_embeddings")
        .get() as { count: number }
    ).count;

    return {
      total,
      embeddingCount,
      byTier: Object.fromEntries(byTierRows.map((r) => [r.key, r.count])),
      byStatus: Object.fromEntries(byStatusRows.map((r) => [r.key, r.count])),
      types: byTypeRows.map((r) => ({ type: r.key, count: r.count })),
    };
  });

  app.route("GET", "/api/m03/cards", (request) => {
    const query = ListM03QuerySchema.parse(request.query);
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.status !== "all") {
      clauses.push("m.status = ?");
      params.push(query.status);
    }
    if (query.tier !== "all") {
      clauses.push("m.curation_tier = ?");
      params.push(query.tier);
    }
    if (query.type) {
      clauses.push("m.material_type = ?");
      params.push(query.type);
    }

    const q = query.q?.trim() ?? "";
    let rows: LibraryRow[];
    let total: number;

    if (q.length >= 3) {
      const ftsQuery = `"${q.replace(/"/gu, '""')}"`;
      const whereSql = [
        "creative_material_library_fts MATCH ?",
        ...clauses,
      ].join(" AND ");
      total = (
        database.raw
          .prepare(
            `SELECT COUNT(*) AS count
               FROM creative_material_library_fts f
               JOIN creative_material_library m ON m.row_id = f.rowid
              WHERE ${whereSql}`,
          )
          .get(ftsQuery, ...params) as { count: number }
      ).count;
      rows = database.raw
        .prepare(
          `SELECT m.*
             FROM creative_material_library_fts f
             JOIN creative_material_library m ON m.row_id = f.rowid
            WHERE ${whereSql}
            ORDER BY m.trend_weight DESC, bm25(creative_material_library_fts)
            LIMIT ? OFFSET ?`,
        )
        .all(
          ftsQuery,
          ...params,
          query.limit,
          query.offset,
        ) as unknown as LibraryRow[];
    } else {
      if (q.length > 0) {
        const pattern = `%${q}%`;
        clauses.push(
          "(m.name LIKE ? OR m.summary LIKE ? OR m.tags_json LIKE ? OR m.content LIKE ?)",
        );
        params.push(pattern, pattern, pattern, pattern);
      }
      const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      total = (
        database.raw
          .prepare(
            `SELECT COUNT(*) AS count FROM creative_material_library m ${whereSql}`,
          )
          .get(...params) as { count: number }
      ).count;
      rows = database.raw
        .prepare(
          `SELECT m.*
             FROM creative_material_library m
            ${whereSql}
            ORDER BY m.trend_weight DESC, m.material_id ASC
            LIMIT ? OFFSET ?`,
        )
        .all(...params, query.limit, query.offset) as unknown as LibraryRow[];
    }

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      cards: rows.map((row) => toDto(row, false)),
    };
  });

  app.route("GET", "/api/m03/cards/:id", (request) => {
    const id = String(request.params.id ?? "").trim();
    const row = database.raw
      .prepare(
        "SELECT * FROM creative_material_library WHERE id = ? OR material_id = ? LIMIT 1",
      )
      .get(id, id) as LibraryRow | undefined;
    if (!row) {
      throw new ServiceError(
        "m03.card_not_found",
        `未找到 M03 卡片：${id}`,
        404,
      );
    }
    return toDto(row, true);
  });
}
