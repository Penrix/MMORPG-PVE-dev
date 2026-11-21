import type { CanonEntity, CanonFact } from "@narralume/domain";
import { SqliteCanonRepository } from "./canon-repository.js";
import type { NarrativeDatabase } from "./database.js";
import {
  SqliteProjectWorldRepository,
  type ProjectSourceIdentity,
} from "./project-world-repository.js";
import {
  SqliteMotherWorldEncyclopediaRepository,
  type MotherWorldDossier,
} from "./source-world-encyclopedia-repository.js";
import {
  SqliteWorldEncyclopediaRepository,
  type WorldEntityDossier,
} from "./world-encyclopedia-repository.js";

export type RealityFacet =
  | "claim"
  | "lore"
  | "chronicle"
  | "organization"
  | "ability"
  | "relationship"
  | "map"
  | "standing"
  | "production"
  | "value"
  | "asset"
  | "state"
  | "other";
export type RealityOperation = "set" | "unset";

export interface RealityRevisionInput {
  id: string;
  projectId: string;
  entityId: string;
  eventId: string;
  branchId: string | null;
  facet: RealityFacet;
  slotKey: string;
  operation: RealityOperation;
  /** SET on a claim uses a pointer to an accepted native Canon fact. */
  canonFactId?: string | null;
  /** Other SET operations persist an event-versioned world-section value. */
  value?: unknown;
  note: string;
  createdAt: string;
}
export interface RealityRevision extends RealityRevisionInput {
  storySequence: number;
  value: unknown;
  canonFactId: string | null;
}
export interface RealitySlot {
  facet: RealityFacet;
  slotKey: string;
  value: unknown;
  origin: "reference" | "project";
  revisionId: string | null;
  sourceCorpusId: string | null;
  sourceKey: string | null;
}
export interface RealitySourceReference {
  link: ProjectSourceIdentity;
  dossier: MotherWorldDossier;
}
export interface ProjectRealityView {
  entity: CanonEntity;
  projectId: string;
  asOfSequence: number | null;
  branchId: string | null;
  /** The source wiki is always a reference, not a claim about Project future. */
  sourceReferences: RealitySourceReference[];
  /** More than one confirmed source counterpart needs explicit selection. */
  ambiguousSourceBaseline: boolean;
  effectiveSlots: RealitySlot[];
  revisionHistory: RealityRevision[];
  /** Non-event-versioned legacy detail is returned only for current views. */
  currentProjectDossier: WorldEntityDossier | null;
  /** Historical queries only project event-versioned data, not timeless old rows. */
  legacyStateNotHistoricallyIndexed: boolean;
}
export interface RealityReadOptions {
  asOfSequence?: number;
  branchId?: string | null;
}

interface RevisionRow {
  id: string;
  project_id: string;
  entity_id: string;
  event_id: string;
  branch_id: string | null;
  facet: RealityFacet;
  slot_key: string;
  operation: RealityOperation;
  canon_fact_id: string | null;
  value_json: string | null;
  note: string;
  created_at: string;
  story_sequence: number;
}
interface BranchRow {
  id: string;
  parent_branch_id: string | null;
  divergence_sequence: number | null;
}
const keyFor = (facet: RealityFacet, slotKey: string): string =>
  JSON.stringify([facet, slotKey]);
const slot = (
  facet: RealityFacet,
  slotKey: string,
  value: unknown,
  sourceCorpusId: string,
  sourceKey: string,
): RealitySlot => ({
  facet,
  slotKey,
  value,
  origin: "reference",
  revisionId: null,
  sourceCorpusId,
  sourceKey,
});

/** Deterministic reference facets, without inventing any source-world facts.
 * The original complete dossier remains available in sourceReferences.
 */
