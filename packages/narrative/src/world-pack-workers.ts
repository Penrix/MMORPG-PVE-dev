import {
  WORLD_BUILDER_ATLAS_CONTRACT,
  WORLD_BUILDER_ATLAS_CROSSWALK,
  WorldPackDocumentSchema,
  type WorldPackDocument,
  WorldPackRequestSchema,
  type WorldPackRequest,
} from "@narralume/contracts";
import type {
  NarrativeRunStep,
  RunBudgetUsage,
  RunSnapshot,
} from "@narralume/domain";
import type {
  WorkerRegistry,
  StepExecutionResult,
  StepWorker,
} from "@narralume/harness";
import type { JsonSchemaContract } from "@narralume/llm";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRepository,
  SqliteStoryRepository,
  SqliteWorldPackRepository,
  SqliteRunRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import type { NarrativeModelClient } from "./model-client.js";
import { selectWorldMethodExcerpts } from "./mmorpg-method-catalog.js";
import { selectWorldContextIds } from "./world-pack-context.js";
import { projectNpcWitnessedEvents } from "./world-pack-knowledge.js";
import {
  previewWorldForgeFactions,
  type WorldForgeFactionSeed,
} from "./worldforge-faction-bridge.js";
import { parseWorldOutput } from "./vendor/covel/lore-processor.js";
import {
  runWorldWorkshops,
  type WorldWorkshopCheckpoint,
} from "./world-production-runner.js";
import { projectExistingWorldForProduction } from "./world-production-reality.js";
import { createRevisionCache } from "./vendor/covel/revision-cache.js";
import { orderSources } from "./vendor/covel/source-order.js";
import { causalCandidates } from "./vendor/worldforge/causality.js";
import {
  emptyRegistry,
  tryRegisterDimension,
} from "./vendor/worldforge/registry.js";
import type { SimulationEvent } from "./vendor/worldforge/types.js";

const txt = (description: string) => ({ type: "string", description });
const nullable = (description: string) => ({
  anyOf: [{ type: "string" }, { type: "null" }],
  description,
});

const NODE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "localId",
    "existingCanonId",
    "type",
    "name",
    "description",
    "areaRef",
    "value",
    "access",
    "motive",
    "currentActivity",
    "origin",
    "sourceNote",
  ],
  properties: {
    localId: txt(
      "Local stable ID for this pack, e.g. guild_hall; never a database UUID",
    ),
    existingCanonId: nullable(
      "Existing Canon entity UUID ONLY if updating/reusing that exact entity; else null",
    ),
    type: {
      type: "string",
      enum: [
        "character",
        "location",
        "organization",
        "item",
        "rule",
        "concept",
      ],
    },
    name: txt("Specific named world object"),
    description: txt(
      "Detailed full description of actual world content, not a label",
    ),
    areaRef: nullable(
      "Existing local node ID or canon:<known-entity-UUID>; null if whole-world",
    ),
    value: txt(
      "Who values this object and what concrete price it has in the world",
    ),
    access: txt(
      "How a person actually reaches, acquires or gains access to it",
    ),
    motive: txt(
      "Its personal/organizational goal or what makes this rule/location meaningful",
    ),
    currentActivity: txt(
      "An actual current action by this person/group/location or its current world function",
    ),
    origin: {
      type: "string",
      enum: ["original", "inference", "historical_claim", "source_canon"],
    },
    sourceNote: txt(
      "Grounding/citation or note; do not pretend model recall was externally verified",
    ),
  },
};

