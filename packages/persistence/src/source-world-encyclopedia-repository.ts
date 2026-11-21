import type { NarrativeDatabase } from "./database.js";
import {
  SqliteSourceCorpusRepository,
  type SourceRecord,
  type SourceRelation,
  type SourceKind,
} from "./source-corpus-repository.js";

export interface MotherWorldLoreSection {
  sectionKey: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourcePointer: string;
  sourceNote: string;
}
export interface MotherWorldChronicleEvent {
  eventKey: string;
  title: string;
  worldTime: string;
  sequence: number | null;
  description: string;
  role: string;
  consequence: string;
  sourceUrl: string;
  sourcePointer: string;
  sourceNote: string;
}
export interface MotherWorldClaim {
  id: string;
  subjectKey: string;
  predicate: string;
  objectKey: string | null;
  value: unknown;
  worldTimeFrom: string;
  worldTimeTo: string;
  assertion: "recorded" | "disputed" | "uncertain" | "inferred";
  sourceUrl: string;
  sourcePointer: string;
  sourceNote: string;
}
export interface MotherWorldOrganization {
  organizationForm: string;
  governance: string;
  succession: string;
  duties: string;
  jurisdiction: string;
  assetsAndIncome: string;
  internalFactions: string;
  ordinaryLife: string;
  era: string;
  sourceNote: string;
}
export interface MotherWorldAbility {
  powerMode: "ordinary" | "supernatural";
  mechanism: string;
  actualEffects: string;
  acquisition: string;
  progression: string;
  combinations: string;
  constraints: string;
  counters: string;
  socialValue: string;
  era: string;
  sourceNote: string;
}
export interface MotherWorldMapEdge {
  id: string;
  fromKey: string;
  toKey: string;
  layer: "physical" | "control" | "social" | "information";
  relation: string;
  intermediaryKey: string | null;
  accessConditions: string;
  worldTime: string;
  sourceNote: string;
}
export interface MotherWorldStanding {
  id: string;
  subjectKey: string;
  evaluatorKey: string;
  dimension: string;
  assessment: string;
  worldTime: string;
  evidenceEventKey: string | null;
  actualResponse: string;
  sourceNote: string;
}
export interface MotherWorldResourceFlow {
  id: string;
  inputKey: string | null;
  outputKey: string;
  operatorKey: string | null;
  siteKey: string | null;
  processKind: string;
  process: string;
  prerequisites: string;
  worldTime: string;
  sourceNote: string;
}
export interface MotherWorldValue {
  id: string;
  subjectKey: string;
  evaluatorKey: string | null;
  valueKind: string;
  valueBasis: string;
  scarcity: string;
  worldTime: string;
  sourceNote: string;
}
export interface MotherWorldDossier {
  record: SourceRecord;
  lore: MotherWorldLoreSection[];
  chronicle: MotherWorldChronicleEvent[];
  claims: MotherWorldClaim[];
  organization: MotherWorldOrganization | null;
  ability: MotherWorldAbility | null;
  relations: Array<
    SourceRelation & {
      otherName: string;
      otherKind: SourceKind;
      direction: "out" | "in";
    }
  >;
  maps: MotherWorldMapEdge[];
  standings: MotherWorldStanding[];
  production: MotherWorldResourceFlow[];
  values: MotherWorldValue[];
  linkedRecords: SourceRecord[];
}

type DatabaseRow = Record<string, unknown>;
const str = (r: DatabaseRow, k: string): string => r[k] as string;
const optional = (r: DatabaseRow, k: string): string | null =>
  r[k] as string | null;

/**
 * A source encyclopedia is a complete reference world of its own.
 * All FK references are source-record keys, NOT novel-specific Canon IDs.
 * The same original chronology, personalities and power rules can serve any
 * number of novel projects without being rewritten by any of their stories.
 */
export class SqliteMotherWorldEncyclopediaRepository {
  private readonly source: SqliteSourceCorpusRepository;
  constructor(private readonly db: NarrativeDatabase) {
    this.source = new SqliteSourceCorpusRepository(db);
  }

