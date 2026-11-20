import type { NarrativeDatabase } from "./database.js";

export type ProjectTravelKind =
  | "spatial"
  | "cross_world"
  | "time_travel"
  | "cross_world_time";
export type ProjectSpaceKind = "realm" | "region" | "site" | "dimension" | "other";

export interface ProjectWorldSpace {
  id: string;
  projectId: string;
  name: string;
  kind: ProjectSpaceKind;
  parentSpaceId: string | null;
  sourceCorpusId: string | null;
  description: string;
  createdAt: string;
}
export interface ProjectSourceIdentity {
  projectId: string;
  entityId: string;
  corpusId: string;
  sourceKey: string;
  linkKind: "counterpart" | "adaptation" | "inspiration" | "possible_match" | "alias";
  confidence: number | null;
  sourceNote: string;
  createdAt: string;
}
export interface ProjectTimeBranch {
  id: string;
  projectId: string;
  name: string;
  parentBranchId: string | null;
  divergenceEventId: string | null;
  causalRule: string;
  createdAt: string;
}
export interface ProjectTravel {
  id: string;
  projectId: string;
  eventId: string;
  travelerEntityId: string;
  fromSpaceId: string;
  toSpaceId: string;
  departureTime: string;
  arrivalTime: string;
  fromBranchId: string | null;
  toBranchId: string | null;
  travelKind: ProjectTravelKind;
  mechanismEntityId: string | null;
  consequenceNote: string;
  createdAt: string;
}
export interface ProjectTravelHistoryRow extends ProjectTravel {
  storySequence: number;
  storyEventTitle: string;
}
export interface ProjectEventCoordinate {
  projectId: string;
  eventId: string;
  ordinal: number;
  coordinateRole: "occurrence" | "departure" | "arrival" | "waypoint";
  spaceId: string;
  localTime: string;
  branchId: string | null;
  description: string;
}
export interface ProjectEntityInstance {
  id: string;
  projectId: string;
  entityId: string;
  spaceId: string | null;
  branchId: string | null;
  instanceKind: "temporal_self" | "separate_body" | "projection" | "other";
  appearedEventId: string | null;
  endedEventId: string | null;
  description: string;
  createdAt: string;
}

const worldSpaceFromRow = (r: Record<string, unknown>): ProjectWorldSpace => ({
  id: r.id as string,
  projectId: r.project_id as string,
  name: r.name as string,
  kind: r.kind as ProjectSpaceKind,
  parentSpaceId: r.parent_space_id as string | null,
  sourceCorpusId: r.source_corpus_id as string | null,
  description: r.description as string,
  createdAt: r.created_at as string,
});
const sourceIdentityFromRow = (r: Record<string, unknown>): ProjectSourceIdentity => ({
  projectId: r.project_id as string,
  entityId: r.entity_id as string,
  corpusId: r.corpus_id as string,
  sourceKey: r.source_key as string,
  linkKind: r.link_kind as ProjectSourceIdentity["linkKind"],
  confidence: r.confidence as number | null,
  sourceNote: r.source_note as string,
  createdAt: r.created_at as string,
});
const travelFromRow = (r: Record<string, unknown>): ProjectTravel => ({
  id: r.id as string,
  projectId: r.project_id as string,
  eventId: r.event_id as string,
  travelerEntityId: r.traveler_entity_id as string,
  fromSpaceId: r.from_space_id as string,
  toSpaceId: r.to_space_id as string,
  departureTime: r.departure_time as string,
  arrivalTime: r.arrival_time as string,
  fromBranchId: r.from_branch_id as string | null,
  toBranchId: r.to_branch_id as string | null,
  travelKind: r.travel_kind as ProjectTravelKind,
  mechanismEntityId: r.mechanism_entity_id as string | null,
  consequenceNote: r.consequence_note as string,
  createdAt: r.created_at as string,
});

/**
 * One novel has one NarraLume Project Reality.
 * Source corpora, universes, local times and possible temporal branches are
 * NOT projects. None of these operations adopt a source fact as Canon.
 */
export class SqliteProjectWorldRepository {
  constructor(private readonly db: NarrativeDatabase) {}

