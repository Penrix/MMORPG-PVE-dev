import { z } from "zod";
import type { NarrativeDatabase } from "@narralume/persistence";
import {
  SqliteProjectRepository,
  SqliteSourceCorpusRepository,
  SqliteMotherWorldEncyclopediaRepository,
} from "@narralume/persistence";
import type { RouteApp } from "./route-app.js";
import { ServiceError } from "./service-error.js";

const ProjectParams = z.object({ projectId: z.string().min(1) });
const SourceParams = ProjectParams.extend({ corpusId: z.string().min(1) });
const RecordParams = SourceParams.extend({ sourceKey: z.string().min(1) });
const SearchQuery = z.object({
  q: z.string().default(""),
  kind: z
    .enum([
      "character",
      "organization",
      "location",
      "ability",
      "creature",
      "item",
      "event",
      "other",
    ])
    .optional(),
  corpusId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
const Binding = z.object({ enabled: z.boolean().default(true) });

/** Reference lookups are expressly NOT Canon adoption. They can return
 * Naruto's entire future while project Reality stays in its chosen era. */
export function registerSourceCorpusRoutes(
  app: RouteApp,
  db: NarrativeDatabase,
): void {
  const repo = new SqliteSourceCorpusRepository(db);
  const wiki = new SqliteMotherWorldEncyclopediaRepository(db);
  const projects = new SqliteProjectRepository(db);
  const requireProject = (projectId: string): void => {
    if (!projects.get(projectId))
      throw new ServiceError("project.not_found", "Project not found", 404);
  };
  const requireBound = (projectId: string, corpusId: string): void => {
    requireProject(projectId);
    if (
      !repo
        .listProjectCorpora(projectId)
        .some((corpus) => corpus.id === corpusId)
    )
      throw new ServiceError(
        "source.not_bound",
        "Source corpus not attached to project",
        404,
      );
  };

  app.route("GET", "/api/source-corpora", async () => repo.listCorpora());

  const MotherParams = z.object({
    corpusId: z.string().min(1),
    sourceKey: z.string().min(1),
  });
  const LoreBody = z.object({
    sectionKey: z.string().trim().min(1),
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    sourceUrl: z.string().default(""),
    sourcePointer: z.string().default(""),
    sourceNote: z.string().trim().min(1),
  });
  const AbilityBody = z.object({
    powerMode: z.enum(["ordinary", "supernatural"]),
    mechanism: z.string().default(""),
    actualEffects: z.string().default(""),
    acquisition: z.string().default(""),
    progression: z.string().default(""),
    combinations: z.string().default(""),
    constraints: z.string().default(""),
    counters: z.string().default(""),
    socialValue: z.string().default(""),
    era: z.string().default(""),
    sourceNote: z.string().trim().min(1),
  });
  const OrganizationBody = z.object({
    organizationForm: z.string().default(""),
    governance: z.string().default(""),
    succession: z.string().default(""),
    duties: z.string().default(""),
    jurisdiction: z.string().default(""),
    assetsAndIncome: z.string().default(""),
    internalFactions: z.string().default(""),
    ordinaryLife: z.string().default(""),
    era: z.string().default(""),
    sourceNote: z.string().trim().min(1),
  });
  const ensureMotherRecord = (corpusId: string, sourceKey: string): void => {
    if (!repo.getRecord(corpusId, sourceKey))
      throw new ServiceError(
        "source.record.not_found",
        "Mother-world record not found",
        404,
      );
  };
  // Mother-wiki records are independent of any novel Project. Reference
  // assertions are never adopted as Project Canon via these routes.
  app.route(
    "GET",
    "/api/source-corpora/:corpusId/encyclopedia/:sourceKey",
    async (request) => {
      const { corpusId, sourceKey } = MotherParams.parse(request.params);
      ensureMotherRecord(corpusId, sourceKey);
      return wiki.getDossier(corpusId, sourceKey);
    },
  );
  app.route(
    "POST",
    "/api/source-corpora/:corpusId/encyclopedia/:sourceKey/sections",
    async (request) => {
      const { corpusId, sourceKey } = MotherParams.parse(request.params);
      ensureMotherRecord(corpusId, sourceKey);
      const data = LoreBody.parse(request.body);
      const update = {
        corpusId,
        sourceKey,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      wiki.upsertLore(update);
      return { status: 201, body: update };
    },
  );
  app.route(
    "POST",
    "/api/source-corpora/:corpusId/encyclopedia/:sourceKey/ability",
    async (request) => {
      const { corpusId, sourceKey } = MotherParams.parse(request.params);
      ensureMotherRecord(corpusId, sourceKey);
      const data = AbilityBody.parse(request.body);
      const update = {
        corpusId,
        sourceKey,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      wiki.upsertAbility(update);
      return { status: 201, body: update };
    },
  );
  app.route(
    "POST",
    "/api/source-corpora/:corpusId/encyclopedia/:sourceKey/organization",
    async (request) => {
      const { corpusId, sourceKey } = MotherParams.parse(request.params);
      ensureMotherRecord(corpusId, sourceKey);
      const data = OrganizationBody.parse(request.body);
      const update = {
        corpusId,
        sourceKey,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      wiki.upsertOrganization(update);
      return { status: 201, body: update };
    },
  );
  app.route(
    "GET",
    "/api/projects/:projectId/source-encyclopedia/:corpusId/:sourceKey",
    async (request) => {
      const { projectId, corpusId, sourceKey } = RecordParams.parse(
        request.params,
      );
      requireBound(projectId, corpusId);
      const dossier = wiki.getDossier(corpusId, sourceKey);
      if (!dossier)
        throw new ServiceError(
          "source.record.not_found",
          "Mother-world record not found",
          404,
        );
      return dossier;
    },
  );

  app.route(
    "GET",
    "/api/projects/:projectId/source-corpora",
    async (request) => {
      const { projectId } = ProjectParams.parse(request.params);
      requireProject(projectId);
      return repo.listProjectCorpora(projectId);
    },
  );

  app.route(
    "POST",
    "/api/projects/:projectId/source-corpora/:corpusId",
    async (request) => {
      const { projectId, corpusId } = SourceParams.parse(request.params);
      requireProject(projectId);
      if (!repo.getCorpus(corpusId))
        throw new ServiceError(
          "source.not_found",
          "Source corpus not installed",
          404,
        );
      const { enabled } = Binding.parse(request.body ?? {});
      repo.bindProject(projectId, corpusId, enabled);
      return { projectId, corpusId, enabled };
    },
  );

  app.route(
    "GET",
    "/api/projects/:projectId/source-reference",
    async (request) => {
      const { projectId } = ProjectParams.parse(request.params);
      requireProject(projectId);
      const query = SearchQuery.parse(request.query);
      if (query.corpusId) requireBound(projectId, query.corpusId);
      return repo.search(query.q, {
        projectId,
        ...(query.corpusId ? { corpusId: query.corpusId } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        limit: query.limit,
        offset: query.offset,
      });
    },
  );

  app.route(
    "GET",
    "/api/projects/:projectId/source-reference/:corpusId/:sourceKey",
    async (request) => {
      const { projectId, corpusId, sourceKey } = RecordParams.parse(
        request.params,
      );
      requireBound(projectId, corpusId);
      const record = repo.getRecord(corpusId, sourceKey);
      if (!record)
        throw new ServiceError(
          "source.record.not_found",
          "Source record not found",
          404,
        );
      return { record, relations: repo.listRelations(corpusId, sourceKey) };
    },
  );
}
