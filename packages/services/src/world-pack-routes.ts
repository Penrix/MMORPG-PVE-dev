import {
  AdoptWorldPackRequestSchema,
  UpdateWorldPackRequestSchema,
  WorldPackRequestSchema,
  worldPackAtlasKind,
  worldPackReferenceProblems,
  type WorldPackRecord,
} from "@narralume/contracts";
import {
  createCanonEntity,
  createCanonFact,
  randomUuid,
} from "@narralume/domain";
import { buildWorldPackRecipe } from "@narralume/harness";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRepository,
  SqliteRunRepository,
  SqliteStoryRepository,
  SqliteWorldPackRepository,
  WorldPackVersionError,
  type NarrativeDatabase,
} from "@narralume/persistence";
import { z } from "zod";
import type { RouteApp, RunCoordinator } from "@narralume/services";
import {
  requireWritingAssignment,
  withRuntimeModelPolicy,
} from "@narralume/services";

const ProjectParams = z.object({ projectId: z.string().min(1) });
const PackParams = ProjectParams.extend({ packId: z.string().min(1) });

export class WorldPackRouteError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(code: string, message: string, statusCode = 422) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function adoptWorldPack(
  database: NarrativeDatabase,
  projectId: string,
  packId: string,
  expectedVersion: number,
): WorldPackRecord {
  const packs = new SqliteWorldPackRepository(database);
  const canon = new SqliteCanonRepository(database);
  const story = new SqliteStoryRepository(database);
  const state = new SqliteNarrativeStateRepository(database, canon, story);
  const now = new Date().toISOString();

  return database.transaction(() => {
    const pack = packs.get(projectId, packId);
    if (!pack)
      throw new WorldPackRouteError(
        "world.pack.not_found",
        "World package not found",
        404,
      );
    if (pack.status !== "draft" || pack.version !== expectedVersion)
      throw new WorldPackVersionError(
        "world.pack.stale",
        "World package is already adopted or has been edited",
      );

    const known = new Set(canon.listEntities(projectId).map((e) => e.id));
    const issues = worldPackReferenceProblems(pack.document, known);
    if (issues.length)
      throw new WorldPackRouteError(
        "world.pack.bad_references",
        issues.join("; "),
      );

    // Bind every local ID first, so links may reference later nodes.
    const ids: Record<string, string> = {};
    const names = new Map(
      canon
        .listEntities(projectId)
        .map((entry) => [`${entry.type}:${entry.name}`, entry.id]),
    );
    for (const node of pack.document.nodes) {
      if (node.existingCanonId) {
        const reused = canon.requireEntity(projectId, node.existingCanonId);
        if (reused.type !== node.type)
          throw new WorldPackRouteError(
            "world.pack.type_mismatch",
            `Type mismatch for ${node.name}`,
          );
        const reusedAtlasKind =
          typeof reused.attributes.atlasKind === "string"
            ? reused.attributes.atlasKind
            : null;
        if (
          node.atlasKind &&
          reusedAtlasKind &&
          node.atlasKind !== reusedAtlasKind
        )
          throw new WorldPackRouteError(
            "world.pack.atlas_kind_mismatch",
            `Atlas kind mismatch for ${node.name}: ${reusedAtlasKind} -> ${node.atlasKind}`,
            409,
          );
        if (reused.name !== node.name && !reused.aliases.includes(node.name))
          throw new WorldPackRouteError(
            "world.pack.name_mismatch",
            `Canon ID ${node.existingCanonId} belongs to ${reused.name}, not ${node.name}; use the existing name or an accepted alias`,
            409,
          );
        ids[node.localId] = reused.id;
      } else {
        const duplicate = names.get(`${node.type}:${node.name}`);
        if (duplicate)
          throw new WorldPackRouteError(
            "world.pack.existing_entity",
            `${node.name} already exists in Canon (${duplicate}); use existingCanonId instead of creating a duplicate`,
            409,
          );
        ids[node.localId] = randomUuid();
        names.set(`${node.type}:${node.name}`, ids[node.localId]!);
      }
    }

    const resolve = (ref: string) =>
      ref.startsWith("canon:") ? ref.slice(6) : ids[ref]!;
    for (const node of pack.document.nodes) {
      if (node.existingCanonId) continue;
      canon.insertEntity(
        createCanonEntity({
          id: ids[node.localId]!,
          projectId,
          type: node.type,
          name: node.name,
          description: node.description,
          attributes: {
            worldPackId: pack.id,
            worldPackLocalId: node.localId,
            ...(node.atlasKind ? { atlasKind: node.atlasKind } : {}),
            worldScale: pack.request.scale,
            worldTime: pack.request.worldTime,
            worldValue: node.value,
            worldAccess: node.access,
            worldMotive: node.motive,
            currentActivity: node.currentActivity,
            origin: node.origin,
            sourceNote: node.sourceNote,
          },
          now,
        }),
      );
    }

    // The original NarraLume story context is fact-centric: an isolated
    // Canon entity with no facts may be invisible during chapter generation.
    // Attach a source-backed content fact to every accepted world object.
    // Thus abilities, prices, access, motives and current occupations survive
    // beyond the World Builder UI and can be recalled by Novel Studio.
    const seenContent = new Set<string>();
    for (const node of pack.document.nodes) {
      const subjectId = ids[node.localId]!;
      if (seenContent.has(subjectId)) continue;
      seenContent.add(subjectId);
      const previous = canon
        .listEffectiveFacts(projectId, {
          subjectId,
        })
        .find((fact) => fact.predicate === "world.content");
      if (previous?.authority === "locked") {
        throw new WorldPackRouteError(
          "world.pack.locked_content",
          `World content for ${node.name} is locked; revise it explicitly in the Story Bible`,
          409,
        );
      }
      canon.insertFact(
        createCanonFact({
          id: randomUuid(),
          projectId,
          subjectId,
          predicate: "world.content",
          value: {
            scale: pack.request.scale,
            atlasKind: worldPackAtlasKind(node),
            worldTime: pack.request.worldTime,
            value: node.value,
            access: node.access,
            motive: node.motive,
            currentActivity: node.currentActivity,
            origin: node.origin,
            sourceNote: node.sourceNote,
            approvedDescription: node.description,
          },
          authority: "confirmed",
          sourceType: "world-pack",
          sourceId: pack.id,
          ...(previous ? { supersedesFactId: previous.id } : {}),
          now,
        }),
      );
    }

    for (const node of pack.document.nodes) {
      // W1 inherits its selected parent area unless the model explicitly
      // connects the node to a finer local location in the same world pack.
      const areaId = node.areaRef
        ? resolve(node.areaRef)
        : pack.request.scale === "W1"
          ? pack.request.parentAreaId
          : null;
      if (!areaId || areaId === ids[node.localId]) continue;
      const area = canon.requireEntity(projectId, areaId);
      if (area.type !== "location") {
        throw new WorldPackRouteError(
          "world.pack.area_type",
          `Area ${areaId} for ${node.name} must be a location`,
        );
      }
      const priorArea = canon
        .listEffectiveFacts(projectId, {
          subjectId: ids[node.localId]!,
        })
        .find((fact) => fact.predicate === "world.area");
      if (
        priorArea?.authority === "locked" &&
        priorArea.objectEntityId !== areaId
      ) {
        throw new WorldPackRouteError(
          "world.pack.locked_area",
          `The location of ${node.name} is locked; change it through the Story Bible`,
          409,
        );
      }
      if (priorArea?.objectEntityId === areaId) continue;
      canon.insertFact(
        createCanonFact({
          id: randomUuid(),
          projectId,
          subjectId: ids[node.localId]!,
          predicate: "world.area",
          objectEntityId: areaId,
          authority: "confirmed",
          ...(priorArea ? { supersedesFactId: priorArea.id } : {}),
          sourceType: "world-pack",
          sourceId: pack.id,
          now,
        }),
      );
    }

    // WorldForge-inspired event projection. A relationship may be explicitly
    // superseded or ended, but no unrelated owner's rights are withdrawn.
    // Shared ownership and contested titles are legitimate world realities.
    const currentRelations = state.listCurrentRelationships(projectId);
    for (const link of pack.document.links) {
      if (link.status === "possible") continue;
      const from = resolve(link.fromRef);
      const to = resolve(link.toRef);
      const prior = currentRelations.find(
        (event) =>
          event.fromEntityId === from &&
          event.toEntityId === to &&
          event.relation === link.relation,
      );
      if (link.status === "ended" && !prior) {
        throw new WorldPackRouteError(
          "world.pack.relationship_not_found",
          `Cannot end ${link.relation} between ${from} and ${to}: no current relationship exists`,
        );
      }
      state.insertRelationship({
        id: randomUuid(),
        projectId,
        fromEntityId: from,
        toEntityId: to,
        relation: link.relation,
        intensity: null,
        state: {
          description: link.description,
          lifecycle: link.status === "ended" ? "voided" : "active",
          worldPackId: pack.id,
          worldTime: pack.request.worldTime,
        },
        outlineNodeId: null,
        storyTime: pack.request.worldTime,
        sourceId: pack.id,
        supersedesEventId: prior?.id ?? null,
        createdAt: now,
      });
    }

    // Ongoing/ended activities are actor-scoped state facts, not already
    // finished timeline history. The stable activityLocalId allows the
    // next world advance to replace or close the previous activity.
    for (const activity of pack.document.activities) {
      if (activity.stage === "potential") continue;
      for (const actorRef of activity.actorRefs) {
        const subjectId = resolve(actorRef);
        const previous = canon
          .listEffectiveFacts(projectId, {
            subjectId,
          })
          .find(
            (fact) =>
              fact.predicate === "world.ongoing_activity" &&
              fact.value !== null &&
              typeof fact.value === "object" &&
              "activityLocalId" in fact.value &&
              fact.value.activityLocalId === activity.localId,
          );
        if (previous?.authority === "locked") {
          throw new WorldPackRouteError(
            "world.pack.locked_activity",
            `Activity ${activity.localId} is locked and cannot be overwritten through world generation`,
            409,
          );
        }
        if (activity.stage === "ended" && !previous) {
          throw new WorldPackRouteError(
            "world.pack.activity_not_found",
            `Cannot end activity ${activity.localId}: it has no prior Canon state for ${subjectId}`,
          );
        }
        canon.insertFact(
          createCanonFact({
            id: randomUuid(),
            projectId,
            subjectId,
            predicate: "world.ongoing_activity",
            value: {
              description: activity.description,
              reason: activity.reason,
              worldTime: activity.worldTime,
              resourceIds: activity.resourceRefs.map(resolve),
              activityLocalId: activity.localId,
              stage: activity.stage,
            },
            authority: "confirmed",
            sourceType: "world-pack",
            sourceId: pack.id,
            ...(previous ? { supersedesFactId: previous.id } : {}),
            now,
          }),
        );
      }
    }

    // MMO content-production affords real options. These are accepted
    // world services/activities, NOT events already won by the protagonist.
    // The requirements and potential returns are kept separate from actual
    // ownership/rights; only a future settled action can grant them.
    for (const action of pack.document.interactions ?? []) {
      const operatorId = resolve(action.offeredByRef);
      const operator = canon.requireEntity(projectId, operatorId);
      if (operator.type !== "character" && operator.type !== "organization") {
        throw new WorldPackRouteError(
          "world.action.invalid_operator",
          "A world activity must be offered by a real person or organization",
        );
      }
      const prior = canon
        .listEffectiveFacts(projectId, { subjectId: operatorId })
        .find(
          (fact) =>
            fact.predicate === "world.affordance" &&
            fact.value !== null &&
            typeof fact.value === "object" &&
            "localId" in fact.value &&
            fact.value.localId === action.localId,
        );
      if (prior?.authority === "locked") {
        throw new WorldPackRouteError(
          "world.action.locked",
          "A locked world activity cannot be replaced by generation",
        );
      }
      canon.insertFact(
        createCanonFact({
          id: randomUuid(),
          projectId,
          subjectId: operatorId,
          predicate: "world.affordance",
          value: {
            localId: action.localId,
            name: action.name,
            action: action.action,
            locationId: action.locationRef ? resolve(action.locationRef) : null,
            requires: action.requires.map((term) => ({
              kind: term.kind,
              ref: resolve(term.ref),
            })),
            yields: action.yields.map((term) => ({
              kind: term.kind,
              ref: resolve(term.ref),
            })),
            state: action.state,
          },
          authority: "confirmed",
          sourceType: "world-pack",
          sourceId: pack.id,
          ...(prior ? { supersedesFactId: prior.id } : {}),
          now,
        }),
      );
    }

    // Pack is marked adopted inside the same SQLite transaction.
    // An error anywhere above rolls back every entity, relation and fact.
    return packs.markAdopted(projectId, packId, expectedVersion, ids, now);
  });
}

