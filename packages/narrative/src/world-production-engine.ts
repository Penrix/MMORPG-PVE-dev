import { playWorldActionPaths } from "./world-action-runtime.js";
import type {
  WorldPackDocument,
  WorldPackLink,
  WorldPackNode,
  WorldPackRequest,
} from "@narralume/contracts";
import { worldPackReferenceProblems } from "@narralume/contracts";

/**
 * World content production is a *state machine*, not a giant prompt.
 * Adapted from the author's v0.2 §§1.3, 3.01-3.10, 8.1-8.4 and 9.1-9.7.
 * Each operation works on an actual named subject found in the current graph.
 * The caller, not the LLM, chooses the next operation and when to stop.
 */
export type WorldWorkshop =
  | "geography"
  | "factions"
  | "people"
  | "economy"
  | "power"
  | "events"
  | "social"
  | "playability"
  | "living";

export interface WorldWorkOrder {
  workshop: WorldWorkshop;
  subjectRef: string | null;
  subjectName: string;
  reason: string;
  deliverables: readonly string[];
}

export interface WorldPlaytest {
  entryLocations: string[];
  operatingOrganizations: string[];
  peopleWithSocialTies: string[];
  controlledResources: string[];
  independentActivities: string[];
  actionableRoutes: string[];
  feedbackPaths: string[];
  interactionPaths: string[][];
  next: WorldWorkOrder | null;
}

export interface WorldProductionStep {
  workshop: WorldWorkshop;
  subjectRef: string | null;
  before: { nodes: number; links: number; activities: number };
  after: { nodes: number; links: number; activities: number };
  changedRefs: string[];
}

export function emptyWorldDocument(): WorldPackDocument {
  return {
    summary: "世界内容生产正在进行",
    nodes: [],
    links: [],
    activities: [],
    openThreads: [],
    interactions: [],
    dimensionSignals: [],
  };
}

function snapshot(doc: WorldPackDocument) {
  return {
    nodes: doc.nodes.length,
    links: doc.links.length,
    activities: doc.activities.length,
  };
}

function currentLinks(doc: WorldPackDocument): WorldPackLink[] {
  return doc.links.filter((link) => link.status === "current");
}

function hasLink(doc: WorldPackDocument, id: string, other: string): boolean {
  return currentLinks(doc).some(
    (link) =>
      (link.fromRef === id && link.toRef === other) ||
      (link.toRef === id && link.fromRef === other),
  );
}

function isOwnerRelation(name: string): boolean {
  return /own|control|hold|custod|possess|lead|manag|保管|持有|掌握|控制|所属|经营|拥有|所有|保有|授权|管理|掌柜|寄售/i.test(
    name,
  );
}

function idOf(node: WorldPackNode): string {
  return node.localId;
}

function named(doc: WorldPackDocument, id: string): string {
  return doc.nodes.find((n) => n.localId === id)?.name ?? id;
}

function order(
  workshop: WorldWorkshop,
  ref: string | null,
  doc: WorldPackDocument,
  reason: string,
  deliverables: string[],
): WorldWorkOrder {
  return {
    workshop,
    subjectRef: ref,
    subjectName: ref ? named(doc, ref) : "世界/当前地区",
    reason,
    deliverables,
  };
}

/**
 * Actual graph playtest. No LLM gets to mark a fictional module as completed:
 * geography, authority, people, resources and independent events are derived
 * from relationships and live actors. Missing content yields a *work order*.
 */