export const WORLD_PACK_MODEL_CONTRACT: JsonSchemaContract = {
  name: "world_content_package",
  description:
    "An interconnected world package with entity records, graph edges and existing independent activities.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "nodes",
      "links",
      "activities",
      "interactions",
      "openThreads",
      "dimensionSignals",
    ],
    properties: {
      summary: txt(
        "What actual world has been produced and how people live there",
      ),
      nodes: { type: "array", maxItems: 80, items: NODE_SCHEMA },
      links: {
        type: "array",
        maxItems: 180,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fromRef", "toRef", "relation", "description", "status"],
          properties: {
            fromRef: txt("Local node ID or canon:<existing UUID>"),
            toRef: txt("Local node ID or canon:<existing UUID>"),
            relation: txt(
              "owns / leads / employs / knows / competes / trades / access-through etc",
            ),
            description: txt(
              "A concrete social, ownership or geographic connection",
            ),
            status: { type: "string", enum: ["current", "possible", "ended"] },
          },
        },
      },
      activities: {
        type: "array",
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "localId",
            "actorRefs",
            "description",
            "reason",
            "resourceRefs",
            "stage",
            "worldTime",
          ],
          properties: {
            localId: txt("Unique local activity ID"),
            actorRefs: {
              type: "array",
              minItems: 1,
              items: txt("Local node ID or canon:<existing UUID>"),
            },
            description: txt(
              "What a real character or organization is doing even without the protagonist",
            ),
            reason: txt("Their own motive and why they started it"),
            resourceRefs: {
              type: "array",
              items: txt("Local or Canon reference of an actual resource"),
            },
            stage: { type: "string", enum: ["ongoing", "potential", "ended"] },
            worldTime: txt(
              "Time in the world's current calendar or relative to current reality",
            ),
          },
        },
      },
      interactions: {
        type: "array",
        maxItems: 90,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "localId",
            "name",
            "offeredByRef",
            "locationRef",
            "action",
            "requires",
            "yields",
            "state",
          ],
          properties: {
            localId: txt("Stable action ID"),
            name: txt("Specific world activity a person can actually perform"),
            offeredByRef: txt(
              "Concrete NPC or organization offering this actual opportunity",
            ),
            locationRef: nullable(
              "Actual location ID, or null for location-independent action",
            ),
            action: txt(
              "What this action physically or socially entails and whose choices matter",
            ),
            requires: {
              type: "array",
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "ref"],
                properties: {
                  kind: {
                    type: "string",
                    enum: [
                      "asset",
                      "permission",
                      "relationship",
                      "knowledge",
                      "ability",
                      "access",
                    ],
                  },
                  ref: txt(
                    "Existing local ID or canon:<actual UUID>; no invented prerequisites",
                  ),
                },
              },
            },
            yields: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "ref"],
                properties: {
                  kind: {
                    type: "string",
                    enum: [
                      "asset",
                      "permission",
                      "relationship",
                      "knowledge",
                      "ability",
                      "access",
                    ],
                  },
                  ref: txt(
                    "Concrete potential asset, social right or capability that this action can yield",
                  ),
                },
              },
            },
            state: { type: "string", enum: ["available", "potential"] },
          },
        },
      },
      openThreads: {
        type: "array",
        maxItems: 70,
        items: txt("Further naturally arising world content to develop"),
      },
      dimensionSignals: {
        type: "array",
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "dim",
            "kind",
            "frequency",
            "consequence",
            "lawConsistency",
            "potential",
            "description",
          ],
          properties: {
            dim: txt(
              "Emergent power, technique, belief, social or industrial dimension observed in actual world behavior",
            ),
            kind: { type: "string", enum: ["tech", "value"] },
            frequency: { type: "number", minimum: 0, maximum: 1 },
            consequence: { type: "number", minimum: 0, maximum: 1 },
            lawConsistency: { type: "number", minimum: 0, maximum: 1 },
            potential: { type: "number", minimum: 0, maximum: 100 },
            description: txt(
              "What real actions demonstrate the influence of this dimension",
            ),
          },
        },
      },
    },
  },
};

const NO_USAGE: RunBudgetUsage = {
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,
  costUsd: 0,
  wallTimeMs: 0,
};

function error(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, retryable: false });
}

