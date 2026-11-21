import type { NarrativeDatabase } from "./database.js";

/**
 * v0.1-v0.7 shared world structure over the same project Canon IDs.
 * Queries describe content, authority and provenance, not an active game
 * server or an unrelated copy of a novel world's truth.
 */
export interface WorldMapEdge {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  layer: "physical" | "control" | "social" | "information";
  edge_kind: string;
  intermediary_entity_id: string | null;
  description: string;
  access_conditions: string;
  time_conditions: string;
  valid_from_event_id: string | null;
  valid_to_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldCapabilityProfile {
  entity_id: string;
  power_mode: "ordinary" | "supernatural";
  mechanism: string;
  actual_actions: string;
  effective_scope: string;
  activation_conditions: string;
  countermeasures: string;
  knowledge_or_training: string;
  social_effects: string;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldCapabilityLink {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation:
    | "prerequisite"
    | "combines_with"
    | "counters"
    | "improves"
    | "transforms_to"
    | "transmitted_by"
    | "licensed_by"
    | "used_by";
  mechanism: string;
  evidence_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldProductionLink {
  id: string;
  input_entity_id: string | null;
  output_entity_id: string;
  operator_entity_id: string | null;
  site_entity_id: string | null;
  intermediary_entity_id: string | null;
  process_kind:
    | "extract"
    | "train"
    | "produce"
    | "transform"
    | "transport"
    | "trade"
    | "consume"
    | "repair"
    | "distribute"
    | "other";
  concrete_process: string;
  prerequisites: string;
  resource_value: string;
  realization_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldInformationFlow {
  id: string;
  fact_id: string;
  sender_entity_id: string | null;
  receiver_entity_id: string;
  carrier_entity_id: string | null;
  event_id: string | null;
  world_time: string;
  belief:
    | "known"
    | "believed"
    | "suspected"
    | "false_belief"
    | "rejected"
    | "withheld";
  transmission: string;
  source_type: string;
  source_id: string | null;
  source_note: string;
}

export class SqliteWorldStructuresRepository {
  constructor(private readonly database: NarrativeDatabase) {}

  listMapEdges(projectId: string, entityId: string): WorldMapEdge[] {
    return this.database.raw
      .prepare(
        `
      SELECT id,from_entity_id,to_entity_id,layer,edge_kind,intermediary_entity_id,
             description,access_conditions,time_conditions,valid_from_event_id,
             valid_to_event_id,source_type,source_id,source_note
      FROM world_map_edges WHERE project_id=? AND (
        from_entity_id=? OR to_entity_id=? OR intermediary_entity_id=?
      )
      ORDER BY layer,edge_kind,id
    `,
      )
      .all(projectId, entityId, entityId, entityId) as WorldMapEdge[];
  }

  getCapability(
    projectId: string,
    entityId: string,
  ): WorldCapabilityProfile | null {
    const row = this.database.raw
      .prepare(
        `
      SELECT entity_id,power_mode,mechanism,actual_actions,effective_scope,
             activation_conditions,countermeasures,knowledge_or_training,
             social_effects,source_type,source_id,source_note
      FROM world_capability_profiles WHERE project_id=? AND entity_id=?
    `,
      )
      .get(projectId, entityId) as WorldCapabilityProfile | undefined;
    return row ?? null;
  }

  listCapabilityLinks(
    projectId: string,
    entityId: string,
  ): WorldCapabilityLink[] {
    return this.database.raw
      .prepare(
        `
      SELECT id,source_entity_id,target_entity_id,relation,mechanism,
             evidence_event_id,source_type,source_id,source_note
      FROM world_capability_links WHERE project_id=? AND (
        source_entity_id=? OR target_entity_id=?
      )
      ORDER BY relation,id
    `,
      )
      .all(projectId, entityId, entityId) as WorldCapabilityLink[];
  }

  listProductionLinks(
    projectId: string,
    entityId: string,
  ): WorldProductionLink[] {
    return this.database.raw
      .prepare(
        `
      SELECT id,input_entity_id,output_entity_id,operator_entity_id,site_entity_id,
             intermediary_entity_id,process_kind,concrete_process,prerequisites,
             resource_value,realization_event_id,source_type,source_id,source_note
      FROM world_production_links WHERE project_id=? AND (
        input_entity_id=? OR output_entity_id=? OR operator_entity_id=?
        OR site_entity_id=? OR intermediary_entity_id=?
      )
      ORDER BY process_kind,id
    `,
      )
      .all(
        projectId,
        entityId,
        entityId,
        entityId,
        entityId,
        entityId,
      ) as WorldProductionLink[];
  }

  listInformationFlows(
    projectId: string,
    entityId: string,
  ): WorldInformationFlow[] {
    return this.database.raw
      .prepare(
        `
      SELECT flow.id,flow.fact_id,flow.sender_entity_id,flow.receiver_entity_id,
             flow.carrier_entity_id,flow.event_id,flow.world_time,
             flow.belief,flow.transmission,flow.source_type,flow.source_id,flow.source_note
      FROM world_information_flows flow
      JOIN canon_facts fact ON fact.id=flow.fact_id
      WHERE flow.project_id=? AND (
        fact.subject_id=? OR flow.sender_entity_id=? OR flow.receiver_entity_id=?
        OR flow.carrier_entity_id=?
      )
      ORDER BY flow.world_time,flow.id
    `,
      )
      .all(
        projectId,
        entityId,
        entityId,
        entityId,
        entityId,
      ) as WorldInformationFlow[];
  }
}
