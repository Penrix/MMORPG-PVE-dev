import { z } from "zod";
import {
  WORLD_ATLAS_CARD_TYPES,
  WORLD_ATLAS_CONTENT_FAMILIES,
  WORLD_ATLAS_NARRATIVE_AXIS,
  WORLD_ATLAS_RELATIONS,
  WorldAtlasCardKindSchema,
} from "@narralume/contracts";
import {
  SqliteProjectRepository,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import type { RouteApp } from "./route-app.js";
import { ServiceError } from "./service-error.js";

const WorldParams = z.object({ worldId: z.string().min(1) });
const EntityParams = WorldParams.extend({ entityKey: z.string().min(1) });
const ProjectParams = WorldParams.extend({ projectId: z.string().min(1) });
const CreateWorldBody = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,100}$/),
  name: z.string().trim().min(1),
  kind: z.enum(["fictional", "historical", "era", "original_reference"]),
  description: z.string().default(""),
});
const AddCorpusBody = z.object({
  corpusId: z.string().min(1),
  evidenceRole: z.enum([
    "primary",
    "supporting",
    "alternate_version",
    "historical",
    "other",
  ]),
  sourceNote: z.string().default(""),
});
const AdoptBody = z.object({
  canonicalKey: z.string().min(1),
  evidenceCorpusId: z.string().min(1),
  evidenceKey: z.string().min(1),
  matchKind: z
    .enum([
      "same_identity",
      "possible_match",
      "source_adaptation",
      "related_not_same",
    ])
    .default("same_identity"),
  reviewStatus: z
    .enum(["candidate", "verified", "rejected"])
    .default("candidate"),
  sourceNote: z.string().trim().min(1),
});
const LinkBody = AdoptBody.omit({ canonicalKey: true });
const SourceKindSchema = WorldAtlasCardKindSchema;
const CardQuery = z.object({
  q: z.string().default(""),
  kind: SourceKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});
const CreateCardBody = z.object({
  entityKey: z.string().trim().min(1).max(300),
  kind: SourceKindSchema,
  name: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().trim().min(1).max(300)).default([]),
  content: z.string().trim().min(1).max(200_000),
});
const UpdateCardBody = CreateCardBody.omit({ entityKey: true });

/** Global source-world wiki: one Naruto identity, many evidence datasets.
 * No operation here writes a novel's Canon/Timeline, nor merges two raw
 * people by name. Authors explicitly choose corresponding source records.
 */
