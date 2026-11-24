import type { WorldAtlasCognitiveMother } from "@narralume/contracts";
import type { NarrativeDatabase } from "./database.js";
import {
  SqliteSourceCorpusRepository,
  type SourceKind,
} from "./source-corpus-repository.js";
import {
  SqliteUnifiedSourceWorldRepository,
  type SourceWorld,
} from "./unified-source-world-repository.js";

export interface SourceWorldSeedRecord {
  sourceKey: string;
  canonicalKey: string | null;
  kind: SourceKind;
  name: string;
  aliases?: string[];
  summary?: string;
  raw: Record<string, unknown>;
  sourceUrl?: string;
  originCollection: string;
}

export interface SourceWorldSeedRelation {
  fromKey: string;
  toKey: string;
  relation: string;
  sourceNote: string;
}

export interface SourceWorldSeedCorpus {
  id: string;
  title: string;
  sourceUrl: string;
  rightsNotice: string;
  importer: string;
  metadata: Record<string, unknown>;
  evidenceRole:
    "primary" | "supporting" | "alternate_version" | "historical" | "other";
  sourceNote: string;
  records: SourceWorldSeedRecord[];
  relations: SourceWorldSeedRelation[];
}

export interface SourceWorldSeed {
  world: {
    id: string;
    name: string;
    kind: SourceWorld["kind"];
    canonicalCorpusId: string;
    canonicalTitle: string;
    description: string;
    cognitiveMother: WorldAtlasCognitiveMother;
  };
  corpora: SourceWorldSeedCorpus[];
}

export interface SourceWorldSeedInstallReport {
  worldId: string;
  canonicalCorpusId: string;
  evidenceCorpora: string[];
  evidenceRecords: number;
  evidenceRelations: number;
  createdCards: number;
  preservedCards: number;
  evidenceLinks: number;
  unresolvedRelations: number;
}

