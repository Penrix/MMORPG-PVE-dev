import {
  WorldPackDocumentSchema,
  WorldPackRequestSchema,
  worldPackReferenceProblems,
  type WorldPackDocument,
  type WorldPackRequest,
} from "@narralume/contracts";
import type { NarrativeRunStep, RunBudgetUsage, RunSnapshot } from "@narralume/domain";
import type { WorkerRegistry, StepExecutionResult, StepWorker } from "@narralume/harness";
import type { JsonSchemaContract } from "@narralume/llm";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRepository,
  SqliteStoryRepository,
  SqliteWorldPackRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import type { NarrativeModelClient } from "./model-client.js";
import { MMORPG_WORLD_METHOD_EXCERPTS } from "./mmorpg-world-method.js";

const txt = (description: string) => ({ type: "string", description });
const nullable = (description: string) => ({
  anyOf: [{ type: "string" }, { type: "null" }],
  description,
});

const NODE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["localId", "existingCanonId", "type", "name", "description", "areaRef", "value", "access", "motive", "currentActivity", "origin", "sourceNote"],
  properties: {
    localId: txt("Local stable ID for this pack, e.g. guild_hall; never a database UUID"),
    existingCanonId: nullable("Existing Canon entity UUID ONLY if updating/reusing that exact entity; else null"),
    type: { type: "string", enum: ["character", "location", "organization", "item", "rule", "concept"] },
    name: txt("Specific named world object"),
    description: txt("Detailed full description of actual world content, not a label"),
    areaRef: nullable("Existing local node ID or canon:<known-entity-UUID>; null if whole-world"),
    value: txt("Who values this object and what concrete price it has in the world"),
    access: txt("How a person actually reaches, acquires or gains access to it"),
    motive: txt("Its personal/organizational goal or what makes this rule/location meaningful"),
    currentActivity: txt("An actual current action by this person/group/location or its current world function"),
    origin: { type: "string", enum: ["original", "inference", "historical_claim", "source_canon"] },
    sourceNote: txt("Grounding/citation or note; do not pretend model recall was externally verified"),
  },
};

export const WORLD_PACK_MODEL_CONTRACT: JsonSchemaContract = {
  name: "world_content_package",
  description: "An interconnected world package with entity records, graph edges and existing independent activities.",
  strict: true,
  schema: {
    type: "object", additionalProperties: false,
    required: ["summary", "nodes", "links", "activities", "openThreads"],
    properties: {
      summary: txt("What actual world has been produced and how people live there"),
      nodes: { type: "array", minItems: 4, maxItems: 80, items: NODE_SCHEMA },
      links: {
        type: "array", minItems: 2, maxItems: 180,
        items: {
          type: "object", additionalProperties: false,
          required: ["fromRef", "toRef", "relation", "description", "status"],
          properties: {
            fromRef: txt("Local node ID or canon:<existing UUID>"),
            toRef: txt("Local node ID or canon:<existing UUID>"),
            relation: txt("owns / leads / employs / knows / competes / trades / access-through etc"),
            description: txt("A concrete social, ownership or geographic connection"),
            status: { type: "string", enum: ["current", "possible"] },
          },
        },
      },
      activities: {
        type: "array", minItems: 1, maxItems: 80,
        items: {
          type: "object", additionalProperties: false,
          required: ["localId", "actorRefs", "description", "reason", "resourceRefs", "stage", "worldTime"],
          properties: {
            localId: txt("Unique local activity ID"),
            actorRefs: { type: "array", minItems: 1, items: txt("Local node ID or canon:<existing UUID>") },
            description: txt("What a real character or organization is doing even without the protagonist"),
            reason: txt("Their own motive and why they started it"),
            resourceRefs: { type: "array", items: txt("Local or Canon reference of an actual resource") },
            stage: { type: "string", enum: ["ongoing", "potential", "ended"] },
            worldTime: txt("Time in the world's current calendar or relative to current reality"),
          },
        },
      },
      openThreads: { type: "array", maxItems: 70, items: txt("Further naturally arising world content to develop") },
    },
  },
};

const NO_USAGE: RunBudgetUsage = {
  inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0, wallTimeMs: 0,
};

function error(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, retryable: false });
}