export function playtestWorld(
  doc: WorldPackDocument,
  request: WorldPackRequest,
): WorldPlaytest {
  const places = doc.nodes.filter((node) => node.type === "location");
  const factions = doc.nodes.filter((node) => node.type === "organization");
  const people = doc.nodes.filter((node) => node.type === "character");
  const resources = doc.nodes.filter(
    (node) =>
      node.type === "item" || node.type === "rule" || node.type === "concept",
  );
  const live = currentLinks(doc);
  const actors = new Set([...people, ...factions].map(idOf));
  const resourceSet = new Set(resources.map(idOf));

  const operatingOrganizations = factions
    .filter((faction) =>
      places.some(
        (place) =>
          faction.areaRef === place.localId ||
          hasLink(doc, faction.localId, place.localId),
      ),
    )
    .map(idOf);
  const peopleWithSocialTies = people
    .filter(
      (person) =>
        factions.some((faction) =>
          hasLink(doc, person.localId, faction.localId),
        ) ||
        people.some(
          (other) =>
            other.localId !== person.localId &&
            hasLink(doc, person.localId, other.localId),
        ),
    )
    .map(idOf);
  const controlledResources = resources
    .filter((resource) =>
      live.some(
        (link) =>
          (link.toRef === resource.localId &&
            actors.has(link.fromRef) &&
            isOwnerRelation(link.relation)) ||
          (link.fromRef === resource.localId &&
            actors.has(link.toRef) &&
            isOwnerRelation(link.relation)),
      ),
    )
    .map(idOf);
  const independentActivities = doc.activities
    .filter(
      (activity) =>
        activity.stage === "ongoing" &&
        activity.actorRefs.some((ref) => actors.has(ref)) &&
        activity.resourceRefs.some((ref) => resourceSet.has(ref)),
    )
    .map((activity) => activity.localId);
  const actionableRoutes = live
    .filter(
      (link) =>
        places.some(
          (place) =>
            link.fromRef === place.localId || link.toRef === place.localId,
        ) && link.description.trim().length > 5,
    )
    .map((link) => link.fromRef + "→" + link.toRef);
  const feedbackPaths = doc.activities
    .filter(
      (activity) =>
        activity.stage !== "ended" &&
        activity.actorRefs.some((a) => actors.has(a)) &&
        activity.resourceRefs.some((ref) => controlledResources.includes(ref)),
    )
    .map((a) => a.localId);

  const interactionPreview = playWorldActionPaths(doc);
  const interactionPaths = interactionPreview.paths.map(
    (path) => path.actionIds,
  );
  const hasAssetChain = interactionPreview.paths.some(
    (path) =>
      path.actionIds.length >= 2 &&
      path.gained.some(
        (item) =>
          item.kind === "asset" ||
          item.kind === "permission" ||
          item.kind === "ability" ||
          item.kind === "relationship",
      ),
  );
  let next: WorldWorkOrder | null = null;
  if (places.length === 0) {
    next = order("geography", null, doc, "当前世界没有可定位的生活区域", [
      "实际区域/Hub/POI、人员活动、区域间物理和社会入口",
      "W0保留战略广度；W1深入指定区域",
    ]);
  } else if (!operatingOrganizations.length) {
    const target = places[0]!;
    next = order(
      "factions",
      target.localId,
      doc,
      "这里还没有真正掌握业务和权利的组织",
      [
        "具体组织、负责人、内部工作岗位、经营资源、对外利益",
        "组织与当前区域的真实控制或进出关系",
      ],
    );
  } else if (!peopleWithSocialTies.length) {
    const target = factions.find((f) =>
      operatingOrganizations.includes(f.localId),
    )!;
    next = order(
      "people",
      target.localId,
      doc,
      "组织没有能行动的具体人物和私人关系",
      [
        "至少一位有名字、身份、私人生活、目标和能决定实际事项的人",
        "人与现有组织/其他人物的带内容关系及正在做的事",
      ],
    );
  } else if (!controlledResources.length) {
    const target = factions.find((f) =>
      operatingOrganizations.includes(f.localId),
    )!;
    next = order(
      "economy",
      target.localId,
      doc,
      "这台组织机器还没有真实控制的高价资源",
      [
        "具体可获取的资源/资格/资产，产出者、持有者和权限",
        "通过已有组织或人物的关系建立实际权属与取得路径",
        "指出取得后能开展什么新事业或生活",
      ],
    );
  } else if (!independentActivities.length) {
    const target = people.find((p) =>
      peopleWithSocialTies.includes(p.localId),
    )!;
    next = order(
      "events",
      target.localId,
      doc,
      "人物没有依自己利益推进的当前事务",
      [
        "人物已投入的凭借、当前目标、对谁行动、争取哪件具体资源",
        "用actorRefs和resourceRefs联结实际对象，不要发布等主角触发的任务",
      ],
    );
  } else if (!actionableRoutes.length) {
    next = order(
      "social",
      places[0]!.localId,
      doc,
      "世界有内容却没有真正可进入的社会/空间通道",
      [
        "从当前区域通往人物、组织、资源的具体中介、凭据和动作",
        "不同进入方式具有不同范围的实际权限",
      ],
    );
  } else if (!feedbackPaths.length) {
    const target = resources.find((r) =>
      controlledResources.includes(r.localId),
    )!;
    next = order(
      "playability",
      target.localId,
      doc,
      "拿到资源之后找不到可以继续推动的现实事务",
      [
        "通过已有资产能发起哪些不同性质的具体行动",
        "把资产、行动者、权利变化、下一层世界入口连成可追踪的反馈链",
      ],
    );
  }

  if (!next && !hasAssetChain) {
    const resource = resources.find((r) =>
      controlledResources.includes(r.localId),
    );
    next = order(
      "playability",
      resource?.localId ?? places[0]?.localId ?? null,
      doc,
      "目前的地图无法从真实入口完成两段连续行动，获得可复用的新资产或权限",
      [
        "制作具体可执行的互动动作：谁提供、在哪里、需要什么已有资格",
        "明确行动后可能得到的资产、权限、人物关系或下一片社会入口",
        "使至少两种行动能通过同一资产/关系状态接续，不预设男主已赢",
      ],
    );
  }

  // Do not turn fantasy into generic social simulation: the world itself
  // needs usable power facts and actual actions; no protagonist costs invented.
  if (
    !next &&
    request.scale === "W0" &&
    request.intent !== "advance" &&
    /玄幻|修仙|武侠|忍术|火影|斗气|魔法|奇幻|超凡/.test(
      request.genre + request.premise,
    )
  ) {
    const hasPower = resources.some(
      (n) =>
        n.type === "rule" &&
        n.value.trim().length > 0 &&
        live.some(
          (edge) => edge.fromRef === n.localId || edge.toRef === n.localId,
        ),
    );
    if (!hasPower)
      next = order(
        "power",
        null,
        doc,
        "超凡世界还没有可执行的公共力量与社会作用",
        [
          "这个世界至少一种实际可运作的公共能力/修炼规则",
          "持有人、施展动作、能够做什么及其社会价格",
          "不得擅自给男主金手指增加代价或削弱效果",
        ],
      );
  }

  return {
    entryLocations: places.map(idOf),
    operatingOrganizations,
    peopleWithSocialTies,
    controlledResources,
    independentActivities,
    actionableRoutes,
    feedbackPaths,
    interactionPaths,
    next,
  };
}