export function registerUnifiedSourceWorldRoutes(
  app: RouteApp,
  db: NarrativeDatabase,
): void {
  const worlds = new SqliteUnifiedSourceWorldRepository(db);
  const sources = new SqliteSourceCorpusRepository(db);
  const projects = new SqliteProjectRepository(db);
  const requireWorld = (id: string) => {
    const world = worlds.getWorld(id);
    if (!world)
      throw new ServiceError(
        "source.world.not_found",
        "World wiki not found",
        404,
      );
    return world;
  };
  const now = () => new Date().toISOString();

  app.route("GET", "/api/source-worlds", async () => worlds.listWorlds());
  app.route("GET", "/api/source-worlds/framework", async () => ({
    version: "0.1",
    contentFamilies: WORLD_ATLAS_CONTENT_FAMILIES,
    narrativeAxis: WORLD_ATLAS_NARRATIVE_AXIS,
    cardTypes: WORLD_ATLAS_CARD_TYPES,
    relations: WORLD_ATLAS_RELATIONS,
  }));
  app.route("POST", "/api/source-worlds", async (request) => {
    const body = CreateWorldBody.parse(request.body);
    const world = {
      id: body.id,
      name: body.name,
      kind: body.kind,
      description: body.description,
      canonicalCorpusId: "wiki:" + body.id,
      createdAt: now(),
    };
    db.transaction(() => {
      sources.upsertCorpus({
        id: world.canonicalCorpusId,
        title: body.name + "：整理版原生百科",
        sourceUrl: "",
        rightsNotice: "Source evidence retains its original licenses",
        importer: "curated-original-world-wiki",
        metadata: { worldId: world.id },
        importedAt: world.createdAt,
      });
      worlds.createWorld(world);
    });
    return { status: 201, body: world };
  });
  app.route("GET", "/api/source-worlds/:worldId", async (request) => {
    const { worldId } = WorldParams.parse(request.params);
    return requireWorld(worldId);
  });

  app.route("GET", "/api/source-worlds/:worldId/cards", async (request) => {
    const { worldId } = WorldParams.parse(request.params);
    requireWorld(worldId);
    const query = CardQuery.parse(request.query);
    return worlds.listCards(worldId, query.q, {
      ...(query.kind ? { kind: query.kind } : {}),
      limit: query.limit,
      offset: query.offset,
    });
  });
  app.route("POST", "/api/source-worlds/:worldId/cards", async (request) => {
    const { worldId } = WorldParams.parse(request.params);
    requireWorld(worldId);
    const body = CreateCardBody.parse(request.body);
    const result = worlds.upsertCard({
      worldId,
      ...body,
      now: now(),
    });
    return { status: 201, body: result };
  });
  app.route(
    "GET",
    "/api/source-worlds/:worldId/cards/:entityKey",
    async (request) => {
      const { worldId, entityKey } = EntityParams.parse(request.params);
      requireWorld(worldId);
      const card = worlds.getCard(worldId, entityKey);
      if (!card)
        throw new ServiceError(
          "source.world.card_not_found",
          "World Atlas card not found",
          404,
        );
      return card;
    },
  );
  app.route(
    "PUT",
    "/api/source-worlds/:worldId/cards/:entityKey",
    async (request) => {
      const { worldId, entityKey } = EntityParams.parse(request.params);
      requireWorld(worldId);
      const body = UpdateCardBody.parse(request.body);
      return worlds.upsertCard({
        worldId,
        entityKey,
        ...body,
        now: now(),
      });
    },
  );
  app.route(
    "POST",
    "/api/source-worlds/:worldId/cards/:entityKey/reindex",
    async (request) => {
      const { worldId, entityKey } = EntityParams.parse(request.params);
      requireWorld(worldId);
      const unresolvedLinks = worlds.reindexCard(worldId, entityKey);
      const card = worlds.getCard(worldId, entityKey);
      if (!card)
        throw new ServiceError(
          "source.world.card_not_found",
          "World Atlas card not found",
          404,
        );
      return { card, unresolvedLinks };
    },
  );
  app.route(
    "POST",
    "/api/source-worlds/:worldId/evidence-corpora",
    async (request) => {
      const { worldId } = WorldParams.parse(request.params);
      requireWorld(worldId);
      const input = AddCorpusBody.parse(request.body);
      worlds.addEvidenceCorpus({ worldId, ...input });
      return { status: 201, body: { worldId, ...input } };
    },
  );
  app.route(
    "POST",
    "/api/source-worlds/:worldId/entities/from-evidence",
    async (request) => {
      const { worldId } = WorldParams.parse(request.params);
      requireWorld(worldId);
      const input = AdoptBody.parse(request.body);
      const result = db.transaction(() => {
        const record = worlds.createCanonicalFromEvidence({
          worldId,
          canonicalKey: input.canonicalKey,
          evidenceCorpusId: input.evidenceCorpusId,
          evidenceKey: input.evidenceKey,
          sourceNote: input.sourceNote,
          now: now(),
        });
        worlds.linkEvidence({
          worldId,
          ...input,
          createdAt: now(),
        });
        return record;
      });
      return { status: 201, body: result };
    },
  );
  app.route(
    "POST",
    "/api/source-worlds/:worldId/entities/:entityKey/evidence",
    async (request) => {
      const { worldId, entityKey } = EntityParams.parse(request.params);
      requireWorld(worldId);
      const input = LinkBody.parse(request.body);
      worlds.linkEvidence({
        worldId,
        canonicalKey: entityKey,
        ...input,
        createdAt: now(),
      });
      return {
        status: 201,
        body: { worldId, canonicalKey: entityKey, ...input },
      };
    },
  );
  app.route(
    "GET",
    "/api/source-worlds/:worldId/entities/:entityKey",
    async (request) => {
      const { worldId, entityKey } = EntityParams.parse(request.params);
      const dossier = worlds.getDossier(worldId, entityKey);
      if (!dossier)
        throw new ServiceError(
          "source.world.entity_not_found",
          "Original-world wiki entity not found",
          404,
        );
      return dossier;
    },
  );
  app.route(
    "POST",
    "/api/projects/:projectId/source-worlds/:worldId",
    async (request) => {
      const { projectId, worldId } = ProjectParams.parse(request.params);
      if (!projects.get(projectId))
        throw new ServiceError(
          "project.not_found",
          "Novel project not found",
          404,
        );
      const world = requireWorld(worldId);
      sources.bindProject(projectId, world.canonicalCorpusId);
      return { projectId, worldId, canonicalCorpusId: world.canonicalCorpusId };
    },
  );
  app.route(
    "GET",
    "/api/projects/:projectId/source-worlds/:worldId/:entityKey",
    async (request) => {
      const { projectId, worldId, entityKey } = ProjectParams.extend({
        entityKey: z.string().min(1),
      }).parse(request.params);
      const world = requireWorld(worldId);
      const attached = sources
        .listProjectCorpora(projectId)
        .some((corpus) => corpus.id === world.canonicalCorpusId);
      if (!attached)
        throw new ServiceError(
          "source.not_bound",
          "World wiki not attached to this novel",
          404,
        );
      const dossier = worlds.getDossier(worldId, entityKey);
      if (!dossier)
        throw new ServiceError(
          "source.world.entity_not_found",
          "World wiki entity not found",
          404,
        );
      return dossier;
    },
  );
}