  upsertLore(input: {
    corpusId: string;
    sourceKey: string;
    sectionKey: string;
    title: string;
    content: string;
    sourceUrl?: string;
    sourcePointer?: string;
    sourceNote?: string;
    updatedAt: string;
  }): void {
    if (!input.content.trim()) throw Error("source.lore.empty");
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_lore_sections(
        corpus_id,source_key,section_key,title,content,source_url,
        source_pointer,source_note,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(corpus_id,source_key,section_key) DO UPDATE SET
        title=excluded.title,content=excluded.content,
        source_url=excluded.source_url,
        source_pointer=excluded.source_pointer,
        source_note=excluded.source_note,updated_at=excluded.updated_at
    `,
      )
      .run(
        input.corpusId,
        input.sourceKey,
        input.sectionKey,
        input.title,
        input.content,
        input.sourceUrl ?? "",
        input.sourcePointer ?? "",
        input.sourceNote ?? "",
        input.updatedAt,
      );
  }

  upsertChronicle(input: {
    corpusId: string;
    eventKey: string;
    title: string;
    worldTime?: string;
    sequence?: number | null;
    description?: string;
    sourceUrl?: string;
    sourcePointer?: string;
    sourceNote?: string;
    updatedAt: string;
  }): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_chronicle(
        corpus_id,event_key,title,world_time,sequence,description,
        source_url,source_pointer,source_note,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(corpus_id,event_key) DO UPDATE SET
        title=excluded.title,world_time=excluded.world_time,
        sequence=excluded.sequence,description=excluded.description,
        source_url=excluded.source_url,source_pointer=excluded.source_pointer,
        source_note=excluded.source_note,updated_at=excluded.updated_at
    `,
      )
      .run(
        input.corpusId,
        input.eventKey,
        input.title,
        input.worldTime ?? "",
        input.sequence ?? null,
        input.description ?? "",
        input.sourceUrl ?? "",
        input.sourcePointer ?? "",
        input.sourceNote ?? "",
        input.updatedAt,
      );
  }

