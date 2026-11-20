import { z } from "zod";
import {
  SqliteProjectRepository,
  SqliteProjectWorldRepository,
  SqliteProjectForkRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import type { RouteApp } from "./route-app.js";
import { ServiceError } from "./service-error.js";
import { randomUuid } from "./internal/crypto.js";

const Params = z.object({ projectId: z.string().min(1) });
const SubjectParams = Params.extend({ entityId: z.string().min(1) });
const EventParams = Params.extend({ eventId: z.string().min(1) });

const SpaceBody = z.object({
  name: z.string().trim().min(1).max(300),
  kind: z.enum(["realm", "region", "site", "dimension", "other"]),
  parentSpaceId: z.string().min(1).nullable().default(null),
  sourceCorpusId: z.string().min(1).nullable().default(null),
  description: z.string().default(""),
});
const SourceIdentityBody = z.object({
  entityId: z.string().min(1),
  corpusId: z.string().min(1),
  sourceKey: z.string().min(1),
  linkKind: z.enum([
    "counterpart",
    "adaptation",
    "inspiration",
    "possible_match",
    "alias",
  ]),
  confidence: z.number().min(0).max(1).nullable().default(null),
  sourceNote: z.string().default(""),
});
const TravelBody = z.object({
  eventId: z.string().min(1),
  travelerEntityId: z.string().min(1),
  fromSpaceId: z.string().min(1),
  toSpaceId: z.string().min(1),
  departureTime: z.string().min(1),
  arrivalTime: z.string().min(1),
  fromBranchId: z.string().min(1).nullable().default(null),
  toBranchId: z.string().min(1).nullable().default(null),
  travelKind: z.enum([
    "spatial",
    "cross_world",
    "time_travel",
    "cross_world_time",
  ]),
  mechanismEntityId: z.string().min(1).nullable().default(null),
  consequenceNote: z.string().default(""),
});
const BranchBody = z.object({
  name: z.string().trim().min(1),
  parentBranchId: z.string().min(1).nullable().default(null),
  divergenceEventId: z.string().min(1).nullable().default(null),
  causalRule: z.string().default(""),
});
const CharacterCoreBody = z.object({
  sourceCorpusId: z.string().min(1).nullable().default(null),
  sourceKey: z.string().min(1).nullable().default(null),
  tags: z.array(z.string().trim().min(1)).min(1),
  decisionPattern: z.string().trim().min(1),
  sourceNote: z.string().trim().min(1),
});
const ForkFieldBody = z.object({
  sourceCorpusId: z.string().min(1),
  sourceKey: z.string().min(1),
  sourceJsonPath: z.string().startsWith("$").min(2),
  projectPredicate: z.string().trim().min(1),
  sourceNote: z.string().default(""),
});
const InstanceBody = z.object({
  entityId: z.string().min(1),
  spaceId: z.string().min(1).nullable().default(null),
  branchId: z.string().min(1).nullable().default(null),
  instanceKind: z.enum([
    "temporal_self",
    "separate_body",
    "projection",
    "other",
  ]),
  appearedEventId: z.string().min(1).nullable().default(null),
  endedEventId: z.string().min(1).nullable().default(null),
  description: z.string().default(""),
});

/** Author-facing database operations, not a game runtime.
 * The endpoints only attach project-created state to pre-existing NarraLume
 * Canon and Timeline IDs. They never adopt source material as a confirmed fact.
 */
export function registerProjectWorldRoutes(
  app: RouteApp,
  db: NarrativeDatabase,
): void {
  const worlds = new SqliteProjectWorldRepository(db);
  const forks = new SqliteProjectForkRepository(db);
  const projects = new SqliteProjectRepository(db);
  const requireProject = (id: string): void => {
    if (!projects.get(id))
      throw new ServiceError("project.not_found", "Project not found", 404);
  };
  const requireEntity = (projectId: string, entityId: string): void => {
    const row = db.raw
      .prepare("SELECT id FROM canon_entities WHERE project_id=? AND id=?")
      .get(projectId, entityId);
    if (!row)
      throw new ServiceError(
        "world.entity.not_found",
        "Entity not in this project",
        404,
      );
  };
  const requireEvent = (projectId: string, eventId: string): void => {
    const row = db.raw
      .prepare("SELECT id FROM timeline_events WHERE project_id=? AND id=?")
      .get(projectId, eventId);
    if (!row)
      throw new ServiceError(
        "world.event.not_found",
        "Event not in this project",
        404,
      );
  };
  const now = () => new Date().toISOString();

  // Fork is a read-time comparison against native Project Canon.
  // Source baselines and character cores are explicit author inputs, never
  // extracted from novel outcomes or rewritten by a model's chapter draft.
  app.route(
    "GET",
    "/api/projects/:projectId/world-fork/:entityId",
    async (request) => {
      const { projectId, entityId } = SubjectParams.parse(request.params);
      requireProject(projectId);
      requireEntity(projectId, entityId);
      return forks.diffEntity(projectId, entityId);
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/world-fork/:entityId/core",
    async (request) => {
      const { projectId, entityId } = SubjectParams.parse(request.params);
      requireProject(projectId);
      requireEntity(projectId, entityId);
      const body = CharacterCoreBody.parse(request.body);
      const anchor = { projectId, entityId, ...body, createdAt: now() };
      forks.createCharacterCore(anchor);
      return { status: 201, body: anchor };
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/world-fork/:entityId/source-fields",
    async (request) => {
      const { projectId, entityId } = SubjectParams.parse(request.params);
      requireProject(projectId);
      requireEntity(projectId, entityId);
      const body = ForkFieldBody.parse(request.body);
      const binding = {
        id: randomUuid(),
        projectId,
        entityId,
        ...body,
        createdAt: now(),
      };
      forks.bindSourceField(binding);
      return { status: 201, body: binding };
    },
  );

  app.route("GET", "/api/projects/:projectId/world-spaces", async (request) => {
    const { projectId } = Params.parse(request.params);
    requireProject(projectId);
    return worlds.listSpaces(projectId);
  });
  app.route(
    "POST",
    "/api/projects/:projectId/world-spaces",
    async (request) => {
      const { projectId } = Params.parse(request.params);
      requireProject(projectId);
      const body = SpaceBody.parse(request.body);
      const space = { id: randomUuid(), projectId, createdAt: now(), ...body };
      worlds.createSpace(space);
      return { status: 201, body: space };
    },
  );
  app.route(
    "GET",
    "/api/projects/:projectId/world-source-links/:entityId",
    async (request) => {
      const { projectId, entityId } = SubjectParams.parse(request.params);
      requireProject(projectId);
      requireEntity(projectId, entityId);
      return worlds.listSourceLinks(projectId, entityId);
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/world-source-links",
    async (request) => {
      const { projectId } = Params.parse(request.params);
      requireProject(projectId);
      const body = SourceIdentityBody.parse(request.body);
      requireEntity(projectId, body.entityId);
      const link = { ...body, projectId, createdAt: now() };
      worlds.linkSourceEntity(link);
      return { status: 201, body: link };
    },
  );
  app.route(
    "GET",
    "/api/projects/:projectId/world-travel/:entityId",
    async (request) => {
      const { projectId, entityId } = SubjectParams.parse(request.params);
      requireProject(projectId);
      requireEntity(projectId, entityId);
      return worlds.listTravelerHistory(projectId, entityId);
    },
  );
  app.route(
    "GET",
    "/api/projects/:projectId/world-event-coordinates/:eventId",
    async (request) => {
      const { projectId, eventId } = EventParams.parse(request.params);
      requireProject(projectId);
      requireEvent(projectId, eventId);
      return worlds.listEventCoordinates(projectId, eventId);
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/world-travel",
    async (request) => {
      const { projectId } = Params.parse(request.params);
      requireProject(projectId);
      const body = TravelBody.parse(request.body);
      requireEntity(projectId, body.travelerEntityId);
      requireEvent(projectId, body.eventId);
      if (body.mechanismEntityId)
        requireEntity(projectId, body.mechanismEntityId);
      const travel = { ...body, projectId, id: randomUuid(), createdAt: now() };
      worlds.recordTravel(travel);
      return { status: 201, body: travel };
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/world-time-branches",
    async (request) => {
      const { projectId } = Params.parse(request.params);
      requireProject(projectId);
      const body = BranchBody.parse(request.body);
      if (body.divergenceEventId)
        requireEvent(projectId, body.divergenceEventId);
      const branch = { ...body, id: randomUuid(), projectId, createdAt: now() };
      worlds.createBranch(branch);
      return { status: 201, body: branch };
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/world-entity-instances",
    async (request) => {
      const { projectId } = Params.parse(request.params);
      requireProject(projectId);
      const body = InstanceBody.parse(request.body);
      requireEntity(projectId, body.entityId);
      if (body.appearedEventId) requireEvent(projectId, body.appearedEventId);
      if (body.endedEventId) requireEvent(projectId, body.endedEventId);
      const instance = {
        ...body,
        id: randomUuid(),
        projectId,
        createdAt: now(),
      };
      worlds.registerInstance(instance);
      return { status: 201, body: instance };
    },
  );
  app.route(
    "GET",
    "/api/projects/:projectId/world-entity-instances/:entityId",
    async (request) => {
      const { projectId, entityId } = SubjectParams.parse(request.params);
      requireProject(projectId);
      requireEntity(projectId, entityId);
      return worlds.listEntityInstances(projectId, entityId);
    },
  );
}