export function installSourceWorldSeed(
  db: NarrativeDatabase,
  seed: SourceWorldSeed,
  now = new Date().toISOString(),
): SourceWorldSeedInstallReport {
  const sources = new SqliteSourceCorpusRepository(db);
  const worlds = new SqliteUnifiedSourceWorldRepository(db);

  validateSeed(seed);

  return db.transaction(() => {
    for (const corpus of seed.corpora) {
      sources.upsertCorpus({
        id: corpus.id,
        title: corpus.title,
        sourceUrl: corpus.sourceUrl,
        rightsNotice: corpus.rightsNotice,
        importer: corpus.importer,
        metadata: corpus.metadata,
        importedAt: now,
      });
      sources.beginCorpusSnapshot(corpus.id);
      for (const record of corpus.records)
        sources.upsertRecord({
          corpusId: corpus.id,
          sourceKey: record.sourceKey,
          kind: record.kind,
          name: record.name,
          aliases: record.aliases ?? [],
          summary: record.summary ?? "",
          raw: record.raw,
          sourceUrl: record.sourceUrl ?? corpus.sourceUrl,
          originCollection: record.originCollection,
          importedAt: now,
        });
      for (const edge of corpus.relations)
        sources.upsertRelation({
          corpusId: corpus.id,
          fromKey: edge.fromKey,
          toKey: edge.toKey,
          relation: edge.relation,
          sourceNote: edge.sourceNote,
        });
    }

    if (!sources.getCorpus(seed.world.canonicalCorpusId))
      sources.upsertCorpus({
        id: seed.world.canonicalCorpusId,
        title: seed.world.canonicalTitle,
        sourceUrl: "",
        rightsNotice:
          "Curated local Source World projection. Raw evidence keeps its original provenance and rights notice.",
        importer: "source-world-seed-v1",
        metadata: {
          worldId: seed.world.id,
          seedPolicy:
            "Evidence records are projected by explicit canonicalKey only; same-name records are never auto-merged.",
        },
        importedAt: now,
      });

    const existingWorld = worlds.getWorld(seed.world.id);
    if (!existingWorld)
      worlds.createWorld({
        id: seed.world.id,
        name: seed.world.name,
        kind: seed.world.kind,
        canonicalCorpusId: seed.world.canonicalCorpusId,
        description: seed.world.description,
        createdAt: now,
      });
    else if (existingWorld.canonicalCorpusId !== seed.world.canonicalCorpusId)
      throw new Error("source.world.seed.canonical_corpus_conflict");

    for (const corpus of seed.corpora)
      worlds.addEvidenceCorpus({
        worldId: seed.world.id,
        corpusId: corpus.id,
        evidenceRole: corpus.evidenceRole,
        sourceNote: corpus.sourceNote,
      });

    if (!worlds.getCognitiveMother(seed.world.id))
      worlds.upsertCognitiveMother({
        worldId: seed.world.id,
        cognitiveMother: seed.world.cognitiveMother,
      });

    const canonicalName = new Map<string, string>();
    const projectionByEvidence = new Map<
      string,
      { canonicalKey: string; record: SourceWorldSeedRecord; corpusId: string }
    >();
    for (const corpus of seed.corpora)
      for (const record of corpus.records) {
        if (!record.canonicalKey) continue;
        const evidenceId = corpus.id + "|" + record.sourceKey;
        projectionByEvidence.set(evidenceId, {
          canonicalKey: record.canonicalKey,
          record,
          corpusId: corpus.id,
        });
        if (!canonicalName.has(record.canonicalKey))
          canonicalName.set(record.canonicalKey, record.name);
      }

    const created = new Set<string>();
    let preservedCards = 0;

    for (const projection of projectionByEvidence.values()) {
      const { canonicalKey, record, corpusId } = projection;
      const canonical = sources.getRecord(
        seed.world.canonicalCorpusId,
        canonicalKey,
      );
      if (canonical) {
        preservedCards += 1;
      } else {
        worlds.createCanonicalFromEvidence({
          worldId: seed.world.id,
          canonicalKey,
          evidenceCorpusId: corpusId,
          evidenceKey: record.sourceKey,
          name: record.name,
          kind: record.kind,
          now,
          sourceNote:
            "Exact adapter projection into the reusable Source World; upstream assertion remains provenance-aware evidence.",
        });
        created.add(canonicalKey);
      }
      worlds.linkEvidence({
        worldId: seed.world.id,
        canonicalKey,
        evidenceCorpusId: corpusId,
        evidenceKey: record.sourceKey,
        matchKind: "source_adaptation",
        reviewStatus: "verified",
        sourceNote:
          "Adapter supplied an explicit canonicalKey. This maps identity only and does not upgrade the evidence source to official canon.",
        createdAt: now,
      });
    }

    const touchedCanonicalKeys = new Set(
      [...projectionByEvidence.values()].map((projection) => projection.canonicalKey),
    );
    const canonicalRelations = collectCanonicalEvidenceRelations(
      db,
      seed.world.id,
    );
    const relationsByCanonical = new Map<string, CanonicalEvidenceRelation[]>();
    for (const relation of canonicalRelations) {
      const list = relationsByCanonical.get(relation.fromCanonical) ?? [];
      list.push(relation);
      relationsByCanonical.set(relation.fromCanonical, list);
    }

    let unresolvedRelations = 0;
    for (const canonicalKey of touchedCanonicalKeys) {
      const card = worlds.getCard(seed.world.id, canonicalKey);
      if (!card) continue;
      const representative = [...projectionByEvidence.values()].find(
        (candidate) => candidate.canonicalKey === canonicalKey,
      );
      if (!representative) continue;

      const relationLines = (relationsByCanonical.get(canonicalKey) ?? []).map(
        (edge) =>
          edge.relation +
          "：[[" +
          edge.toCanonical +
          "|" +
          edge.toName +
          "]]",
      );
      const baseContent = created.has(canonicalKey)
        ? renderSeedCard(
            representative.record,
            representative.corpusId,
            [],
          )
        : migrateLegacySeedRelationSection(card.content);
      const nextContent = upsertManagedRelationSection(
        baseContent,
        relationLines,
      );
      if (nextContent === card.content) continue;
      worlds.upsertCard({
        worldId: seed.world.id,
        entityKey: canonicalKey,
        kind: card.record.kind,
        name: card.record.name,
        aliases: card.record.aliases,
        content: nextContent,
        now,
      });
    }

    for (const corpus of seed.corpora) {
      const mappedKeys = new Set(
        corpus.records
          .filter((record) => record.canonicalKey)
          .map((record) => record.sourceKey),
      );
      for (const edge of corpus.relations)
        if (!mappedKeys.has(edge.fromKey) || !mappedKeys.has(edge.toKey))
          unresolvedRelations += 1;
    }

    const evidenceLinks = (
      db.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM source_world_evidence_links WHERE world_id=?",
        )
        .get(seed.world.id) as { n: number }
    ).n;

    return {
      worldId: seed.world.id,
      canonicalCorpusId: seed.world.canonicalCorpusId,
      evidenceCorpora: seed.corpora.map((corpus) => corpus.id),
      evidenceRecords: seed.corpora.reduce(
        (sum, corpus) => sum + corpus.records.length,
        0,
      ),
      evidenceRelations: seed.corpora.reduce(
        (sum, corpus) => sum + corpus.relations.length,
        0,
      ),
      createdCards: created.size,
      preservedCards,
      evidenceLinks,
      unresolvedRelations,
    };
  });
}

interface CanonicalEvidenceRelation {
  fromCanonical: string;
  toCanonical: string;
  relation: string;
  toName: string;
}