function artifact(
  snapshot: RunSnapshot,
  kind: NarrativeRunStep["kind"],
): Record<string, unknown> {
  const result = [...snapshot.steps]
    .reverse()
    .find(
      (item) => item.kind === kind && item.status === "succeeded",
    )?.outputArtifact;
  if (!result) throw error("world.artifact.missing", `Missing ${kind}`);
  return { ...result };
}

function makePrompt(
  input: WorldPackRequest,
  project: { title: string; premise: string | null },
  known: Record<string, unknown>,
  covelPackage: { yaml: string; lore: string; packageYaml?: string } | null,
  dimensions: ReturnType<typeof emptyRegistry>,
  causalHints: SimulationEvent[],
): string {
  // The existing Covel topological sorter is used to preserve authoring
  // dependencies. The current accepted Canon wins over historical design
  // text; the user's immediate request is placed last.
  const selectedMethods = selectWorldMethodExcerpts(input);
  const methodSources = selectedMethods.map((method, i) => ({
    id: method.id,
    order: i,
    descriptor: i === 0 ? {} : { after: selectedMethods[i - 1]!.id },
    content: {
      version: method.version,
      source: method.sourceFile,
      sourceLines: method.sourceLines,
      method: method.verbatim,
    },
  }));
  const lastMethod = selectedMethods[selectedMethods.length - 1]!.id;
  const inputs = [
    ...methodSources,
    ...(covelPackage
      ? [
          {
            id: "covel-source",
            order: methodSources.length,
            descriptor: { after: lastMethod },
            content: covelPackage,
          },
        ]
      : []),
    {
      id: "accepted-reality",
      order: methodSources.length + 1,
      descriptor: { after: covelPackage ? "covel-source" : lastMethod },
      content: known,
    },
    {
      id: "author-goal",
      order: methodSources.length + 2,
      descriptor: { after: "accepted-reality" },
      content: {
        premise: input.premise,
        scale: input.scale,
        focus: input.focus,
        genre: input.genre,
        worldTime: input.worldTime,
        scarcity: input.scarcity,
        instruction: input.instruction,
      },
    },
  ];
  const ordered = orderSources(inputs);
  if (ordered.diagnostics.some((d) => d.level === "error"))
    throw error(
      "world.source_order_invalid",
      ordered.diagnostics.map((d) => d.message).join("; "),
    );
  const request = {
    ...input,
    sourcePackageText: undefined,
  };
  return JSON.stringify({
    role: "单主角开放世界PVE的世界设计师 + 游戏内容制作人",
    project,
    input: request,
    sourceOrder: ordered.sources.map((source) => ({
      id: source.id,
      content: source.content,
    })),
    activeDimensions: dimensions,
    possibleHistoricalCauses: causalHints.map((event) => ({
      id: event.id,
      description: event.description,
    })),
    atlasProductionContract: WORLD_BUILDER_ATLAS_CONTRACT,
    atlasProductionCrosswalk: WORLD_BUILDER_ATLAS_CROSSWALK,
    productionIntent:
      input.intent === "advance"
        ? "本轮是世界自主推进。基于现存人物/组织/关系/活动继续做决定，不为换地图重置现实。既有人物要用 existingCanonId 复用，不重新发明同名角色；可以生成新的关系变化、未完成事务、结束的旧事务与新进入世界的人。注意以现在世界时间推进 NPC 的独立生活，而不是写男主章纲。"
        : "本轮是世界内容生产。创作完整的地图和社会生活，留足不同人物自己行动和男主未来进入的空间。",
    worldMethod: [
      "不是章节编剧：World Builder 的输出目标是 World Atlas 候选内容，不是一篇世界观。生产稳定对象、typed relations、当前事务和可进入/可争取的现实连接。",
      "W0 从世界大局生成区域、不同社会系统、真实权力机构、价格与流通路径，不能整个世界只围绕男主职业；W1 在已确认W0之下根据类型文×时间地点×稀缺性打开一个区域、行业或圈层。",
      "一轮产出成套互相关联的世界对象：场所、势力、人物、宝物/资格/权利、社会门槛、独立事务。不能只交单项列表或政治经济目录。节点被命名不等于完成，必须尽量接入真实关系网；数量只用于防止过薄，不得为了凑数制造孤立卡片。",
      "People-centered 是叙事生产优先级，不是数据库层级。人物和组织要有自己的目标与当前行动；非人物内容要优先追问谁拥有、控制、掌握、知道、引荐、争夺、使用或交易。确实非人的环境内容不强造NPC。",
      "对于玄幻，考虑功法、境界、丹药、法器、宗门、家族、坊市、朝廷的力量与高价资源。对于历史/现代，力量表现为真实授权、资本、产业、身份、名望与社会关系，仍要形成真正昂贵的男性人生可能性。",
      "以当前已确认世界为Reality。使用给出的已存在实体ID请写 existingCanonId 或 canon:ID；新增节点使用唯一 localId。全部图引用必须能由本包或现有Canon解析；不要捏造数据库ID。",
      "不同身份要分开：当前正在行动 ongoing、尚有可能的 potential、已经结束的 ended。ended 要沿用先前事实记录的 activityLocalId；不能把未来可能发生的事冒充历史事件。历史/原著仅凭模型记忆不能冒称已核实，历史未来不能当当前现实。",
      "用户如果给了已确定的高价目标，应帮助它获得社会共识、稀缺条件和真实人物的争取行为，而不是偷偷改选更普通目标。取得资源后应有真实资产、身份、关系或能力权益并能进一步利用。",
      "给出足够丰富且具体的对象描述、人物实际动作和跨系统连接。WorldPack 只是本轮候选生产批次的 staging envelope；最终世界语言是 World Atlas 的 Card + Typed Edge，不要发展一套与 Atlas 竞争的本体论。",
      "发展轴 dimensionSignals 要来自具体行为反复产生的真实影响，频率和后果权重是观察依据，不是新创造修炼限制/天赋代价的许可；WorldForge引擎会按阈值追踪它们。",
      "possibleHistoricalCauses 是 WorldForge 从旧已确认事件中推荐的前因候选，不等于已确立的因果事实；须依据对象和行动判断，不能直接强行连接。",
      "witnessedHistory 是SNEQ按每个NPC实际参与的事件独立计算的知情范围，不等于所有人都知道作者视角的Timeline。NPC后续行动以本人当前真实所知为起点；没有传播记录的秘密不能凭模型全知直接传播。",
    ],
    // Full content is in sourceOrder; avoid transmitting it twice.
    worldSourceFormat: "Covel WORLD_YAML/WORLD_MD/WORLD_PACKAGE_YAML",
  });
}