function artifact(snapshot: RunSnapshot, kind: NarrativeRunStep["kind"]): Record<string, unknown> {
  const result = [...snapshot.steps].reverse().find((item) => item.kind === kind && item.status === "succeeded")?.outputArtifact;
  if (!result) throw error("world.artifact.missing", `Missing ${kind}`);
  return { ...result };
}

function makePrompt(input: WorldPackRequest, project: { title: string; premise: string | null }, known: Record<string, unknown>): string {
  return JSON.stringify({
    role: "单主角开放世界PVE的世界设计师 + 游戏内容制作人",
    project,
    input,
    productionIntent: input.intent === "advance"
      ? "本轮是世界自主推进。基于现存人物/组织/关系/活动继续做决定，不为换地图重置现实。既有人物要用 existingCanonId 复用，不重新发明同名角色；可以生成新的关系变化、未完成事务、结束的旧事务与新进入世界的人。注意以现在世界时间推进 NPC 的独立生活，而不是写男主章纲。"
      : "本轮是世界内容生产。创作完整的地图和社会生活，留足不同人物自己行动和男主未来进入的空间。",
    worldMethod: [
      "不是章节编剧：先制造男主不存在时就能自行运作的现实。写具体有价值的人、地、物、机构、力量和当前正在做的事。",
      "W0 从世界大局生成区域、不同社会系统、真实权力机构、价格与流通路径，不能整个世界只围绕男主职业；W1 在已确认W0之下根据类型文×时间地点×稀缺性打开一个区域、行业或圈层。",
      "一轮产出成套互相关联的世界对象：场所、势力、NPC、宝物/资格/权利、社会门槛、独立事务。不能只交单项列表或政治经济目录。W0 建议12-30个具体对象、8-20条有效关系、至少4项人物独立事务；W1建议8-25个具体对象。已有材料充足或范围狭小时可相应调整，不能仅凑数量。",
      "每个人和组织都有自己的目标和当前行动；Resource要有实际持有人、争取者、使用价值与取得路径；关系边具体说明谁控制/引荐/竞争/交易，而不是单一好感条。",
      "对于玄幻，考虑功法、境界、丹药、法器、宗门、家族、坊市、朝廷的力量与高价资源。对于历史/现代，力量表现为真实授权、资本、产业、身份、名望与社会关系，仍要形成真正昂贵的男性人生可能性。",
      "以当前已确认世界为Reality。使用给出的已存在实体ID请写 existingCanonId 或 canon:ID；新增节点使用唯一 localId。全部图引用必须能由本包或现有Canon解析；不要捏造数据库ID。",
      "不同身份要分开：当前正在行动 ongoing、尚有可能的 potential、已经结束的 ended。ended 要沿用先前事实记录的 activityLocalId；不能把未来可能发生的事冒充历史事件。历史/原著仅凭模型记忆不能冒称已核实，历史未来不能当当前现实。",
      "用户如果给了已确定的高价目标，应帮助它获得社会共识、稀缺条件和真实人物的争取行为，而不是偷偷改选更普通目标。取得资源后应有真实资产、身份、关系或能力权益并能进一步利用。",
      "给出足够丰富且具体的对象描述、人物实际动作和跨系统连接。输出所有 nodes/links/activities 是同一个互相引用的世界包，不是分七轮的泛用Canon修改候选。",
    ],
    originalMMORPGMethod: MMORPG_WORLD_METHOD_EXCERPTS,
    currentReality: known,
  });
}

export class WorldPackWorkerSuite {
  private readonly projects: SqliteProjectRepository;
  private readonly canon: SqliteCanonRepository;
  private readonly story: SqliteStoryRepository;
  private readonly state: SqliteNarrativeStateRepository;
  private readonly packs: SqliteWorldPackRepository;

  constructor(private readonly database: NarrativeDatabase, private readonly model: NarrativeModelClient) {
    this.projects = new SqliteProjectRepository(database);
    this.canon = new SqliteCanonRepository(database);
    this.story = new SqliteStoryRepository(database);
    this.state = new SqliteNarrativeStateRepository(database, this.canon, this.story);
    this.packs = new SqliteWorldPackRepository(database);
  }

