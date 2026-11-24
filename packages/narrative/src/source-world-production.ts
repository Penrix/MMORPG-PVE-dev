import {
  WORLD_BUILDER_ATLAS_CONTRACT,
  WorldPackDocumentSchema,
  WorldPackRequestSchema,
  worldPackCoarseTypeForAtlasKind,
  type WorldPackDocument,
  type WorldPackRequest,
} from "@narralume/contracts";
import {
  ModelGateway,
  createModelAdapter,
  type FetchLike,
} from "@narralume/llm";
import {
  SqliteAssignmentRepository,
  SqliteUnifiedSourceWorldRepository,
  resolveCredential,
  type NarrativeDatabase,
} from "@narralume/persistence";
import {
  applyWorldProductionDelta,
  auditWorldAtlasProduction,
  emptyWorldDocument,
  playtestWorld,
  worldWorkOrderInput,
} from "./world-production-engine.js";
import {
  hasWorldWorkshopOutput,
  worldProductionWorkOrder,
} from "./world-production-runner.js";
import {
  initialWorldWorkshopOrder,
  resolveWorldDesignEntry,
} from "./world-design-policy.js";
import { previewProductionReality } from "./world-production-reality.js";
import { WORLD_PACK_MODEL_CONTRACT } from "./world-pack-workers.js";

export interface SourceWorldProductionGenerateInput {
  worldId: string;
  request: WorldPackRequest;
}

export interface SourceWorldProductionGenerateOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  fetch?: FetchLike;
  generateOverride?: (input: {
    worldId: string;
    request: WorldPackRequest;
    prompt: string;
    existingWorld: WorldPackDocument;
    operation: string;
  }) => Promise<unknown> | unknown;
}

export async function generateSourceWorldProduction(
  database: NarrativeDatabase,
  input: SourceWorldProductionGenerateInput,
  options: SourceWorldProductionGenerateOptions = {},
): Promise<WorldPackDocument> {
  const request = WorldPackRequestSchema.parse(input.request);
  const worlds = new SqliteUnifiedSourceWorldRepository(database);
  const world = worlds.getWorld(input.worldId);
  if (!world)
    throw serviceLikeError(
      "source.world.not_found",
      "Source World not found",
      404,
    );

  const knownSourceKeys = new Set(worlds.listCardKeys(input.worldId));
  const existingWorld = projectSourceWorldForProduction(
    worlds,
    input.worldId,
    request,
  );
  const requestedEntry = resolveWorldDesignEntry(request, existingWorld);
  const playtest = playtestWorld(existingWorld, request);
  const fallbackWorkshop =
    playtest.atlasAudit.nextWorkshop ??
    initialWorldWorkshopOrder(request)[0] ??
    "geography";
  const op = requestedEntry
    ? worldProductionWorkOrder(
        requestedEntry.workshop,
        existingWorld,
        request,
      )
    : playtest.next ??
      worldProductionWorkOrder(fallbackWorkshop, existingWorld, request);

  const instruction = {
    target: "source_world",
    authority: {
      existingSourceCards:
        "reference truth already accepted into this Source World Atlas",
      generatedContent:
        "candidate only until author adoption; model recall is never verified Source Canon",
      readerSemantics:
        "Reader-side prior only; never objective Source fact and never Project Canon",
    },
    ...worldWorkOrderInput(op, existingWorld),
    authorRequest: request,
    worldBuilderAtlasContract: WORLD_BUILDER_ATLAS_CONTRACT,
    sourceWorld: {
      id: world.id,
      name: world.name,
      kind: world.kind,
      description: world.description,
    },
    outputRules: [
      "existingCanonId must always be null for Source World production",
      "when deepening an existing Source card set existingSourceKey to its exact stable key",
      "references to existing Source cards use source:<stable-key>",
      "new unverified material must use origin=inference or origin=original; never manufacture source_canon",
      "value means world-internal social value; readerSemantics is the target Reader's preloaded price and expectation",
      "readerSemantics may be null when there is no meaningful Reader prior",
    ],
  };
  const prompt =
    "你正在扩充一个可被多本小说反复 Fork 的原生母体世界，不是在写某一本小说的剧情。\n" +
    "原生事实、模型推断、原创扩展、Reader 预装认知必须分权。\n" +
    JSON.stringify(instruction);

  const raw = options.generateOverride
    ? await options.generateOverride({
        worldId: input.worldId,
        request,
        prompt,
        existingWorld,
        operation: op.workshop,
      })
    : await callSourceWorldModel(database, prompt, options);

  const parsed = WorldPackDocumentSchema.safeParse(raw);
  if (!parsed.success)
    throw serviceLikeError(
      "source.world.production.invalid_output",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
      422,
    );

  for (const node of parsed.data.nodes) {
    if (node.existingCanonId)
      throw serviceLikeError(
        "source.world.production.project_authority_leak",
        `Source World production cannot reference Project Canon identity: ${node.name}`,
        422,
      );
    if (
      node.origin === "source_canon" &&
      !node.existingSourceKey
    )
      throw serviceLikeError(
        "source.world.production.fabricated_canon",
        `New Source World candidate ${node.name} cannot claim source_canon without an existing Source identity`,
        422,
      );
  }

  const merged = applyWorldProductionDelta(
    emptyWorldDocument(),
    parsed.data,
    new Set<string>(),
    op.workshop,
    op.subjectRef,
    knownSourceKeys,
  );
  const combined = previewProductionReality(existingWorld, merged.document);
  if (
    !hasWorldWorkshopOutput(
      op.workshop,
      existingWorld,
      combined,
    )
  )
    throw serviceLikeError(
      "source.world.production.no_product",
      `${op.workshop} did not produce its promised Source World objects / relations / activities`,
      422,
    );

  return {
    ...merged.document,
    production: {
      engine: "mmorpg-world-workshop-v1",
      executed: [
        {
          workshop: op.workshop,
          subjectRef: op.subjectRef,
          changedRefs: merged.step.changedRefs,
        },
      ],
      playtestedPaths: playtestWorld(combined, request).interactionPaths,
      atlasAudit: auditWorldAtlasProduction(combined),
    },
  };
}