  linkChronicle(input: {
    corpusId: string;
    eventKey: string;
    sourceKey: string;
    role: string;
    consequence?: string;
    sourceNote?: string;
  }): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_chronicle_subjects(
        corpus_id,event_key,source_key,role,consequence,source_note
      ) VALUES(?,?,?,?,?,?)
      ON CONFLICT(corpus_id,event_key,source_key,role) DO UPDATE SET
        consequence=excluded.consequence,source_note=excluded.source_note
    `,
      )
      .run(
        input.corpusId,
        input.eventKey,
        input.sourceKey,
        input.role,
        input.consequence ?? "",
        input.sourceNote ?? "",
      );
  }

  addClaim(input: {
    id: string;
    corpusId: string;
    subjectKey: string;
    predicate: string;
    objectKey?: string | null;
    value?: unknown;
    worldTimeFrom?: string;
    worldTimeTo?: string;
    assertion?: MotherWorldClaim["assertion"];
    sourceUrl?: string;
    sourcePointer?: string;
    sourceNote?: string;
    createdAt: string;
  }): void {
    const hasRef = input.objectKey !== undefined && input.objectKey !== null;
    const hasValue = Object.hasOwn(input, "value");
    if (hasRef === hasValue) throw Error("source.claim.requires_one_target");
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_claims(
        id,corpus_id,subject_key,predicate,object_key,value_json,
        world_time_from,world_time_to,assertion,source_url,source_pointer,
        source_note,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      )
      .run(
        input.id,
        input.corpusId,
        input.subjectKey,
        input.predicate,
        input.objectKey ?? null,
        hasValue ? JSON.stringify(input.value) : null,
        input.worldTimeFrom ?? "",
        input.worldTimeTo ?? "",
        input.assertion ?? "recorded",
        input.sourceUrl ?? "",
        input.sourcePointer ?? "",
        input.sourceNote ?? "",
        input.createdAt,
      );
  }

  upsertOrganization(input: {
    corpusId: string;
    sourceKey: string;
    organizationForm?: string;
    governance?: string;
    succession?: string;
    duties?: string;
    jurisdiction?: string;
    assetsAndIncome?: string;
    internalFactions?: string;
    ordinaryLife?: string;
    era?: string;
    sourceNote?: string;
    updatedAt: string;
  }): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_organization_profiles(
        corpus_id,source_key,organization_form,governance,succession,duties,
        jurisdiction,assets_and_income,internal_factions,ordinary_life,
        era,source_note,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(corpus_id,source_key) DO UPDATE SET
        organization_form=excluded.organization_form,
        governance=excluded.governance,succession=excluded.succession,
        duties=excluded.duties,jurisdiction=excluded.jurisdiction,
        assets_and_income=excluded.assets_and_income,
        internal_factions=excluded.internal_factions,
        ordinary_life=excluded.ordinary_life,era=excluded.era,
        source_note=excluded.source_note,updated_at=excluded.updated_at
    `,
      )
      .run(
        input.corpusId,
        input.sourceKey,
        input.organizationForm ?? "",
        input.governance ?? "",
        input.succession ?? "",
        input.duties ?? "",
        input.jurisdiction ?? "",
        input.assetsAndIncome ?? "",
        input.internalFactions ?? "",
        input.ordinaryLife ?? "",
        input.era ?? "",
        input.sourceNote ?? "",
        input.updatedAt,
      );
  }

  upsertAbility(input: {
    corpusId: string;
    sourceKey: string;
    powerMode: "ordinary" | "supernatural";
    mechanism?: string;
    actualEffects?: string;
    acquisition?: string;
    progression?: string;
    combinations?: string;
    constraints?: string;
    counters?: string;
    socialValue?: string;
    era?: string;
    sourceNote?: string;
    updatedAt: string;
  }): void {
    this.db.raw
      .prepare(
        `
      INSERT INTO source_world_capability_profiles(
        corpus_id,source_key,power_mode,mechanism,actual_effects,
        acquisition,progression,combinations,constraints,counters,
        social_value,era,source_note,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(corpus_id,source_key) DO UPDATE SET
        power_mode=excluded.power_mode,mechanism=excluded.mechanism,
        actual_effects=excluded.actual_effects,
        acquisition=excluded.acquisition,progression=excluded.progression,
        combinations=excluded.combinations,constraints=excluded.constraints,
        counters=excluded.counters,social_value=excluded.social_value,
        era=excluded.era,source_note=excluded.source_note,
        updated_at=excluded.updated_at
    `,
      )
      .run(
        input.corpusId,
        input.sourceKey,
        input.powerMode,
        input.mechanism ?? "",
        input.actualEffects ?? "",
        input.acquisition ?? "",
        input.progression ?? "",
        input.combinations ?? "",
        input.constraints ?? "",
        input.counters ?? "",
        input.socialValue ?? "",
        input.era ?? "",
        input.sourceNote ?? "",
        input.updatedAt,
      );
  }

  getDossier(corpusId: string, sourceKey: string): MotherWorldDossier | null {
    const record = this.source.getRecord(corpusId, sourceKey);
    if (!record) return null;
    const lore = this.db.raw
      .prepare(
        `
      SELECT section_key AS sectionKey,title,content,source_url AS sourceUrl,
             source_pointer AS sourcePointer,source_note AS sourceNote
      FROM source_world_lore_sections
      WHERE corpus_id=? AND source_key=? ORDER BY section_key
    `,
      )
      .all(corpusId, sourceKey) as MotherWorldLoreSection[];
    const chronicle = this.db.raw
      .prepare(
        `
      SELECT e.event_key AS eventKey,e.title,e.world_time AS worldTime,
             e.sequence,e.description,link.role,link.consequence,
             e.source_url AS sourceUrl,e.source_pointer AS sourcePointer,
             link.source_note AS sourceNote
      FROM source_world_chronicle_subjects link
      JOIN source_world_chronicle e
        ON e.corpus_id=link.corpus_id AND e.event_key=link.event_key
      WHERE link.corpus_id=? AND link.source_key=?
      ORDER BY e.sequence,e.world_time,e.event_key,link.role
    `,
      )
      .all(corpusId, sourceKey) as MotherWorldChronicleEvent[];
    const rawClaims = this.db.raw
      .prepare(
        `
      SELECT id,subject_key AS subjectKey,predicate,object_key AS objectKey,
             value_json AS valueJson,world_time_from AS worldTimeFrom,
             world_time_to AS worldTimeTo,assertion,source_url AS sourceUrl,
             source_pointer AS sourcePointer,source_note AS sourceNote
      FROM source_world_claims
      WHERE corpus_id=? AND (subject_key=? OR object_key=?)
      ORDER BY predicate,id
    `,
      )
      .all(corpusId, sourceKey, sourceKey) as Array<DatabaseRow>;
    const claims: MotherWorldClaim[] = rawClaims.map((r) => ({
      id: str(r, "id"),
      subjectKey: str(r, "subjectKey"),
      predicate: str(r, "predicate"),
      objectKey: optional(r, "objectKey"),
      value: r.valueJson === null ? null : JSON.parse(str(r, "valueJson")),
      worldTimeFrom: str(r, "worldTimeFrom"),
      worldTimeTo: str(r, "worldTimeTo"),
      assertion: r.assertion as MotherWorldClaim["assertion"],
      sourceUrl: str(r, "sourceUrl"),
      sourcePointer: str(r, "sourcePointer"),
      sourceNote: str(r, "sourceNote"),
    }));
    const org = this.db.raw
      .prepare(
        `
      SELECT organization_form AS organizationForm,governance,succession,
        duties,jurisdiction,assets_and_income AS assetsAndIncome,
        internal_factions AS internalFactions,ordinary_life AS ordinaryLife,
        era,source_note AS sourceNote
      FROM source_world_organization_profiles
      WHERE corpus_id=? AND source_key=?
    `,
      )
      .get(corpusId, sourceKey) as MotherWorldOrganization | undefined;
    const ability = this.db.raw
      .prepare(
        `
      SELECT power_mode AS powerMode,mechanism,actual_effects AS actualEffects,
        acquisition,progression,combinations,constraints,counters,
        social_value AS socialValue,era,source_note AS sourceNote
      FROM source_world_capability_profiles
      WHERE corpus_id=? AND source_key=?
    `,
      )
      .get(corpusId, sourceKey) as MotherWorldAbility | undefined;
    const maps = this.db.raw
      .prepare(
        `
      SELECT id,from_key AS fromKey,to_key AS toKey,layer,relation,
        intermediary_key AS intermediaryKey,
        access_conditions AS accessConditions,world_time AS worldTime,
        source_note AS sourceNote
      FROM source_world_map_edges
      WHERE corpus_id=? AND (from_key=? OR to_key=? OR intermediary_key=?)
      ORDER BY layer,relation,id
    `,
      )
      .all(corpusId, sourceKey, sourceKey, sourceKey) as MotherWorldMapEdge[];
    const standings = this.db.raw
      .prepare(
        `
      SELECT id,subject_key AS subjectKey,evaluator_key AS evaluatorKey,
        dimension,assessment,world_time AS worldTime,
        evidence_event_key AS evidenceEventKey,
        actual_response AS actualResponse,source_note AS sourceNote
      FROM source_world_social_standings
      WHERE corpus_id=? AND (subject_key=? OR evaluator_key=?)
      ORDER BY dimension,world_time,id
    `,
      )
      .all(corpusId, sourceKey, sourceKey) as MotherWorldStanding[];
    const production = this.db.raw
      .prepare(
        `
      SELECT id,input_key AS inputKey,output_key AS outputKey,
        operator_key AS operatorKey,site_key AS siteKey,
        process_kind AS processKind,process,prerequisites,
        world_time AS worldTime,source_note AS sourceNote
      FROM source_world_resource_flows
      WHERE corpus_id=? AND (
        input_key=? OR output_key=? OR operator_key=? OR site_key=?
      )
      ORDER BY process_kind,id
    `,
      )
      .all(
        corpusId,
        sourceKey,
        sourceKey,
        sourceKey,
        sourceKey,
      ) as MotherWorldResourceFlow[];
    const values = this.db.raw
      .prepare(
        `
      SELECT id,subject_key AS subjectKey,evaluator_key AS evaluatorKey,
        value_kind AS valueKind,value_basis AS valueBasis,scarcity,
        world_time AS worldTime,source_note AS sourceNote
      FROM source_world_value_appraisals
      WHERE corpus_id=? AND (subject_key=? OR evaluator_key=?)
      ORDER BY value_kind,id
    `,
      )
      .all(corpusId, sourceKey, sourceKey) as MotherWorldValue[];
    const relations = this.source.listRelations(corpusId, sourceKey);
    const linkedKeys = new Set<string>();
    for (const r of relations)
      linkedKeys.add(r.fromKey === sourceKey ? r.toKey : r.fromKey);
    for (const c of claims) {
      if (c.objectKey) linkedKeys.add(c.objectKey);
      if (c.subjectKey !== sourceKey) linkedKeys.add(c.subjectKey);
    }
    for (const e of maps)
      for (const key of [e.fromKey, e.toKey, e.intermediaryKey])
        if (key) linkedKeys.add(key);
    for (const st of standings)
      for (const key of [st.subjectKey, st.evaluatorKey]) linkedKeys.add(key);
    for (const p of production)
      for (const key of [p.inputKey, p.outputKey, p.operatorKey, p.siteKey])
        if (key) linkedKeys.add(key);
    for (const v of values)
      for (const key of [v.subjectKey, v.evaluatorKey])
        if (key) linkedKeys.add(key);
    linkedKeys.delete(sourceKey);
    const linkedRecords = [...linkedKeys].sort().flatMap((key) => {
      const other = this.source.getRecord(corpusId, key);
      return other ? [other] : [];
    });
    return {
      record,
      lore,
      chronicle,
      claims,
      organization: org ?? null,
      ability: ability ?? null,
      relations,
      maps,
      standings,
      production,
      values,
      linkedRecords,
    };
  }
}