  registry(): WorkerRegistry {
    return {
      "world.context": this.wrap((snap) => this.compileContext(snap)),
      "world.generate": this.wrap((snap, step, signal) => this.generate(snap, step, signal)),
      "world.stage": this.wrap((snap) => this.stage(snap)),
    };
  }

  private wrap(
    fn: (snap: RunSnapshot, step: NarrativeRunStep, signal: AbortSignal) => Promise<StepExecutionResult>,
  ): StepWorker {
    return { execute: (snap, step, signal) => fn(snap, step, signal) };
  }

  private async compileContext(snapshot: RunSnapshot): Promise<StepExecutionResult> {
    const project = this.projects.get(snapshot.run.projectId);
    if (!project) throw error("project.not_found", "Project is missing");
    const request = WorldPackRequestSchema.parse(snapshot.run.policy.worldPackRequest);
    const allEntities = this.canon.listEntities(project.id);
    const query = [request.focus, request.premise].join(" ").toLowerCase();
    const prioritized = [...allEntities].sort((a,b) => Number(query.includes(b.name.toLowerCase())) - Number(query.includes(a.name.toLowerCase())));
    const nodes = prioritized.slice(0, 110);
    if (request.parentAreaId && !nodes.some((item) => item.id === request.parentAreaId)) {
      const parent = allEntities.find((item) => item.id === request.parentAreaId);
      if (parent) nodes.unshift(parent);
    }
    const facts = this.canon.listEffectiveFacts(project.id).slice(-140);
    const relationships = this.state.listCurrentRelationships(project.id).slice(-130);
    const timeline = this.state.listTimeline(project.id).slice(-65);
    const packet = {
      authorIntent: this.story.getAuthorIntent(project.id),
      entities: nodes.map((node) => ({
        id: node.id, type: node.type, name: node.name,
        description: node.description?.slice(0, 900),
        attributes: JSON.stringify(node.attributes).slice(0, 900),
      })),
      facts: facts.map((fact) => ({
        subjectId: fact.subjectId, predicate: fact.predicate,
        objectEntityId: fact.objectEntityId,
        value: typeof fact.value === "string" ? fact.value.slice(0, 500) : JSON.stringify(fact.value).slice(0,500),
        knowledgeScope: fact.knowledgeScope, authority: fact.authority,
      })),
      relationships: relationships.map((event) => ({
        fromEntityId: event.fromEntityId, toEntityId: event.toEntityId,
        relation: event.relation, state: event.state,
      })),
      timeline: timeline.map((event) => ({
        title: event.title, storyTimeStart: event.storyTimeStart,
        description: event.description, participants: event.participants,
      })),
      recentOutline: this.story.listOutline(project.id).filter((item) =>
        item.status === "committed" || item.status === "review",
      ).slice(-40).map((item) => ({ title: item.title, summary: item.summary, storyTime: item.storyTime })),
    };
    return {
      artifactKind: "world-context",
      output: {
        request, knownCanonIds: allEntities.map((node) => node.id),
        prompt: makePrompt(request, project, packet),
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
        ? data.knownCanonIds.filter((id): id is string => typeof id === "string")
        : [],
    );
    const result = await this.model.structured<WorldPackDocument>(
      snapshot.run, step, "world-pack",
      {
        instructions: "根据用户给定的当前世界与真实实体ID，一次生成互有关联的完整世界包。具体丰富，使用中文。候选世界不得自动变成已发生的历史。严格遵循Schema。",
        messages: [{ role: "user", content: String(data.prompt) }],
        reasoningEffort: "medium",
      },
      WORLD_PACK_MODEL_CONTRACT,
      (value) => {
        const parsed = WorldPackDocumentSchema.safeParse(value);
        if (!parsed.success) return {
          success: false,
          issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        };
        const issues = worldPackReferenceProblems(parsed.data, ids);
        return issues.length ? { success: false, issues } : { success: true, data: parsed.data };
      },
      signal,
    );
    return {
      artifactKind: "world-pack-generation",
      output: result.value,
      usage: result.usage,
    };
  }

  private async stage(snapshot: RunSnapshot): Promise<StepExecutionResult> {
    const generated = WorldPackDocumentSchema.parse(artifact(snapshot, "world.generate"));
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
      output: { packId: pack.id, status: pack.status, nodeCount: pack.document.nodes.length },
      usage: NO_USAGE,
    };
  }
}