  createSpace(space: ProjectWorldSpace): void {
    if (space.sourceCorpusId) {
      const bound = this.db.raw.prepare(`
        SELECT 1 FROM project_source_bindings
        WHERE project_id=? AND corpus_id=? AND enabled=1
      `).get(space.projectId, space.sourceCorpusId);
      if (!bound)
        throw new Error("world.source_not_bound");
    }
    this.db.raw.prepare(`
      INSERT INTO project_world_spaces (
        id,project_id,name,kind,parent_space_id,source_corpus_id,description,created_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `).run(space.id,space.projectId,space.name,space.kind,
      space.parentSpaceId,space.sourceCorpusId,space.description,space.createdAt);
  }

  listSpaces(projectId: string): ProjectWorldSpace[] {
    return (this.db.raw.prepare(`
      SELECT * FROM project_world_spaces WHERE project_id=? ORDER BY kind,name,id
    `).all(projectId) as Array<Record<string,unknown>>).map(worldSpaceFromRow);
  }

  linkSourceEntity(link: ProjectSourceIdentity): void {
    // Binding + source FK is enforced in SQL. Disabled corpora cannot be
    // freshly linked, but existing traceability remains for older material.
    const bound = this.db.raw.prepare(`
      SELECT enabled FROM project_source_bindings
      WHERE project_id=? AND corpus_id=?
    `).get(link.projectId,link.corpusId) as {enabled:number}|undefined;
    if (bound?.enabled!==1)
      throw new Error("world.source_not_bound");
    this.db.raw.prepare(`
      INSERT INTO project_source_entity_links(
        project_id,entity_id,corpus_id,source_key,link_kind,
        confidence,source_note,created_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `).run(link.projectId,link.entityId,link.corpusId,link.sourceKey,
      link.linkKind,link.confidence,link.sourceNote,link.createdAt);
  }

  listSourceLinks(projectId: string, entityId: string): ProjectSourceIdentity[] {
    return (this.db.raw.prepare(`
      SELECT * FROM project_source_entity_links
      WHERE project_id=? AND entity_id=?
      ORDER BY corpus_id,source_key,link_kind
    `).all(projectId,entityId) as Array<Record<string,unknown>>)
      .map(sourceIdentityFromRow);
  }

  attachEntityToSpace(input: {
    projectId: string;
    entityId: string;
    spaceId: string;
    linkKind: "origin" | "home" | "affiliated" | "world_rule_scope" | "other";
    sourceNote: string;
    createdAt: string;
  }): void {
    this.db.raw.prepare(`
      INSERT INTO project_entity_space_links(
        project_id,entity_id,space_id,link_kind,source_note,created_at
      ) VALUES (?,?,?,?,?,?)
    `).run(input.projectId,input.entityId,input.spaceId,
      input.linkKind,input.sourceNote,input.createdAt);
  }

  createBranch(branch: ProjectTimeBranch): void {
    // Only explicit author/world-law input calls this. Travel never does.
    this.db.raw.prepare(`
      INSERT INTO project_time_branches(
        id,project_id,name,parent_branch_id,divergence_event_id,
        causal_rule,created_at
      ) VALUES (?,?,?,?,?,?,?)
    `).run(branch.id,branch.projectId,branch.name,branch.parentBranchId,
      branch.divergenceEventId,branch.causalRule,branch.createdAt);
  }

  recordEventCoordinate(position: ProjectEventCoordinate): void {
    this.db.raw.prepare(`
      INSERT INTO project_event_coordinates(
        project_id,event_id,ordinal,coordinate_role,
        space_id,local_time,branch_id,description
      ) VALUES (?,?,?,?,?,?,?,?)
    `).run(position.projectId,position.eventId,position.ordinal,
      position.coordinateRole,position.spaceId,position.localTime,
      position.branchId,position.description);
  }