function collectCanonicalEvidenceRelations(
  db: NarrativeDatabase,
  worldId: string,
): CanonicalEvidenceRelation[] {
  const rows = db.raw
    .prepare(
      `
      SELECT DISTINCT
        source_link.canonical_key AS fromCanonical,
        target_link.canonical_key AS toCanonical,
        rel.relation AS relation,
        target_record.name AS toName
      FROM source_world_evidence_links source_link
      JOIN source_relations rel
        ON rel.corpus_id=source_link.evidence_corpus_id
       AND rel.from_key=source_link.evidence_key
      JOIN source_world_evidence_links target_link
        ON target_link.world_id=source_link.world_id
       AND target_link.evidence_corpus_id=rel.corpus_id
       AND target_link.evidence_key=rel.to_key
      JOIN source_worlds world
        ON world.id=source_link.world_id
      JOIN source_records target_record
        ON target_record.corpus_id=world.canonical_corpus_id
       AND target_record.source_key=target_link.canonical_key
      WHERE source_link.world_id=?
        AND source_link.review_status<>'rejected'
        AND target_link.review_status<>'rejected'
      ORDER BY source_link.canonical_key,rel.relation,target_link.canonical_key
      `,
    )
    .all(worldId) as unknown as CanonicalEvidenceRelation[];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key =
      row.fromCanonical + "\0" + row.relation + "\0" + row.toCanonical;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const MANAGED_RELATION_START = "<!-- source-world-seed-relations:start -->";
const MANAGED_RELATION_END = "<!-- source-world-seed-relations:end -->";

function upsertManagedRelationSection(
  content: string,
  relationLines: readonly string[],
): string {
  const managed = relationLines.length
    ? [
        MANAGED_RELATION_START,
        "## 自动证据关系",
        "以下关系由已挂接的 Source Evidence 重建；可人工补充正文，但此区块会在再次导入时刷新。",
        ...relationLines,
        MANAGED_RELATION_END,
      ].join("\n")
    : "";

  const start = content.indexOf(MANAGED_RELATION_START);
  const end = content.indexOf(MANAGED_RELATION_END);
  if (start >= 0 && end >= start) {
    const tail = end + MANAGED_RELATION_END.length;
    return [content.slice(0, start).trimEnd(), managed, content.slice(tail).trim()]
      .filter(Boolean)
      .join("\n\n");
  }
  if (!managed) return content.trimEnd();
  return content.trimEnd() + "\n\n" + managed;
}

function migrateLegacySeedRelationSection(content: string): string {
  if (
    !content.includes("状态：上游 Source assertion 的整理投影") ||
    content.includes(MANAGED_RELATION_START)
  )
    return content;
  return content.replace(/\n## 已记录关系\n[\s\S]*$/, "").trimEnd();
}

function validateSeed(seed: SourceWorldSeed): void {
  if (!seed.world.id.trim()) throw new Error("source.world.seed.id_required");
  if (!seed.corpora.length)
    throw new Error("source.world.seed.corpus_required");
  const corpusIds = new Set<string>();
  for (const corpus of seed.corpora) {
    if (corpusIds.has(corpus.id))
      throw new Error("source.world.seed.duplicate_corpus");
    corpusIds.add(corpus.id);
    const keys = new Set(corpus.records.map((record) => record.sourceKey));
    if (keys.size !== corpus.records.length)
      throw new Error("source.world.seed.duplicate_source_key");
    for (const edge of corpus.relations)
      if (!keys.has(edge.fromKey) || !keys.has(edge.toKey))
        throw new Error(
          "source.world.seed.relation_endpoint_missing:" +
            corpus.id +
            ":" +
            edge.fromKey +
            "->" +
            edge.toKey,
        );
  }
}

function renderSeedCard(
  record: SourceWorldSeedRecord,
  corpusId: string,
  relationLines: readonly string[],
): string {
  const lines = [
    "# " + record.name,
    "",
    "## Source Reference",
    "证据来源：" + corpusId + " / " + record.sourceKey,
    "来源集合：" + record.originCollection,
    record.sourceUrl ? "来源地址：" + record.sourceUrl : "",
    "状态：上游 Source assertion 的整理投影；不是单书 Project Reality，也不代表官方资料已独立核验。",
  ];
  if (record.summary) lines.push("", "## 上游摘要", record.summary);

  const rawLines = flattenRaw(record.raw);
  if (rawLines.length)
    lines.push("", "## 原始字段摘录", ...rawLines.map((line) => "- " + line));

  if (relationLines.length) lines.push("", "## 已记录关系", ...relationLines);

  return lines.filter(Boolean).join("\n");
}

function flattenRaw(raw: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const add = (path: string, value: unknown): void => {
    if (lines.length >= 40) return;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value).trim();
      if (text) lines.push(path + ": " + text.slice(0, 500));
      return;
    }
    if (Array.isArray(value)) {
      const primitives = value
        .filter(
          (item) =>
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean",
        )
        .slice(0, 12)
        .map(String);
      if (primitives.length)
        lines.push(path + ": " + primitives.join("、").slice(0, 900));
      return;
    }
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>,
      ).slice(0, 20))
        add(path ? path + "." + key : key, child);
  };
  for (const [key, value] of Object.entries(raw).slice(0, 30)) add(key, value);
  return lines;
}
