import { randomUuid } from "@narralume/domain";
import { buildStoryDirectorDesignRecipe, buildStoryDirectorRehearseRecipe } from "@narralume/harness";
import { SqliteProjectRepository, SqliteRunRepository, SqliteStoryRepository, type NarrativeDatabase } from "@narralume/persistence";
import { z } from "zod";
import type { RouteApp } from "./route-app.js";
import type { RunCoordinator } from "./run-coordinator.js";
import { requireWritingAssignment, withRuntimeModelPolicy } from "./run-policy.js";

const Params = z.object({ projectId: z.string().min(1) });
const Design = z.object({
  projectId: z.string().min(1),
  frameOutlineNodeId: z.string().min(1),
  entityIds: z.array(z.string().min(1)),
  protagonistCamera: z.object({ projectId: z.string().min(1), protagonistEntityId: z.string().min(1) }).passthrough(),
  request: z.string().min(1),
  readerNeed: z.string().min(1),
  targetEmotion: z.string().min(1),
}).passthrough();
const Rehearse = z.object({
  field: z.object({ projectId: z.string().min(1) }).passthrough(),
  storyUnit: z.object({ projectId: z.string().min(1), status: z.literal("READY") }).passthrough(),
  storyUnitEventId: z.string().min(1),
  expectationState: z.object({ projectId: z.string().min(1) }).passthrough(),
  chapterTitle: z.string().min(1),
  chapterGoal: z.string().min(1),
  povEntityId: z.string().nullable(),
  targetCharacters: z.number().int().min(200),
  request: z.string().min(1),
  generationId: z.string().min(1),
}).passthrough();
const Adoption = z.object({
  chapterOutlineNodeId: z.string().min(1),
  frameOutlineNodeId: z.string().min(1).optional(),
  handoff: z.object({ projectId: z.string().min(1), authority: z.literal("locked-story-design") }).passthrough(),
  storyUnit: z.object({ projectId: z.string().min(1), status: z.literal("READY") }).passthrough(),
  expectationState: z.object({ projectId: z.string().min(1) }).passthrough().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
}).passthrough();
export class StoryDirectorRouteError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode = 422) { super(message); }
}

/** Generic injection keeps services independent of narrative runtime types. */
export function registerStoryDirectorRoutes<T extends {
  chapterOutlineNodeId: string;
  frameOutlineNodeId?: string;
  updatedAt: string;
}>(app: RouteApp, database: NarrativeDatabase, coordinator: RunCoordinator, options: {
  adoptNodeHandoff: (input: T) => unknown;
  enableBackgroundWorker?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
}): void {
  const projects = new SqliteProjectRepository(database);
  const runs = new SqliteRunRepository(database);
  const story = new SqliteStoryRepository(database);
  const environment = options.environment ?? {};
  const requireProject = (projectId: string) => {
    if (!projects.get(projectId)) throw new StoryDirectorRouteError("project.not_found", "Project not found", 404);
  };
  const start = (projectId: string, kind: "design" | "rehearse", body: unknown) => {
    requireProject(projectId);
    const input = kind === "design" ? Design.parse(body) : Rehearse.parse(body);
    if (kind === "design") {
      const design = input as z.infer<typeof Design>;
      if (design.projectId !== projectId || design.protagonistCamera.projectId !== projectId)
        throw new StoryDirectorRouteError("story_director.project_mismatch", "Project mismatch");
      if (!story.listOutline(projectId).some((node) => node.id === design.frameOutlineNodeId))
        throw new StoryDirectorRouteError("story_director.frame_not_found", "Frame node not found", 404);
    } else {
      const rehearsal = input as z.infer<typeof Rehearse>;
      if ([rehearsal.field.projectId, rehearsal.storyUnit.projectId, rehearsal.expectationState.projectId].some((id) => id !== projectId))
        throw new StoryDirectorRouteError("story_director.project_mismatch", "Project mismatch");
    }
    const name = kind === "design" ? "story-director-design" : "story-director-rehearse";
    const active = runs.listActiveRuns(projectId).find((run) => run.recipe === name);
    if (active) throw new StoryDirectorRouteError("story_director.active_run", `Active ${kind} run: ${active.id}`, 409);
    requireWritingAssignment(database, environment);
    const runId = `story-director:${kind}:${projectId}:${randomUuid()}`;
    const recipe = kind === "design" ? buildStoryDirectorDesignRecipe(runId) : buildStoryDirectorRehearseRecipe(runId);
    runs.create({
      id: runId, projectId, recipe: recipe.name, recipeVersion: recipe.version,
      mode: "manual",
      targetOutlineNodeId: kind === "design" ? (input as z.infer<typeof Design>).frameOutlineNodeId : null,
      policy: withRuntimeModelPolicy({
        ...(kind === "design" ? { storyDirectorDesignRequest: input } : { storyDirectorRehearsalRequest: input }),
        origin: { surface: "story-director", kind },
      }, environment),
      steps: recipe.steps, now: new Date().toISOString(),
    });
    if (options.enableBackgroundWorker) coordinator.wake();
    return { status: 202, body: { runId, idempotentReplay: false } };
  };
  app.route("POST", "/api/projects/:projectId/story-director/design", (request) => {
    const { projectId } = Params.parse(request.params);
    return start(projectId, "design", request.body);
  });
  app.route("POST", "/api/projects/:projectId/story-director/rehearse", (request) => {
    const { projectId } = Params.parse(request.params);
    return start(projectId, "rehearse", request.body);
  });
  app.route("POST", "/api/projects/:projectId/story-director/adopt-handoff", (request) => {
    const { projectId } = Params.parse(request.params);
    requireProject(projectId);
    const input = Adoption.parse(request.body);
    if (input.handoff.projectId !== projectId || input.storyUnit.projectId !== projectId ||
      (input.expectationState && input.expectationState.projectId !== projectId))
      throw new StoryDirectorRouteError("story_director.project_mismatch", "Project mismatch");
    const outline = story.listOutline(projectId);
    if (!outline.some((node) => node.id === input.chapterOutlineNodeId) ||
      (input.frameOutlineNodeId && !outline.some((node) => node.id === input.frameOutlineNodeId)))
      throw new StoryDirectorRouteError("story_director.node_not_found", "Outline node not found", 404);
    const result = options.adoptNodeHandoff({
      ...input,
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    } as unknown as T);
    return { status: 200, body: result };
  });
}