export class WorldPackWorkerSuite {
  private readonly projects: SqliteProjectRepository;
  private readonly canon: SqliteCanonRepository;
  private readonly story: SqliteStoryRepository;
  private readonly state: SqliteNarrativeStateRepository;
  private readonly packs: SqliteWorldPackRepository;
  private readonly runs: SqliteRunRepository;
  private readonly parseCovelCached =
    createRevisionCache<ReturnType<typeof parseWorldOutput>>(16);

  constructor(
    private readonly database: NarrativeDatabase,
    private readonly model: NarrativeModelClient,
  ) {
    this.projects = new SqliteProjectRepository(database);
    this.canon = new SqliteCanonRepository(database);
    this.story = new SqliteStoryRepository(database);
    this.state = new SqliteNarrativeStateRepository(
      database,
      this.canon,
      this.story,
    );
    this.packs = new SqliteWorldPackRepository(database);
    this.runs = new SqliteRunRepository(database);
  }

  registry(): WorkerRegistry {
    return {
      "world.context": this.wrap((snap) => this.compileContext(snap)),
      "world.generate": this.wrap((snap, step, signal) =>
        this.generate(snap, step, signal),
      ),
      "world.stage": this.wrap((snap) => this.stage(snap)),
    };
  }

  private wrap(
    fn: (
      snap: RunSnapshot,
      step: NarrativeRunStep,
      signal: AbortSignal,
    ) => Promise<StepExecutionResult>,
  ): StepWorker {
    return { execute: (snap, step, signal) => fn(snap, step, signal) };
  }

