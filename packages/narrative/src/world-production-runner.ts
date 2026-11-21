import {
  WORLD_BUILDER_ATLAS_CONTRACT,
  WorldPackDocumentSchema,
  worldBuilderAtlasTarget,
  worldPackAtlasKind,
  type WorldPackDocument,
  type WorldPackRequest,
} from "@narralume/contracts";
import type { JsonSchemaContract } from "@narralume/llm";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { NarrativeModelClient } from "./model-client.js";
import {
  applyWorldProductionDelta,
  emptyWorldDocument,
  playtestWorld,
  worldWorkOrderInput,
  type WorldWorkOrder,
  type WorldWorkshop,
  type WorldProductionStep,
} from "./world-production-engine.js";
import { previewProductionReality } from "./world-production-reality.js";
import {
  initialWorldWorkshopOrder,
  powerDesignProducts,
  resolveWorldDesignEntry,
} from "./world-design-policy.js";

const ZERO: RunBudgetUsage = {
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,
  costUsd: 0,
  wallTimeMs: 0,
};

function addUsage(a: RunBudgetUsage, b: RunBudgetUsage): RunBudgetUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    calls: a.calls + b.calls,
    costUsd: a.costUsd + b.costUsd,
    wallTimeMs: a.wallTimeMs + b.wallTimeMs,
  };
}

/** Bootstrap hints only. They are not a mandatory pipeline.
 * After the first real object exists, the graph/audit chooses the next work.
 */
function bootstrapWorkshops(request: WorldPackRequest): WorldWorkshop[] {
  return [...initialWorldWorkshopOrder(request)];
}

function subjectFor(
  workshop: WorldWorkshop,
  doc: WorldPackDocument,
  request: WorldPackRequest,
): string | null {
  const entry = resolveWorldDesignEntry(request, doc);
  if (entry?.workshop === workshop) return entry.subjectRef;
  const org = doc.nodes.find((n) => n.type === "organization");
  const npc = doc.nodes.find((n) => n.type === "character");
  const zone = doc.nodes.find((n) => n.type === "location");
  const resource = doc.nodes.find((n) =>
    ["resource", "item", "work", "ability", "rule", "technology"].includes(
      worldPackAtlasKind(n),
    ),
  );
  if (workshop === "factions" || workshop === "social")
    return zone?.localId ?? null;
  if (workshop === "people" || workshop === "economy" || workshop === "living")
    return org?.localId ?? zone?.localId ?? null;
  if (workshop === "events") return npc?.localId ?? org?.localId ?? null;
  if (workshop === "playability")
    return resource?.localId ?? zone?.localId ?? null;
  return null;
}