  listEventCoordinates(projectId: string, eventId: string): ProjectEventCoordinate[] {
    const rows = this.db.raw.prepare(`
      SELECT project_id,event_id,ordinal,coordinate_role,space_id,local_time,
             branch_id,description FROM project_event_coordinates
      WHERE project_id=? AND event_id=? ORDER BY ordinal
    `).all(projectId,eventId) as Array<Record<string,unknown>>;
    return rows.map(r=>({
      projectId:r.project_id as string,eventId:r.event_id as string,
      ordinal:r.ordinal as number,
      coordinateRole:r.coordinate_role as ProjectEventCoordinate["coordinateRole"],
      spaceId:r.space_id as string,localTime:r.local_time as string,
      branchId:r.branch_id as string|null,description:r.description as string,
    }));
  }

  recordTravel(travel: ProjectTravel): void {
    this.db.transaction(()=>{
      this.db.raw.prepare(`
        INSERT INTO project_travel_events(
          id,project_id,event_id,traveler_entity_id,
          from_space_id,to_space_id,departure_time,arrival_time,
          from_branch_id,to_branch_id,travel_kind,mechanism_entity_id,
          consequence_note,created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(travel.id,travel.projectId,travel.eventId,travel.travelerEntityId,
        travel.fromSpaceId,travel.toSpaceId,travel.departureTime,travel.arrivalTime,
        travel.fromBranchId,travel.toBranchId,travel.travelKind,
        travel.mechanismEntityId,travel.consequenceNote,travel.createdAt);
      // No automatic new branch or Canon status write. These are the same
      // transition's distinct local clocks; story sequence is timeline_events.
      this.recordEventCoordinate({
        projectId:travel.projectId,eventId:travel.eventId,ordinal:0,
        coordinateRole:"departure",spaceId:travel.fromSpaceId,
        localTime:travel.departureTime,branchId:travel.fromBranchId,
        description:"departure",
      });
      this.recordEventCoordinate({
        projectId:travel.projectId,eventId:travel.eventId,ordinal:1,
        coordinateRole:"arrival",spaceId:travel.toSpaceId,
        localTime:travel.arrivalTime,branchId:travel.toBranchId,
        description:"arrival",
      });
    });
  }

  listTravelerHistory(projectId:string, travelerEntityId:string):ProjectTravelHistoryRow[] {
    const rows = this.db.raw.prepare(`
      SELECT travel.*, event.sequence AS story_sequence,
             event.title AS story_event_title
      FROM project_travel_events travel
      JOIN timeline_events event ON event.id=travel.event_id
      WHERE travel.project_id=? AND travel.traveler_entity_id=?
      ORDER BY event.sequence, event.created_at, travel.id
    `).all(projectId,travelerEntityId) as Array<Record<string,unknown>>;
    return rows.map(row=>({
      ...travelFromRow(row),
      storySequence:row.story_sequence as number,
      storyEventTitle:row.story_event_title as string,
    }));
  }

  registerInstance(instance: ProjectEntityInstance):void {
    // No auto-duplication at each flashback; this exists only for an
    // explicitly distinct simultaneous body/temporal self.
    this.db.raw.prepare(`
      INSERT INTO project_entity_instances(
        id,project_id,entity_id,space_id,branch_id,instance_kind,
        appeared_event_id,ended_event_id,description,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(instance.id,instance.projectId,instance.entityId,
      instance.spaceId,instance.branchId,instance.instanceKind,
      instance.appearedEventId,instance.endedEventId,
      instance.description,instance.createdAt);
  }

  listEntityInstances(projectId:string,entityId:string):ProjectEntityInstance[] {
    const rows=this.db.raw.prepare(`
      SELECT * FROM project_entity_instances
      WHERE project_id=? AND entity_id=? ORDER BY created_at,id
    `).all(projectId,entityId) as Array<Record<string,unknown>>;
    return rows.map(r=>({
      id:r.id as string,projectId:r.project_id as string,
      entityId:r.entity_id as string,spaceId:r.space_id as string|null,
      branchId:r.branch_id as string|null,
      instanceKind:r.instance_kind as ProjectEntityInstance["instanceKind"],
      appearedEventId:r.appeared_event_id as string|null,
      endedEventId:r.ended_event_id as string|null,
      description:r.description as string,createdAt:r.created_at as string,
    }));
  }
}
