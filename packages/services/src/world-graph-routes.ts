import type {
  CanonEntity,
  CanonFact,
  RelationshipEvent,
} from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRepository,
  SqliteStoryRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import { z } from "zod";
import {
  getRelLabel,
  getInverseLabel,
} from "./vendor/campaignrepo/relationships.js";
import type { RouteApp } from "./route-app.js";
import { ServiceError } from "./service-error.js";

export interface WorldGraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  relationLabel: string;
  inverseLabel: string;
  description: string;
  source: "relationship" | "fact";
}

export interface WorldGraphView {
  nodes: CanonEntity[];
  edges: WorldGraphEdge[];
  ongoingActivities: Array<{
    id: string;
    actorId: string;
    detail: unknown;
    sourceId: string | null;
  }>;
}

export function projectWorldGraph(
  entities: readonly CanonEntity[],
  facts: readonly CanonFact[],
  relationships: readonly RelationshipEvent[],
  centerId?: string,
  maxHops = 2,
): WorldGraphView {
  const available = new Map(
    entities.filter((e) => e.status === "active").map((e) => [e.id, e]),
  );
  const edges: WorldGraphEdge[] = [];

  for (const relationship of relationships) {
    if (
      !available.has(relationship.fromEntityId) ||
      !available.has(relationship.toEntityId)
    )
      continue;
    edges.push({
      id: relationship.id,
      from: relationship.fromEntityId,
      to: relationship.toEntityId,
      relation: relationship.relation,
      relationLabel: getRelLabel(relationship.relation),
      inverseLabel: getInverseLabel(relationship.relation),
      description:
        typeof relationship.state.description === "string"
          ? relationship.state.description
          : "",
      source: "relationship",
    });
  }

  for (const fact of facts) {
    if (
      !fact.objectEntityId ||
      !available.has(fact.subjectId) ||
      !available.has(fact.objectEntityId)
    )
      continue;
    edges.push({
      id: fact.id,
      from: fact.subjectId,
      to: fact.objectEntityId,
      relation: fact.predicate,
      relationLabel: getRelLabel(fact.predicate),
      inverseLabel: getInverseLabel(fact.predicate),
      description: typeof fact.value === "string" ? fact.value : "",
      source: "fact",
    });
  }

  let selected: Set<string>;
  if (centerId) {
    if (!available.has(centerId))
      return { nodes: [], edges: [], ongoingActivities: [] };
    selected = new Set([centerId]);
    let frontier = new Set([centerId]);
    for (let depth = 0; depth < maxHops; depth++) {
      const next = new Set<string>();
      for (const edge of edges) {
        if (frontier.has(edge.from) && !selected.has(edge.to))
          next.add(edge.to);
        if (frontier.has(edge.to) && !selected.has(edge.from))
          next.add(edge.from);
      }
      for (const id of next) selected.add(id);
      frontier = next;
      if (!frontier.size) break;
    }
  } else {
    selected = new Set(available.keys());
  }

  return {
    nodes: [...selected].map((id) => available.get(id)!).filter(Boolean),
    edges: edges.filter(
      (edge) => selected.has(edge.from) && selected.has(edge.to),
    ),
    ongoingActivities: facts
      .filter(
        (fact) =>
          fact.predicate === "world.ongoing_activity" &&
          selected.has(fact.subjectId) &&
          (fact.value === null ||
            typeof fact.value !== "object" ||
            !("stage" in fact.value) ||
            fact.value.stage === "ongoing"),
      )
      .map((fact) => ({
        id: fact.id,
        actorId: fact.subjectId,
        detail: fact.value,
        sourceId: fact.sourceId,
      })),
  };
}

export function registerWorldGraphRoutes(
  app: RouteApp,
  database: NarrativeDatabase,
): void {
  const projects = new SqliteProjectRepository(database);
  const canon = new SqliteCanonRepository(database);
  const story = new SqliteStoryRepository(database);
  const state = new SqliteNarrativeStateRepository(database, canon, story);
  const querySchema = z.object({
    centerId: z.string().min(1).optional(),
    hops: z.coerce.number().int().min(0).max(3).default(2),
  });
  app.route("GET", "/api/projects/:projectId/world-graph", async (request) => {
    const { projectId } = z
      .object({ projectId: z.string().min(1) })
      .parse(request.params);
    if (!projects.get(projectId))
      throw new ServiceError("project.not_found", "Project not found", 404);
    const input = querySchema.parse(request.query);
    return projectWorldGraph(
      canon.listEntities(projectId),
      canon.listEffectiveFacts(projectId),
      state.listCurrentRelationships(projectId),
      input.centerId,
      input.hops,
    );
  });
}