function workOrder(
  workshop: WorldWorkshop,
  doc: WorldPackDocument,
  request: WorldPackRequest,
): WorldWorkOrder {
  const ref = subjectFor(workshop, doc, request);
  const node = doc.nodes.find((n) => n.localId === ref);
  const workshops: Record<
    WorldWorkshop,
    { reason: string; products: string[] }
  > = {
    geography: {
      reason:
        "构建可进入的地理、控制、社会与信息地图，区域可以被生活而非只用作背景",
      products: [
        "Zone/Hub/POI、真实场所及已有来往",
        "进入区域的社会/交通通道，连接相邻地图",
      ],
    },
    factions: {
      reason: "让既存区域有真实运行的组织机器，不是阵营名称",
      products: [
        "组织的实际内部工作、掌权人物和对外利益",
        "负责人、岗位和区域权利的具体关系",
      ],
    },
    people: {
      reason: "使组织变成有家庭、职业、欲望、具体行动能力和私人关系的人",
      products: [
        "具名人物、当前独立目标与真实日常",
        "人物在组织或私人关系中的实际权限和交往",
      ],
    },
    economy: {
      reason: "生产资源链/资产权属/进阶资本，不能拿到东西后只加一行数字",
      products: [
        "一件具体可生产、交换、争夺、享受的高价资源",
        "实际所有人、供应生产链、取得程序和能复用的收益",
      ],
    },
    power: {
      reason:
        "制作本世界公共可执行的能力规则和社会价格，保持作者指定金手指独立",
      products: [
        "具有具体效果的公共技能/力量/资格",
        "掌握该力量的人、可用动作、与物品/社会权限的关系",
      ],
    },
    events: {
      reason: "让人物因自己的目标与利益进行事务，男主不出现也不会停止",
      products: [
        "具体 actor、已投入的凭借、正在采取的动作",
        "行动涉及真实资源与另一方利益、可能改变的后续状态",
      ],
    },
    social: {
      reason: "把地图、人物、组织与高价内容连接成可进入的真实社会",
      products: [
        "中介人/资格/推荐/交易形成的不同入口",
        "不同入口的实际价格和可获取权限",
      ],
    },
    playability: {
      reason:
        "玩一次已有世界：具体人物凭现有资源做事、取得新权利、再引出下一行动",
      products: [
        "可重复利用的资产/权限/行动关系而非一次任务列表",
        "到下一片地区或另一个社会圈层的非唯一通路",
      ],
    },
    living: {
      reason: "由既存 NPC/势力自主提出行动和变更，保留已有历史和资产",
      products: [
        "既有角色因已知利益主动行动，复用其 Canon ID",
        "NPC采取的具体动作、持续事务状态与他人回应",
      ],
    },
  };
  const spec = workshops[workshop];
  const atlasTarget = worldBuilderAtlasTarget(workshop);
  return {
    workshop,
    subjectRef: ref,
    subjectName: node?.name ?? "当前世界",
    reason: spec.reason,
    deliverables:
      workshop === "power" ? powerDesignProducts(request) : spec.products,
    targetFamilies: atlasTarget.families,
    suggestedCardKinds: atlasTarget.cardKinds,
    peopleQuestions: atlasTarget.peopleQuestions,
    completionRule: atlasTarget.completionRule,
  };
}

function hasWorkshopOutput(
  workshop: WorldWorkshop,
  previous: WorldPackDocument,
  current: WorldPackDocument,
): boolean {
  const beforeNodes = new Set(previous.nodes.map((n) => n.localId));
  const added = current.nodes.filter((n) => !beforeNodes.has(n.localId));
  const oldEdges = new Set(
    previous.links.map((l) => l.fromRef + "|" + l.relation + "|" + l.toRef),
  );
  const edges = current.links.filter(
    (l) =>
      l.status === "current" &&
      !oldEdges.has(l.fromRef + "|" + l.relation + "|" + l.toRef),
  );
  const actors = new Set(
    current.nodes
      .filter((n) => n.type === "character" || n.type === "organization")
      .map((n) => n.localId),
  );
  const zones = new Set(
    current.nodes.filter((n) => n.type === "location").map((n) => n.localId),
  );
  const resources = new Set(
    current.nodes
      .filter((n) =>
        ["resource", "item", "work", "ability", "rule", "technology"].includes(
          worldPackAtlasKind(n),
        ),
      )
      .map((n) => n.localId),
  );
  const newActions = current.activities.filter(
    (a) => !previous.activities.some((b) => b.localId === a.localId),
  );
  const newInteractions = (current.interactions ?? []).filter(
    (a) => !(previous.interactions ?? []).some((b) => b.localId === a.localId),
  );

  if (workshop === "geography")
    return added.some(
      (n) =>
        n.type === "location" &&
        n.description.length > 15 &&
        n.access.length > 0,
    );
  if (workshop === "factions")
    return current.nodes.some(
      (n) =>
        n.type === "organization" &&
        (added.some((x) => x.localId === n.localId) ||
          edges.some(
            (e) => e.fromRef === n.localId || e.toRef === n.localId,
          )) &&
        (zones.has(n.areaRef ?? "") ||
          edges.some(
            (e) =>
              (e.fromRef === n.localId && zones.has(e.toRef)) ||
              (e.toRef === n.localId && zones.has(e.fromRef)),
          )),
    );
  if (workshop === "people")
    return current.nodes.some(
      (n) =>
        n.type === "character" &&
        (added.some((x) => x.localId === n.localId) ||
          edges.some(
            (e) => e.fromRef === n.localId || e.toRef === n.localId,
          )) &&
        edges.some(
          (e) =>
            (e.fromRef === n.localId && actors.has(e.toRef)) ||
            (e.toRef === n.localId && actors.has(e.fromRef)),
        ),
    );
  if (workshop === "economy")
    return (
      edges.some(
        (e) =>
          (actors.has(e.fromRef) && resources.has(e.toRef)) ||
          (actors.has(e.toRef) && resources.has(e.fromRef)),
      ) &&
      current.nodes.some(
        (n) =>
          resources.has(n.localId) &&
          n.value.trim().length > 0 &&
          n.access.trim().length > 0,
      )
    );
  if (workshop === "power")
    return current.nodes.some(
      (n) =>
        ["ability", "rule", "technology"].includes(worldPackAtlasKind(n)) &&
        (added.some((x) => x.localId === n.localId) ||
          edges.some((e) => e.fromRef === n.localId || e.toRef === n.localId)),
    );
  if (workshop === "events")
    return newActions.some(
      (a) =>
        a.stage === "ongoing" &&
        a.actorRefs.some((id) => actors.has(id)) &&
        a.resourceRefs.some((id) => resources.has(id)),
    );
  if (workshop === "living")
    return newActions.some(
      (a) =>
        a.stage === "ongoing" &&
        a.actorRefs.some((id) => actors.has(id)) &&
        a.resourceRefs.some((id) => resources.has(id)),
    );
  if (workshop === "social")
    return edges.some(
      (e) =>
        (zones.has(e.fromRef) || zones.has(e.toRef)) &&
        (actors.has(e.fromRef) || actors.has(e.toRef)),
    );
  if (workshop === "playability")
    return (
      newInteractions.length > 0 &&
      newInteractions.some(
        (a) => a.state === "available" && a.yields.length > 0,
      )
    );
  return false;
}