  private async compileContext(
    snapshot: RunSnapshot,
  ): Promise<StepExecutionResult> {
    const project = this.projects.get(snapshot.run.projectId);
    if (!project) throw error("project.not_found", "Project is missing");
    const request = WorldPackRequestSchema.parse(
      snapshot.run.policy.worldPackRequest,
    );
    const allEntities = this.canon.listEntities(project.id);
    const allFacts = this.canon.listEffectiveFacts(project.id);
    const allRelationships = this.state.listCurrentRelationships(project.id);
    const contextIds = selectWorldContextIds({
      entities: allEntities,
      facts: allFacts,
      relationships: allRelationships,
      parentAreaId: request.parentAreaId,
      focus: request.focus,
      premise: request.premise,
      maxCount: 110,
    });
    const byId = new Map(allEntities.map((entity) => [entity.id, entity]));
    const nodes = contextIds.map((id) => byId.get(id)!).filter(Boolean);
    const nearby = new Set(contextIds);
    const prioritizedFacts = allFacts.filter(
      (fact) =>
        nearby.has(fact.subjectId) ||
        (fact.objectEntityId !== null && nearby.has(fact.objectEntityId)),
    );
    const facts = prioritizedFacts.slice(0, 140);
    const relationships = allRelationships
      .filter(
        (event) =>
          nearby.has(event.fromEntityId) || nearby.has(event.toEntityId),
      )
      .slice(0, 130);
    const timeline = this.state
      .listTimeline(project.id)
      .filter(
        (event) =>
          event.participants.some((id) => nearby.has(id)) ||
          event.title
            .toLocaleLowerCase()
            .includes(request.focus.toLocaleLowerCase()),
      )
      .slice(-65);
    const sourceText = request.sourcePackageText?.trim() ?? "";
    const covelPackage = sourceText
      ? await this.parseCovelCached(snapshot.run.id, sourceText, async () =>
          parseWorldOutput(sourceText),
        )
      : null;
    if (sourceText && !covelPackage)
      throw error(
        "world.covel_source_invalid",
        "Covel source must include ===WORLD_YAML=== and ===WORLD_MD=== sections",
      );

    // WorldForge's original dynamic-dimension registry is replayed from
    // *adopted* world packages, never from unapproved drafts.
    const dimensions = emptyRegistry();
    const adoptedPacks = this.packs
      .list(project.id)
      .filter((pack) => pack.status === "adopted")
      .reverse();
    for (const [index, pack] of adoptedPacks.entries()) {
      for (const signal of pack.document.dimensionSignals ?? []) {
        const { description, ...replaySignal } = signal;
        tryRegisterDimension(
          dimensions,
          description === undefined
            ? replaySignal
            : { ...replaySignal, description },
          index + 1,
        );
      }
    }

    // WorldForge causal candidates never become confirmed causality by
    // themselves. These are suggestions for the next production prompt.
    const knownTimeline = this.state.listTimeline(project.id);
    const history: SimulationEvent[] = knownTimeline.map((event, index) => ({
      id: event.id,
      tick: index + 1,
      time_label: event.storyTimeStart ?? "",
      type: "historical-event",
      participants: [...event.participants],
      region: "",
      description: event.description ?? event.title,
      major: Boolean(event.causes.length > 0),
      changes: [],
    }));
    const causalHints = causalCandidates(
      { events: history },
      {
        id: "world-next",
        tick: history.length + 1,
        time_label: request.worldTime,
        type: "world-production",
        participants: contextIds,
        region: "",
        description: request.focus || request.premise,
        changes: [],
      },
      6,
    );
    // SNEQ original deriveBeliefs identifies which previously recorded
    // events a character witnessed. The generated actor must not know all
    // canonical history simply because the author does.
    const witnessedHistory = projectNpcWitnessedEvents({
      projectId: project.id,
      characters: nodes.filter((entity) => entity.type === "character"),
      timeline: this.state.listTimeline(project.id),
      maxCharacters: 20,
      maxEventsPerCharacter: 12,
    });
    const packet = {
      witnessedHistory,
      authorIntent: this.story.getAuthorIntent(project.id),
      entities: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        name: node.name,
        description: node.description?.slice(0, 900),
        attributes: JSON.stringify(node.attributes).slice(0, 900),
      })),
      facts: facts.map((fact) => ({
        subjectId: fact.subjectId,
        predicate: fact.predicate,
        objectEntityId: fact.objectEntityId,
        value:
          typeof fact.value === "string"
            ? fact.value.slice(0, 500)
            : JSON.stringify(fact.value).slice(0, 500),
        knowledgeScope: fact.knowledgeScope,
        authority: fact.authority,
      })),
      relationships: relationships.map((event) => ({
        fromEntityId: event.fromEntityId,
        toEntityId: event.toEntityId,
        relation: event.relation,
        state: event.state,
      })),
      timeline: timeline.map((event) => ({
        title: event.title,
        storyTimeStart: event.storyTimeStart,
        description: event.description,
        participants: event.participants,
      })),
      recentOutline: this.story
        .listOutline(project.id)
        .filter(
          (item) => item.status === "committed" || item.status === "review",
        )
        .slice(-40)
        .map((item) => ({
          title: item.title,
          summary: item.summary,
          storyTime: item.storyTime,
        })),
    };
    return {
      artifactKind: "world-context",
      output: {
        request,
        knownCanonIds: allEntities.map((node) => node.id),
        // The program sees the real adopted world; prompt context alone is
        // not enough to control NPC continuity and gameplay conditions.
        existingWorld: projectExistingWorldForProduction({
          entities: nodes.slice(0, 70),
          facts,
          relationships,
        }),
        // Data for the actual WorldForge independent-agent dispatcher.
        // This projection uses accepted Canon identities, not generated IDs.
        worldForgeSeed: {
          worldTitle: project.title,
          worldTime: request.worldTime,
          organizations: nodes
            .filter((node) => node.type === "organization")
            .slice(0, 4)
            .map((node) => ({
              id: node.id,
              name: node.name,
              description: node.description ?? "",
            })),
          locations: nodes
            .filter((node) => node.type === "location")
            .slice(0, 8)
            .map((node) => ({ id: node.id, name: node.name })),
          relationships: relationships.map((relation) => ({
            fromEntityId: relation.fromEntityId,
            toEntityId: relation.toEntityId,
            relation: relation.relation,
          })),
          history: timeline.slice(-30).map((event) => ({
            id: event.id,
            title: event.title,
            description: event.description ?? "",
            participants: [...event.participants],
          })),
        } satisfies WorldForgeFactionSeed,
        prompt: makePrompt(
          request,
          project,
          packet,
          covelPackage,
          dimensions,
          causalHints,
        ),
      },
      usage: NO_USAGE,
    };
  }

  private async generate(
    snapshot: RunSnapshot,
    step: NarrativeRunStep,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    const data = artifact(snapshot, "world.context");
    const ids = new Set(
      Array.isArray(data.knownCanonIds)
        ? data.knownCanonIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
    );
    const request = WorldPackRequestSchema.parse(data.request);
    let factionReviewPrompt = "";
    let factionUsage: RunBudgetUsage = { ...NO_USAGE };
    const seed = data.worldForgeSeed as WorldForgeFactionSeed | undefined;
    if (request.intent === "advance" && seed?.organizations.length) {
      // Run the ORIGINAL WorldForge per-organization parallel agents and
      // arbiter. Do not apply its numeric deltas or automatically settle
      // unapproved events. Only author-reviewable textual proposals enter
      // the main WorldPack world generation request.
      const preview = await previewWorldForgeFactions(seed, {
        real: true,
        call: async ({ systemPrompt, userMessage, maxTokens }) => {
          if (signal.aborted) throw new Error("WorldForge preview cancelled");
          const answer = await this.model.text(
            snapshot.run,
            step,
            "world-pack",
            {
              instructions: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
              ...(maxTokens === undefined
                ? {}
                : { maxOutputTokens: maxTokens }),
            },
            signal,
          );
          factionUsage = {
            inputTokens: factionUsage.inputTokens + answer.usage.inputTokens,
            outputTokens: factionUsage.outputTokens + answer.usage.outputTokens,
            calls: factionUsage.calls + answer.usage.calls,
            costUsd: factionUsage.costUsd + answer.usage.costUsd,
            wallTimeMs: factionUsage.wallTimeMs + answer.usage.wallTimeMs,
          };
          return answer.text;
        },
      });
      factionReviewPrompt =
        "\\n\\n# WorldForge 已有势力的独立行动候选（不是发生过的事实）\\n" +
        JSON.stringify(preview) +
        "\\n这些内容只提供已有组织的自行行动线索。不得把尚未发生的交涉、能力代价、经济数字或资源转移自动写成已确认 Reality。";
    }
    const checkpointRaw = this.runs.getWorldProductionCheckpoint(
      snapshot.run.id,
    );
    const initialCheckpoint: WorldWorkshopCheckpoint | null =
      checkpointRaw && Array.isArray(checkpointRaw.steps) && checkpointRaw.usage
        ? {
            document: WorldPackDocumentSchema.parse(checkpointRaw.document),
            steps:
              checkpointRaw.steps as unknown as WorldWorkshopCheckpoint["steps"],
            usage: checkpointRaw.usage as WorldWorkshopCheckpoint["usage"],
          }
        : null;
    const produced = await runWorldWorkshops({
      run: snapshot.run,
      step,
      model: this.model,
      request,
      basePrompt: String(data.prompt),
      extraContext: factionReviewPrompt,
      knownCanonIds: ids,
      ...(data.existingWorld
        ? { existingWorld: data.existingWorld as WorldPackDocument }
        : {}),
      contract: WORLD_PACK_MODEL_CONTRACT,
      signal,
      initialCheckpoint,
      onCheckpoint: async (checkpoint) => {
        this.runs.saveWorldProductionCheckpoint(
          snapshot.run.id,
          step.id,
          checkpoint as unknown as Record<string, unknown>,
          new Date().toISOString(),
        );
      },
    });
    return {
      artifactKind: "world-pack-generation",
      output: produced.document,
      usage: {
        inputTokens: produced.usage.inputTokens + factionUsage.inputTokens,
        outputTokens: produced.usage.outputTokens + factionUsage.outputTokens,
        calls: produced.usage.calls + factionUsage.calls,
        costUsd: produced.usage.costUsd + factionUsage.costUsd,
        wallTimeMs: produced.usage.wallTimeMs + factionUsage.wallTimeMs,
      },
    };
  }

  private async stage(snapshot: RunSnapshot): Promise<StepExecutionResult> {
    const generated = WorldPackDocumentSchema.parse(
      artifact(snapshot, "world.generate"),
    );
    const context = artifact(snapshot, "world.context");
    const request = WorldPackRequestSchema.parse(context.request);
    const pack = this.packs.insert({
      id: `${snapshot.run.id}:world-pack`,
      projectId: snapshot.run.projectId,
      runId: snapshot.run.id,
      request,
      document: generated,
      now: new Date().toISOString(),
    });
    return {
      artifactKind: "world-pack-draft",
      output: {
        packId: pack.id,
        status: pack.status,
        nodeCount: pack.document.nodes.length,
      },
      usage: NO_USAGE,
    };
  }
}