function sourceSlots(dossier: MotherWorldDossier): RealitySlot[] {
  const c = dossier.record.corpusId;
  const k = dossier.record.sourceKey;
  const out: RealitySlot[] = [
    slot("state", "description", dossier.record.summary, c, k),
    slot("state", "source_record", dossier.record.raw, c, k),
  ];
  for (const section of dossier.lore)
    out.push(slot("lore", section.sectionKey, section, c, k));
  for (const event of dossier.chronicle)
    out.push(slot("chronicle", event.eventKey, event, c, k));
  const claims = new Map<string, typeof dossier.claims>();
  for (const claim of dossier.claims) {
    const entries = claims.get(claim.predicate) ?? [];
    entries.push(claim);
    claims.set(claim.predicate, entries);
  }
  for (const [predicate, entries] of claims)
    out.push(slot("claim", predicate, entries, c, k));
  if (dossier.organization)
    out.push(slot("organization", "profile", dossier.organization, c, k));
  if (dossier.ability)
    out.push(slot("ability", "profile", dossier.ability, c, k));
  for (const rel of dossier.relations)
    out.push(
      slot(
        "relationship",
        JSON.stringify([rel.direction, rel.relation, rel.fromKey, rel.toKey]),
        rel,
        c,
        k,
      ),
    );
  for (const edge of dossier.maps) out.push(slot("map", edge.id, edge, c, k));
  for (const standing of dossier.standings)
    out.push(slot("standing", standing.id, standing, c, k));
  for (const process of dossier.production)
    out.push(slot("production", process.id, process, c, k));
  for (const value of dossier.values)
    out.push(slot("value", value.id, value, c, k));
  return out;
}

function rowToRevision(
  row: RevisionRow,
  fact: CanonFact | null,
): RealityRevision {
  return {
    id: row.id,
    projectId: row.project_id,
    entityId: row.entity_id,
    eventId: row.event_id,
    branchId: row.branch_id,
    facet: row.facet,
    slotKey: row.slot_key,
    operation: row.operation,
    canonFactId: row.canon_fact_id,
    value: fact
      ? fact.objectEntityId
        ? { objectEntityId: fact.objectEntityId }
        : fact.value
      : row.value_json === null
        ? null
        : (JSON.parse(row.value_json) as unknown),
    note: row.note,
    createdAt: row.created_at,
    storySequence: row.story_sequence,
  };
}

/**
 * Only this layer decides source fallback and event-versioned Project diffs.
 * It does not create source content, invoke LLMs, or simulate NPC actions.
 */
export class SqliteProjectRealityRepository {
  private readonly canon: SqliteCanonRepository;
  private readonly worlds: SqliteProjectWorldRepository;
  private readonly source: SqliteMotherWorldEncyclopediaRepository;
  private readonly project: SqliteWorldEncyclopediaRepository;

  constructor(private readonly db: NarrativeDatabase) {
    this.canon = new SqliteCanonRepository(db);
    this.worlds = new SqliteProjectWorldRepository(db);
    this.source = new SqliteMotherWorldEncyclopediaRepository(db);
    this.project = new SqliteWorldEncyclopediaRepository(db);
  }