export interface WorldWorkshopCheckpoint {
  document: WorldPackDocument;
  usage: RunBudgetUsage;
  steps: readonly WorldProductionStep[];
}

export interface WorldWorkshopRun {
  document: WorldPackDocument;
  usage: RunBudgetUsage;
  steps: readonly WorldProductionStep[];
  remaining: WorldWorkOrder | null;
}

/**
 * Each selected workshop must produce a real object/link/action contribution.
 * Selection is deficiency-driven, can repeat the same workshop, and stops
 * when blocking graph gaps are gone. The model never marks modules complete.
 */
export async function runWorldWorkshops(args: {
  run: NarrativeRun;
  step: NarrativeRunStep;
  model: NarrativeModelClient;
  request: WorldPackRequest;
  basePrompt: string;
  knownCanonIds: ReadonlySet<string>;
  existingWorld?: WorldPackDocument;
  contract: JsonSchemaContract;
  signal: AbortSignal;
  extraContext?: string;
  initialCheckpoint?: WorldWorkshopCheckpoint | null;
  onCheckpoint?: (checkpoint: WorldWorkshopCheckpoint) => Promise<void> | void;
}): Promise<WorldWorkshopRun> {
  let state = args.initialCheckpoint?.document ?? emptyWorldDocument();
  let usage = args.initialCheckpoint?.usage ?? { ...ZERO };
  const steps: WorldProductionStep[] = [
    ...(args.initialCheckpoint?.steps ?? []),
  ];
  const existingWorld = args.existingWorld ?? emptyWorldDocument();
  const view = () => previewProductionReality(existingWorld, state);
  const bootstrap = bootstrapWorkshops(args.request);
  // The queue is deliberately open: a workshop may repeat if the same real
  // deficiency remains, and unrelated workshops are not executed merely to
  // tick a checklist. The bootstrap list is only a fallback for an otherwise
  // undiagnosable empty start.
  const maxSteps = 16;
  for (let index = steps.length; index < maxSteps; index++) {
    const check = playtestWorld(view(), args.request);
    const firstStep = steps.length === 0 && index === 0;
    const requestedEntry = firstStep
      ? resolveWorldDesignEntry(args.request, view())
      : null;
    const op =
      firstStep && args.request.intent === "advance"
        ? workOrder("living", view(), args.request)
        : requestedEntry
          ? workOrder(requestedEntry.workshop, view(), args.request)
          : (check.next ??
            (steps.length === 0 && bootstrap[0]
              ? workOrder(bootstrap[0], view(), args.request)
              : null));
    if (!op) break;
    const instruction = {
      ...worldWorkOrderInput(op, view()),
      authorRequest: args.request,
      ...(index === 0
        ? {
            sourceWorldAndMethods: args.basePrompt,
            notes: args.extraContext ?? "",
          }
        : {}),
      worldBuilderAtlasContract: WORLD_BUILDER_ATLAS_CONTRACT,
      atlasAudit: playtestWorld(view(), args.request).atlasAudit,
      alreadyProduced: steps.map((s) => ({
        workshop: s.workshop,
        subjectRef: s.subjectRef,
        changedRefs: s.changedRefs,
      })),
      resultContract:
        "Return one candidate World Atlas production increment in the current WorldPack staging envelope: concrete objects, typed relations, current activities and useful access/value connections. Reuse the same local IDs for edits. Existing Canon IDs must not be fabricated. Partial refs may point to prior increments. A newly named object alone is not a product; connect it into the world graph.",
    };
    const result = await args.model.structured<WorldPackDocument>(
      args.run,
      args.step,
      "world-pack",
      {
        instructions:
          "执行一个明确的 World Atlas 世界内容生产工序。不是写剧情大纲，不是生成一篇完整世界观，也不是填十个标题。生产具体对象并用 typed relations 接入现实关系网；People-centered 是生产优先级而不是数据库层级。程序将依据实际缺口另行选择后续工序。",
        messages: [{ role: "user", content: JSON.stringify(instruction) }],
        reasoningEffort: "medium",
      },
      args.contract,
      (value) => {
        const parsed = WorldPackDocumentSchema.safeParse(value);
        if (!parsed.success)
          return {
            success: false,
            issues: parsed.error.issues.map(
              (i) => i.path.join(".") + ": " + i.message,
            ),
          };
        try {
          const merged = applyWorldProductionDelta(
            state,
            parsed.data,
            args.knownCanonIds,
            op.workshop,
            op.subjectRef,
          );
          if (
            !hasWorkshopOutput(
              op.workshop,
              view(),
              previewProductionReality(existingWorld, merged.document),
            )
          ) {
            return {
              success: false,
              issues: [
                "world.workshop.no_product: " +
                  op.workshop +
                  " did not produce its promised world entities/relations/actions. Continue this actual object.",
              ],
            };
          }
          return { success: true, data: parsed.data };
        } catch (e) {
          return {
            success: false,
            issues: [e instanceof Error ? e.message : String(e)],
          };
        }
      },
      args.signal,
    );
    const merged = applyWorldProductionDelta(
      state,
      result.value,
      args.knownCanonIds,
      op.workshop,
      op.subjectRef,
    );
    state = merged.document;
    steps.push(merged.step);
    usage = addUsage(usage, result.usage);
    await args.onCheckpoint?.({ document: state, usage, steps: [...steps] });
  }
  const remaining = playtestWorld(view(), args.request).next;
  if (remaining) {
    // Never silently stage a package while a blocking structural deficiency
    // still exists. Non-blocking Atlas audit gaps remain recommendations for
    // the next expansion batch, not mandatory checklist failures.
    throw new Error(
      "world.production.unfinished: " +
        remaining.workshop +
        " " +
        remaining.subjectName +
        " " +
        remaining.reason +
        "; completed workshops: " +
        steps.map((s) => s.workshop).join(","),
    );
  }
  const playtest = playtestWorld(view(), args.request);
  const document: WorldPackDocument = {
    ...state,
    production: {
      engine: "mmorpg-world-workshop-v1",
      executed: steps.map((step) => ({
        workshop: step.workshop,
        subjectRef: step.subjectRef,
        changedRefs: step.changedRefs,
      })),
      playtestedPaths: playtest.interactionPaths,
      atlasAudit: playtest.atlasAudit,
    },
  };
  return { document, usage, steps, remaining: null };
}