export function registerWorldPackRoutes(
  app: RouteApp,
  database: NarrativeDatabase,
  options: {
    runCoordinator: RunCoordinator;
    enableBackgroundWorker: boolean;
    environment: Readonly<Record<string, string | undefined>>;
  },
): void {
  const projects = new SqliteProjectRepository(database);
  const runs = new SqliteRunRepository(database);
  const packs = new SqliteWorldPackRepository(database);

  const requireProject = (projectId: string) => {
    const project = projects.get(projectId);
    if (!project)
      throw new WorldPackRouteError(
        "project.not_found",
        "Project not found",
        404,
      );
  };

  app.route(
    "POST",
    "/api/projects/:projectId/world-packs/generate",
    async (request) => {
      const { projectId } = ProjectParams.parse(request.params);
      requireProject(projectId);
      const input = WorldPackRequestSchema.parse(request.body);
      if (input.scale === "W1" && !input.focus)
        throw new WorldPackRouteError(
          "world.pack.focus_required",
          "W1 requires a specific zone or social circle",
        );
      if (input.scale === "W1" && !input.genre)
        throw new WorldPackRouteError(
          "world.pack.genre_required",
          "W1 requires a genre and Reader experience",
        );
      if (input.parentAreaId) {
        const area = new SqliteCanonRepository(database).getEntity(
          projectId,
          input.parentAreaId,
        );
        if (!area || area.type !== "location")
          throw new WorldPackRouteError(
            "world.pack.area_not_found",
            "Parent area must be an existing location in this project",
          );
      }
      if (
        input.intent === "advance" &&
        !new SqliteCanonRepository(database).listEntities(projectId).length
      ) {
        throw new WorldPackRouteError(
          "world.pack.empty_reality",
          "Create and adopt a W0/W1 world package before advancing existing NPC activities",
        );
      }
      const runId = `world-pack:${projectId}:${input.requestId}`;
      const replay = runs.getRun(runId);
      if (replay) {
        if (
          replay.projectId !== projectId ||
          JSON.stringify(replay.policy.worldPackRequest) !==
            JSON.stringify(input)
        )
          throw new WorldPackRouteError(
            "world.pack.idempotency_conflict",
            "requestId was used for another world pack",
            409,
          );
        return { status: 202, body: { runId, idempotentReplay: true } };
      }
      const active = runs
        .listActiveRuns(projectId)
        .find((r) => r.recipe === "world-pack-production");
      if (active)
        throw new WorldPackRouteError(
          "world.pack.active_run",
          `World generation already running: ${active.id}`,
          409,
        );
      requireWritingAssignment(database, options.environment);
      const recipe = buildWorldPackRecipe(runId);
      runs.create({
        id: runId,
        projectId,
        recipe: recipe.name,
        recipeVersion: recipe.version,
        mode: "manual",
        targetOutlineNodeId: null,
        policy: withRuntimeModelPolicy(
          {
            worldPackRequest: input,
            origin: { surface: "world", kind: "world-pack" },
          },
          options.environment,
        ),
        steps: recipe.steps,
        now: new Date().toISOString(),
      });
      if (options.enableBackgroundWorker) options.runCoordinator.wake();
      return { status: 202, body: { runId, idempotentReplay: false } };
    },
  );

  app.route("GET", "/api/projects/:projectId/world-packs", async (request) => {
    const { projectId } = ProjectParams.parse(request.params);
    requireProject(projectId);
    return packs.list(projectId);
  });

  app.route(
    "GET",
    "/api/projects/:projectId/world-packs/:packId",
    async (request) => {
      const { projectId, packId } = PackParams.parse(request.params);
      requireProject(projectId);
      const pack = packs.get(projectId, packId);
      if (!pack)
        throw new WorldPackRouteError(
          "world.pack.not_found",
          "World package not found",
          404,
        );
      return pack;
    },
  );

  app.route(
    "PUT",
    "/api/projects/:projectId/world-packs/:packId",
    async (request) => {
      const { projectId, packId } = PackParams.parse(request.params);
      requireProject(projectId);
      const input = UpdateWorldPackRequestSchema.parse(request.body);
      const known = new Set(
        new SqliteCanonRepository(database)
          .listEntities(projectId)
          .map((e) => e.id),
      );
      const issues = worldPackReferenceProblems(input.document, known);
      if (issues.length)
        throw new WorldPackRouteError(
          "world.pack.bad_references",
          issues.join("; "),
        );
      return packs.revise({
        projectId,
        id: packId,
        expectedVersion: input.expectedVersion,
        document: input.document,
        now: new Date().toISOString(),
      });
    },
  );

  app.route(
    "POST",
    "/api/projects/:projectId/world-packs/:packId/adopt",
    async (request) => {
      const { projectId, packId } = PackParams.parse(request.params);
      requireProject(projectId);
      const input = AdoptWorldPackRequestSchema.parse(request.body);
      return adoptWorldPack(database, projectId, packId, input.expectedVersion);
    },
  );
}