function projectSourceWorldForProduction(
  worlds: SqliteUnifiedSourceWorldRepository,
  worldId: string,
  request: WorldPackRequest,
): WorldPackDocument {
  const focusHits = request.focus
    ? worlds.listCards(worldId, request.focus, { limit: 30 })
    : [];
  const broadHits = worlds.listCards(worldId, "", { limit: 70 });
  const selected = new Map(
    [...focusHits, ...broadHits]
      .slice(0, 80)
      .map((hit) => [hit.sourceKey, hit]),
  );
  const nodes: WorldPackDocument["nodes"] = [];
  const links: WorldPackDocument["links"] = [];
  const seenLinks = new Set<string>();

  for (const hit of selected.values()) {
    const card = worlds.getCard(worldId, hit.sourceKey);
    if (!card) continue;
    nodes.push({
      localId: "source:" + hit.sourceKey,
      existingCanonId: null,
      existingSourceKey: hit.sourceKey,
      type: worldPackCoarseTypeForAtlasKind(hit.kind),
      atlasKind: hit.kind,
      name: hit.name,
      description: card.content.slice(0, 3_500),
      areaRef: null,
      value: "",
      access: "",
      motive: "",
      currentActivity: "",
      origin: "source_canon",
      sourceNote: "Existing Source World Atlas reference",
      readerSemantics: worlds.getReaderSemantics(worldId, hit.sourceKey),
    });
    for (const edge of card.relations) {
      if (edge.direction !== "out") continue;
      const key =
        edge.fromKey + "|" + edge.relation + "|" + edge.toKey;
      if (seenLinks.has(key)) continue;
      seenLinks.add(key);
      links.push({
        fromRef: "source:" + edge.fromKey,
        toRef: "source:" + edge.toKey,
        relation: edge.relation,
        description: edge.sourceNote || "Existing Source World relation",
        status: "current",
      });
    }
  }

  return {
    summary:
      nodes.length > 0
        ? "Existing Source World Atlas; read-only input for this production batch"
        : "Source World Atlas currently has no curated cards",
    nodes,
    links,
    activities: [],
    interactions: [],
    openThreads: [],
    dimensionSignals: [],
  };
}

async function callSourceWorldModel(
  database: NarrativeDatabase,
  prompt: string,
  options: SourceWorldProductionGenerateOptions,
): Promise<unknown> {
  const assignment =
    new SqliteAssignmentRepository(database).resolve("planning") ??
    new SqliteAssignmentRepository(database).resolve("writing");
  if (!assignment)
    throw serviceLikeError(
      "source.world.production.model_unavailable",
      "No planning or writing model assignment is configured",
      422,
    );
  const credential = resolveCredential(
    assignment.provider,
    options.environment ?? {},
  );
  if (!credential.ok)
    throw serviceLikeError(
      "source.world.production.model_unavailable",
      "The configured model credential is unavailable",
      422,
    );
  const gateway = new ModelGateway(
    createModelAdapter({
      protocol: assignment.provider.wireApi,
      baseUrl: assignment.provider.baseUrl,
      apiKey: credential.apiKey,
      ...(assignment.provider.endpoint === null
        ? {}
        : { endpoint: assignment.provider.endpoint }),
      ...(assignment.provider.anthropicVersion === null
        ? {}
        : { anthropicVersion: assignment.provider.anthropicVersion }),
      headers: assignment.provider.headers,
      queryParams: assignment.provider.queryParams,
      timeoutMs: 90_000,
      maxRetries: 1,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }),
  );
  const result = await gateway.generateStructured(
    {
      model: assignment.model.modelId,
      instructions:
        "执行一个 Source World Atlas 世界内容生产工序。只生产候选世界对象、typed relations、活动、世界内部价格/入口及独立的 Reader-side semantics；不要写小说剧情，不要把模型记忆冒充已核实原作事实。",
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: Math.min(
        assignment.model.maxOutputTokens ?? 12_000,
        16_000,
      ),
      responseSchema: WORLD_PACK_MODEL_CONTRACT,
    },
    (value) => {
      const parsed = WorldPackDocumentSchema.safeParse(value);
      return parsed.success
        ? { success: true as const, data: parsed.data }
        : {
            success: false as const,
            issues: parsed.error.issues.map(
              (issue) =>
                `${issue.path.join(".") || "root"}: ${issue.message}`,
            ),
          };
    },
    { maxRepairAttempts: 1 },
  );
  return result.value;
}

function serviceLikeError(
  code: string,
  message: string,
  statusCode: number,
): Error {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    retryable: false,
  });
}