  /** One event can append a world-section revision, or explicitly mask one
   * inherited source section. It never deletes the original mother world.
   */
  appendChange(input: RealityRevisionInput): void {
    if (!input.slotKey.trim()) throw Error("reality.slot_key.empty");
    if (
      input.facet === "claim" &&
      input.operation === "set" &&
      !input.canonFactId
    )
      throw Error("reality.claim.requires_canon_fact");
    if (input.facet !== "claim" && input.canonFactId)
      throw Error("reality.section.cannot_reference_fact");
    if (
      input.operation === "set" &&
      input.facet !== "claim" &&
      !Object.hasOwn(input, "value")
    )
      throw Error("reality.section.value_missing");
    if (
      input.operation === "unset" &&
      (input.canonFactId || Object.hasOwn(input, "value"))
    )
      throw Error("reality.unset.must_not_have_value");
    this.db.raw
      .prepare(
        `
      INSERT INTO project_reality_revisions(
        id,project_id,entity_id,event_id,branch_id,facet,slot_key,
        operation,canon_fact_id,value_json,note,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      )
      .run(
        input.id,
        input.projectId,
        input.entityId,
        input.eventId,
        input.branchId,
        input.facet,
        input.slotKey,
        input.operation,
        input.canonFactId ?? null,
        input.operation === "set" && input.facet !== "claim"
          ? JSON.stringify(input.value)
          : null,
        input.note,
        input.createdAt,
      );
  }

  /** Third module supplies the *already decided* actual fact and event.
   * Writes the original NarraLume Canon and its version pointer atomically.
   */
  appendAcceptedFact(input: {
    revisionId: string;
    eventId: string;
    branchId: string | null;
    fact: CanonFact;
    note: string;
  }): void {
    if (
      input.fact.authority !== "confirmed" &&
      input.fact.authority !== "locked"
    )
      throw Error("reality.fact.not_accepted");
    this.db.transaction(() => {
      this.canon.insertFact(input.fact);
      this.appendChange({
        id: input.revisionId,
        projectId: input.fact.projectId,
        entityId: input.fact.subjectId,
        eventId: input.eventId,
        branchId: input.branchId,
        facet: "claim",
        slotKey: input.fact.predicate,
        operation: "set",
        canonFactId: input.fact.id,
        note: input.note,
        createdAt: input.fact.createdAt,
      });
    });
  }

  /** The branch's changes inherit ONLY its parent's history up to the
   * explicitly recorded divergence event. No branch is ever auto-created.
   */
  private branchCutoffs(
    projectId: string,
    branchId: string | null,
    asOfSequence: number | null,
  ): Array<{ branchId: string | null; cutoff: number }> {
    const result: Array<{ branchId: string | null; cutoff: number }> = [];
    const seen = new Set<string>();
    let cursor = branchId;
    let cutoff = asOfSequence ?? Number.POSITIVE_INFINITY;
    while (cursor !== null) {
      if (seen.has(cursor)) throw Error("reality.branch.cycle");
      seen.add(cursor);
      const b = this.db.raw
        .prepare(
          `
        SELECT b.id,b.parent_branch_id,e.sequence AS divergence_sequence
        FROM project_time_branches b
        LEFT JOIN timeline_events e ON e.id=b.divergence_event_id
        WHERE b.project_id=? AND b.id=?
      `,
        )
        .get(projectId, cursor) as BranchRow | undefined;
      if (!b) throw Error("reality.branch.not_found");
      result.push({ branchId: cursor, cutoff });
      if (b.divergence_sequence !== null)
        cutoff = Math.min(cutoff, b.divergence_sequence);
      cursor = b.parent_branch_id;
    }
    result.push({ branchId: null, cutoff });
    return result.reverse();
  }

  private activeRevisions(
    projectId: string,
    entityId: string,
    asOfSequence: number | null,
    branchId: string | null,
  ): RealityRevision[] {
    const cutoffs = this.branchCutoffs(projectId, branchId, asOfSequence);
    const rows = this.db.raw
      .prepare(
        `
      SELECT r.*,ev.sequence AS story_sequence
      FROM project_reality_revisions r
      JOIN timeline_events ev
        ON ev.id=r.event_id AND ev.project_id=r.project_id
      WHERE r.project_id=? AND r.entity_id=?
      ORDER BY ev.sequence,ev.created_at,r.created_at,r.id
    `,
      )
      .all(projectId, entityId) as RevisionRow[];
    const out: RealityRevision[] = [];
    for (const { branchId: level, cutoff } of cutoffs) {
      for (const row of rows) {
        if (row.branch_id !== level || row.story_sequence > cutoff) continue;
        const fact = row.canon_fact_id
          ? this.canon.getFact(projectId, row.canon_fact_id)
          : null;
        if (row.canon_fact_id && !fact)
          throw Error("reality.revision.missing_canon_fact");
        out.push(rowToRevision(row, fact));
      }
    }
    return out;
  }

  getEntityReality(
    projectId: string,
    entityId: string,
    options: RealityReadOptions = {},
  ): ProjectRealityView {
    const entity = this.canon.requireEntity(projectId, entityId);
    const asOfSequence = options.asOfSequence ?? null;
    if (
      asOfSequence !== null &&
      (!Number.isInteger(asOfSequence) || asOfSequence < 0)
    )
      throw Error("reality.as_of.invalid");
    const branchId = options.branchId ?? null;

    const accepted = this.worlds
      .listSourceLinks(projectId, entityId)
      .filter(
        (l) => l.linkKind === "counterpart" || l.linkKind === "adaptation",
      );
    const linked = this.db.raw
      .prepare(
        `
      SELECT corpus_id FROM project_source_bindings
      WHERE project_id=? AND enabled=1
    `,
      )
      .all(projectId) as Array<{ corpus_id: string }>;
    const enabled = new Set(linked.map((x) => x.corpus_id));
    const sourceReferences: RealitySourceReference[] = [];
    const unique = new Set<string>();
    for (const link of accepted) {
      if (!enabled.has(link.corpusId)) continue;
      const id = JSON.stringify([link.corpusId, link.sourceKey]);
      if (unique.has(id)) continue;
      unique.add(id);
      const dossier = this.source.getDossier(link.corpusId, link.sourceKey);
      if (dossier) sourceReferences.push({ link, dossier });
    }
    const ambiguousSourceBaseline = sourceReferences.length > 1;
    // Do not merge competing authoritatively distinct source records.
    const effective = new Map<string, RealitySlot>();
    if (sourceReferences.length === 1)
      for (const part of sourceSlots(sourceReferences[0]!.dossier))
        effective.set(keyFor(part.facet, part.slotKey), part);

    const historical = asOfSequence !== null;
    const currentProjectDossier = historical
      ? null
      : this.project.getDossier(projectId, entityId);
    // Legacy Canon facts that predate event-indexed versions are usable for
    // current queries only. We must not pretend they existed in the past.
    if (currentProjectDossier) {
      const facts = new Map<string, CanonFact[]>();
      for (const fact of currentProjectDossier.facts) {
        if (fact.authority !== "confirmed" && fact.authority !== "locked")
          continue;
        const a = facts.get(fact.predicate) ?? [];
        a.push(fact);
        facts.set(fact.predicate, a);
      }
      for (const [predicate, entries] of facts)
        effective.set(keyFor("claim", predicate), {
          facet: "claim",
          slotKey: predicate,
          value: entries.map((f) =>
            f.objectEntityId ? { objectEntityId: f.objectEntityId } : f.value,
          ),
          origin: "project",
          revisionId: null,
          sourceCorpusId: null,
          sourceKey: null,
        });
    }
    const history = this.activeRevisions(
      projectId,
      entityId,
      asOfSequence,
      branchId,
    );
    for (const revision of history) {
      const k = keyFor(revision.facet, revision.slotKey);
      if (revision.operation === "unset") {
        effective.delete(k);
        continue;
      }
      effective.set(k, {
        facet: revision.facet,
        slotKey: revision.slotKey,
        value: revision.value,
        origin: "project",
        revisionId: revision.id,
        sourceCorpusId: null,
        sourceKey: null,
      });
    }
    return {
      entity,
      projectId,
      asOfSequence,
      branchId,
      sourceReferences,
      ambiguousSourceBaseline,
      effectiveSlots: [...effective.values()].sort((a, b) =>
        (a.facet + a.slotKey).localeCompare(b.facet + b.slotKey),
      ),
      revisionHistory: history,
      currentProjectDossier,
      legacyStateNotHistoricallyIndexed: historical,
    };
  }
}
