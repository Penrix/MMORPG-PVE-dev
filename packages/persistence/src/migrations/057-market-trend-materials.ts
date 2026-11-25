/**
 * Global M03 high-weight market trend materials distilled from male newbook
 * rankings via TR-I-01 analysis. Stored outside per-project text_segments so
 * pre-project ideation (benchmark incubation, TR-02 combination, and slot
 * machine) can draw on fresh market trends before any project exists, and
 * newly created projects can automatically inherit them as active M03 cards.
 */
export const migration057 = {
  version: 57,
  name: "market-trend-materials",
  sql: `
    CREATE TABLE market_trend_materials (
      id TEXT PRIMARY KEY,
      material_type TEXT NOT NULL CHECK(length(trim(material_type)) > 0),
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      summary TEXT NOT NULL CHECK(length(trim(summary)) > 0),
      tags_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags_json)),
      evidence_titles_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(evidence_titles_json)),
      trend_weight REAL NOT NULL DEFAULT 1.5 CHECK(trend_weight > 0),
      market_window TEXT NOT NULL DEFAULT 'recent',
      platform TEXT NOT NULL DEFAULT 'all',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX market_trend_materials_status_idx
      ON market_trend_materials(status, trend_weight DESC, updated_at DESC);
  `,
};
