import { z } from "zod";
import type { NarrativeDatabase } from "@narralume/persistence";
import {
  SqliteProjectRepository,
  SqliteSourceCorpusRepository,
} from "@narralume/persistence";
import type { RouteApp } from "./route-app.js";
import { ServiceError } from "./service-error.js";

const ProjectParams = z.object({ projectId: z.string().min(1) });
const SourceParams = ProjectParams.extend({ corpusId: z.string().min(1) });
const RecordParams = SourceParams.extend({ sourceKey: z.string().min(1) });
const SearchQuery = z.object({
  q: z.string().default(""),
  kind: z.enum(["character","organization","location","ability","creature","item","event","other"]).optional(),
  corpusId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
const Binding = z.object({ enabled: z.boolean().default(true) });

/** Reference lookups are expressly NOT Canon adoption. They can return
 * Naruto's entire future while project Reality stays in its chosen era. */
export function registerSourceCorpusRoutes(app: RouteApp, db: NarrativeDatabase): void {
  const repo = new SqliteSourceCorpusRepository(db);
  const projects = new SqliteProjectRepository(db);
  const requireProject = (projectId: string): void => {
    if (!projects.get(projectId))
      throw new ServiceError("project.not_found","Project not found",404);
  };
  const requireBound = (projectId: string, corpusId: string): void => {
    requireProject(projectId);
    if (!repo.listProjectCorpora(projectId).some((corpus) => corpus.id === corpusId))
      throw new ServiceError("source.not_bound","Source corpus not attached to project",404);
  };

  app.route("GET","/api/source-corpora",async () => repo.listCorpora());

  app.route("GET","/api/projects/:projectId/source-corpora",async (request) => {
    const { projectId } = ProjectParams.parse(request.params);
    requireProject(projectId);
    return repo.listProjectCorpora(projectId);
  });

  app.route("POST","/api/projects/:projectId/source-corpora/:corpusId",async (request) => {
    const { projectId, corpusId } = SourceParams.parse(request.params);
    requireProject(projectId);
    if (!repo.getCorpus(corpusId))
      throw new ServiceError("source.not_found","Source corpus not installed",404);
    const { enabled } = Binding.parse(request.body ?? {});
    repo.bindProject(projectId,corpusId,enabled);
    return { projectId,corpusId,enabled };
  });

  app.route("GET","/api/projects/:projectId/source-reference",async (request) => {
    const { projectId } = ProjectParams.parse(request.params);
    requireProject(projectId);
    const query = SearchQuery.parse(request.query);
    if (query.corpusId) requireBound(projectId,query.corpusId);
    return repo.search(query.q,{
      projectId,...(query.corpusId ? {corpusId:query.corpusId}:{}),
      ...(query.kind ? {kind:query.kind}:{}),
      limit:query.limit,offset:query.offset,
    });
  });

  app.route("GET","/api/projects/:projectId/source-reference/:corpusId/:sourceKey",async (request) => {
    const { projectId,corpusId,sourceKey } = RecordParams.parse(request.params);
    requireBound(projectId,corpusId);
    const record = repo.getRecord(corpusId,sourceKey);
    if (!record) throw new ServiceError("source.record.not_found","Source record not found",404);
    return { record, relations:repo.listRelations(corpusId,sourceKey) };
  });
}