/**
 * Merge an independently produced game-content increment. This is *not*
 * concatenating unrelated cards: stable IDs must retain identity, all graph
 * references must resolve, and changed fields are recorded for progress.
 */
export function applyWorldProductionDelta(
  current: WorldPackDocument,
  patch: WorldPackDocument,
  knownCanonIds: ReadonlySet<string>,
  workshop: WorldWorkshop,
  subjectRef: string | null,
): { document: WorldPackDocument; step: WorldProductionStep } {
  const nodeMap = new Map(current.nodes.map((n) => [n.localId, n]));
  const changes = new Set<string>();
  for (const incoming of patch.nodes) {
    const previous = nodeMap.get(incoming.localId);
    if (
      previous &&
      (previous.type !== incoming.type ||
        previous.name !== incoming.name ||
        previous.existingCanonId !== incoming.existingCanonId)
    ) {
      throw new Error("world.production.identity_changed: " + incoming.localId);
    }
    if (!previous || JSON.stringify(previous) !== JSON.stringify(incoming)) {
      nodeMap.set(incoming.localId, incoming);
      changes.add(incoming.localId);
    }
  }
  const linkMap = new Map(
    current.links.map((link) => [
      link.fromRef + "|" + link.relation + "|" + link.toRef,
      link,
    ]),
  );
  for (const link of patch.links) {
    const id = link.fromRef + "|" + link.relation + "|" + link.toRef;
    const old = linkMap.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(link)) {
      linkMap.set(id, link);
      changes.add(id);
    }
  }
  const activityMap = new Map(current.activities.map((a) => [a.localId, a]));
  for (const action of patch.activities) {
    const prior = activityMap.get(action.localId);
    if (!prior || JSON.stringify(prior) !== JSON.stringify(action)) {
      activityMap.set(action.localId, action);
      changes.add(action.localId);
    }
  }
  const interactionMap = new Map(
    (current.interactions ?? []).map((a) => [a.localId, a]),
  );
  for (const action of patch.interactions ?? []) {
    const prior = interactionMap.get(action.localId);
    if (!prior || JSON.stringify(prior) !== JSON.stringify(action)) {
      interactionMap.set(action.localId, action);
      changes.add("action:" + action.localId);
    }
  }
  const dimensions = new Map(
    (current.dimensionSignals ?? []).map((s) => [s.kind + ":" + s.dim, s]),
  );
  for (const signal of patch.dimensionSignals ?? [])
    dimensions.set(signal.kind + ":" + signal.dim, signal);
  const document: WorldPackDocument = {
    summary: patch.summary || current.summary,
    nodes: [...nodeMap.values()],
    links: [...linkMap.values()],
    activities: [...activityMap.values()],
    interactions: [...interactionMap.values()],
    openThreads: [
      ...new Set([...current.openThreads, ...patch.openThreads]),
    ].slice(0, 70),
    dimensionSignals: [...dimensions.values()].slice(0, 30),
  };
  const problems = worldPackReferenceProblems(document, knownCanonIds);
  if (problems.length)
    throw new Error("world.production.bad_graph: " + problems.join("; "));
  if (
    document.nodes.length > 80 ||
    document.links.length > 180 ||
    document.activities.length > 80 ||
    (document.interactions?.length ?? 0) > 90
  )
    throw new Error(
      "world.production.graph_limit: deepen existing nodes or save a second W1 package",
    );
  return {
    document,
    step: {
      workshop,
      subjectRef,
      before: snapshot(current),
      after: snapshot(document),
      changedRefs: [...changes],
    },
  };
}

/** Return a build instruction for one *real* work order, not a generic ten-card checklist. */
export function worldWorkOrderInput(
  order: WorldWorkOrder,
  state: WorldPackDocument,
): Record<string, unknown> {
  return {
    command: "produce_world_content",
    operation: order.workshop,
    actualSubject: { ref: order.subjectRef, name: order.subjectName },
    whyThisOperation: order.reason,
    requiredWorldProducts: order.deliverables,
    currentWorld: state,
    rule: "Make concrete people, permissions, businesses, action and rewards. Reuse existing local IDs to deepen; new IDs must be unique. Return only the new or revised world-content increment. Never author a chapter outline. The engine decides the next work order.",
  };
}
