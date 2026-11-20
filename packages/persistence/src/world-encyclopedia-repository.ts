import type { CanonEntity, CanonFact } from "@narralume/domain";
import { SqliteCanonRepository } from "./canon-repository.js";
import type { NarrativeDatabase } from "./database.js";
import {
  SqliteProjectWorldRepository,
  type ProjectSourceIdentity,
  type ProjectEntitySpaceLink,
  type ProjectTravelHistoryRow,
} from "./project-world-repository.js";
import {
  SqliteWorldStructuresRepository,
  type WorldMapEdge,
  type WorldCapabilityProfile,
  type WorldCapabilityLink,
  type WorldProductionLink,
  type WorldInformationFlow,
} from "./world-structures-repository.js";

/**
 * Cross-module world encyclopedia view over the ONE NarraLume Canon.
 * The v0.1-v0.7 specialized tables are facets, not independent entities.
 *
 * A dossier has the full prose, institutional chronology, offices,
 * standing by evaluator, positions, actual mediators, value interests and
 * the native fact/relationship network, all on the same Canon entity ID.
 */
export interface WorldLoreSection {
  id: string;
  entity_id: string;
  facet: string;
  title: string;
  content: string;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldChronicleRow {
  id: string;
  timeline_event_id: string;
  title: string;
  story_time_start: string | null;
  story_time_end: string | null;
  sequence: number;
  relevance: string;
  consequence: string;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldOrganizationProfile {
  organization_id: string;
  social_kind: string;
  governance: string;
  membership: string;
  succession: string;
  funding: string;
  purpose: string;
  current_agenda: string;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldOrganizationFunction {
  id: string;
  organization_id: string;
  unit_entity_id: string | null;
  officeholder_entity_id: string | null;
  jurisdiction_entity_id: string | null;
  resource_entity_id: string | null;
  function_name: string;
  responsibility: string;
  decision_right: string;
  real_process: string;
  valid_from_event_id: string | null;
  valid_to_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldStance {
  id: string;
  actor_entity_id: string;
  issue_entity_id: string;
  target_entity_id: string | null;
  stance: string;
  interest: string;
  intended_action: string;
  visibility: "public" | "private" | "author_secret";
  valid_from_event_id: string | null;
  valid_to_event_id: string | null;
  evidence_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldStanding {
  id: string;
  subject_entity_id: string;
  evaluator_entity_id: string;
  dimension: string;
  assessment: string;
  evidence_event_id: string | null;
  intermediary_entity_id: string | null;
  actual_response: string;
  actual_right_entity_id: string | null;
  world_time: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldPowerChannel {
  id: string;
  holder_entity_id: string;
  intermediary_entity_id: string | null;
  authority_entity_id: string | null;
  target_entity_id: string;
  jurisdiction_entity_id: string | null;
  real_action: string;
  prerequisites: string;
  cannot_grant: string;
  evidence_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldValueAppraisal {
  id: string;
  subject_entity_id: string;
  evaluator_entity_id: string | null;
  value_kind: string;
  value_basis: string;
  scarcity: string;
  access_path: string;
  future_use: string;
  status: "potential" | "contested" | "available" | "realized" | "retired";
  realization_event_id: string | null;
  source_type: string;
  source_id: string | null;
  source_note: string;
}
export interface WorldNetworkEdge {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation: string;
  state_json: string;
  story_time: string | null;
  source_id: string | null;
}
export interface WorldEntityDossier {
  entity: CanonEntity;
  facts: CanonFact[];
  lore: WorldLoreSection[];
  chronicle: WorldChronicleRow[];
  organizationProfile: WorldOrganizationProfile | null;
  functions: WorldOrganizationFunction[];
  stances: WorldStance[];
  standings: WorldStanding[];
  powerChannels: WorldPowerChannel[];
  valueAppraisals: WorldValueAppraisal[];
  network: WorldNetworkEdge[];
  mapEdges: WorldMapEdge[];
  capability: WorldCapabilityProfile | null;
  capabilityLinks: WorldCapabilityLink[];
  productionLinks: WorldProductionLink[];
  informationFlows: WorldInformationFlow[];
  sourceIdentities: ProjectSourceIdentity[];
  worldAffiliations: ProjectEntitySpaceLink[];
  travelHistory: ProjectTravelHistoryRow[];
}

export class SqliteWorldEncyclopediaRepository {
  private readonly canon: SqliteCanonRepository;
  private readonly structures: SqliteWorldStructuresRepository;
  private readonly projectWorld: SqliteProjectWorldRepository;

  constructor(private readonly db: NarrativeDatabase) {
    this.canon = new SqliteCanonRepository(db);
    this.structures = new SqliteWorldStructuresRepository(db);
    this.projectWorld = new SqliteProjectWorldRepository(db);
  }

  /** Source-of-truth chronology is timeline_events, never another history list. */
  listChronicle(projectId: string, entityId: string): WorldChronicleRow[] {
    return this.db.raw
      .prepare(
        `
      SELECT link.id, link.timeline_event_id, event.title,
             event.story_time_start, event.story_time_end, event.sequence,
             link.relevance, link.consequence, link.source_type, link.source_id, link.source_note
      FROM world_chronicle_links link
      JOIN timeline_events event ON event.id=link.timeline_event_id
      WHERE link.project_id=? AND link.entity_id=?
      ORDER BY event.sequence, event.story_time_start, event.created_at, link.id
    `,
      )
      .all(projectId, entityId) as WorldChronicleRow[];
  }

  /** Dynamic two-direction relationship network excludes superseded or
   * ended relationships. The native relationship_events table remains truth. */
  listNetwork(projectId: string, entityId: string): WorldNetworkEdge[] {
    return this.db.raw
      .prepare(
        `
      SELECT rel.id, rel.from_entity_id, rel.to_entity_id, rel.relation,
             rel.state_json, rel.story_time, rel.source_id
      FROM relationship_events rel
      WHERE rel.project_id=?
        AND (rel.from_entity_id=? OR rel.to_entity_id=?)
        AND json_extract(rel.state_json,'$.lifecycle') IS NOT 'voided'
        AND NOT EXISTS (
          SELECT 1 FROM relationship_events later
          WHERE later.project_id=rel.project_id AND later.supersedes_event_id=rel.id
        )
      ORDER BY rel.story_time, rel.created_at, rel.id
    `,
      )
      .all(projectId, entityId, entityId) as WorldNetworkEdge[];
  }

  /** One stable Canon ID opens history, lore, power, reputation, stance,
   * internal organization and actual relationship edges in one operation. */
  getDossier(projectId: string, entityId: string): WorldEntityDossier {
    const entity = this.canon.requireEntity(projectId, entityId);
    const lore = this.db.raw
      .prepare(
        `
      SELECT binding.id, binding.entity_id, binding.facet, entry.title,
             entry.content, binding.source_type, binding.source_id, binding.source_note
      FROM world_lore_bindings binding
      JOIN lore_entries entry ON entry.id=binding.lore_entry_id
      WHERE binding.project_id=? AND binding.entity_id=?
      ORDER BY binding.facet, entry.title, binding.id
    `,
      )
      .all(projectId, entityId) as WorldLoreSection[];
    const organizationProfile = this.db.raw
      .prepare(
        `
      SELECT organization_id, social_kind, governance, membership,
             succession, funding, purpose, current_agenda, source_type, source_id, source_note
      FROM world_organization_profiles WHERE project_id=? AND organization_id=?
    `,
      )
      .get(projectId, entityId) as WorldOrganizationProfile | undefined;
    const functions = this.db.raw
      .prepare(
        `
      SELECT id, organization_id, unit_entity_id, officeholder_entity_id,
             jurisdiction_entity_id, resource_entity_id, function_name,
             responsibility, decision_right, real_process, valid_from_event_id,
             valid_to_event_id, source_type, source_id, source_note
      FROM world_organization_functions
      WHERE project_id=? AND organization_id=?
      ORDER BY function_name, id
    `,
      )
      .all(projectId, entityId) as WorldOrganizationFunction[];
    const stances = this.db.raw
      .prepare(
        `
      SELECT id, actor_entity_id, issue_entity_id, target_entity_id,
             stance, interest, intended_action, visibility, valid_from_event_id,
             valid_to_event_id, evidence_event_id, source_type, source_id, source_note
      FROM world_stances
      WHERE project_id=? AND actor_entity_id=?
      ORDER BY created_at, id
    `,
      )
      .all(projectId, entityId) as WorldStance[];
    const standings = this.db.raw
      .prepare(
        `
      SELECT id, subject_entity_id, evaluator_entity_id, dimension,
             assessment, evidence_event_id, intermediary_entity_id,
             actual_response, actual_right_entity_id, world_time, source_type, source_id, source_note
      FROM world_standings
      WHERE project_id=? AND subject_entity_id=?
      ORDER BY world_time, id
    `,
      )
      .all(projectId, entityId) as WorldStanding[];
    const powerChannels = this.db.raw
      .prepare(
        `
      SELECT id, holder_entity_id, intermediary_entity_id, authority_entity_id,
             target_entity_id, jurisdiction_entity_id, real_action,
             prerequisites, cannot_grant, evidence_event_id, source_type, source_id, source_note
      FROM world_power_channels
      WHERE project_id=? AND (
        holder_entity_id=? OR target_entity_id=? OR
        intermediary_entity_id=? OR authority_entity_id=?
      )
      ORDER BY id
    `,
      )
      .all(
        projectId,
        entityId,
        entityId,
        entityId,
        entityId,
      ) as WorldPowerChannel[];
    const valueAppraisals = this.db.raw
      .prepare(
        `
      SELECT id, subject_entity_id, evaluator_entity_id, value_kind,
             value_basis, scarcity, access_path, future_use, status,
             realization_event_id, source_type, source_id, source_note
      FROM world_value_appraisals
      WHERE project_id=? AND (subject_entity_id=? OR evaluator_entity_id=?)
      ORDER BY status, id
    `,
      )
      .all(projectId, entityId, entityId) as WorldValueAppraisal[];
    return {
      entity,
      facts: this.canon.listEffectiveFacts(projectId, { subjectId: entityId }),
      lore,
      chronicle: this.listChronicle(projectId, entityId),
      organizationProfile: organizationProfile ?? null,
      functions,
      stances,
      standings,
      powerChannels,
      valueAppraisals,
      network: this.listNetwork(projectId, entityId),
      mapEdges: this.structures.listMapEdges(projectId, entityId),
      capability: this.structures.getCapability(projectId, entityId),
      capabilityLinks: this.structures.listCapabilityLinks(projectId, entityId),
      productionLinks: this.structures.listProductionLinks(projectId, entityId),
      informationFlows: this.structures.listInformationFlows(
        projectId,
        entityId,
      ),
      sourceIdentities: this.projectWorld.listSourceLinks(projectId,entityId),
      worldAffiliations: this.projectWorld.listEntitySpaces(projectId,entityId),
      travelHistory: this.projectWorld.listTravelerHistory(projectId,entityId),
    };
  }

  /** The dossier uses Canon IDs across all facets. This query supplies
   * navigable neighbours without copying their profiles into the dossier. */
  listLinkedEntities(projectId: string, entityId: string): CanonEntity[] {
    const ids = new Set<string>();
    for (const link of this.listNetwork(projectId, entityId))
      ids.add(
        link.from_entity_id === entityId
          ? link.to_entity_id
          : link.from_entity_id,
      );
    const dossier = this.getDossier(projectId, entityId);
    for (const fact of dossier.facts)
      if (fact.objectEntityId) ids.add(fact.objectEntityId);
    // World sections extend the canonical relationship graph. These IDs are
    // links to real Canon entities, never copies of their biographies.
    for (const fn of dossier.functions)
      for (const id of [
        fn.unit_entity_id,
        fn.officeholder_entity_id,
        fn.jurisdiction_entity_id,
        fn.resource_entity_id,
      ])
        if (id) ids.add(id);
    for (const stance of dossier.stances)
      for (const id of [stance.issue_entity_id, stance.target_entity_id])
        if (id) ids.add(id);
    for (const standing of dossier.standings)
      for (const id of [
        standing.evaluator_entity_id,
        standing.intermediary_entity_id,
        standing.actual_right_entity_id,
      ])
        if (id) ids.add(id);
    for (const channel of dossier.powerChannels)
      for (const id of [
        channel.holder_entity_id,
        channel.intermediary_entity_id,
        channel.authority_entity_id,
        channel.target_entity_id,
        channel.jurisdiction_entity_id,
      ])
        if (id) ids.add(id);
    for (const value of dossier.valueAppraisals)
      for (const id of [value.subject_entity_id, value.evaluator_entity_id])
        if (id) ids.add(id);
    for (const edge of dossier.mapEdges)
      for (const id of [
        edge.from_entity_id,
        edge.to_entity_id,
        edge.intermediary_entity_id,
      ])
        if (id) ids.add(id);
    for (const edge of dossier.capabilityLinks)
      for (const id of [edge.source_entity_id, edge.target_entity_id])
        if (id) ids.add(id);
    for (const flow of dossier.productionLinks)
      for (const id of [
        flow.input_entity_id,
        flow.output_entity_id,
        flow.operator_entity_id,
        flow.site_entity_id,
        flow.intermediary_entity_id,
      ])
        if (id) ids.add(id);
    for (const flow of dossier.informationFlows)
      for (const id of [
        flow.sender_entity_id,
        flow.receiver_entity_id,
        flow.carrier_entity_id,
      ])
        if (id) ids.add(id);
    ids.delete(entityId);
    return [...ids].sort().flatMap((id) => {
      const found = this.canon.getEntity(projectId, id);
      return found ? [found] : [];
    });
  }
}
