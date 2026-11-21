import { playWorldActionPaths } from "./world-action-runtime.js";
import { powerDesignProducts } from "./world-design-policy.js";
import {
  WORLD_ATLAS_CONTENT_FAMILIES,
  worldBuilderAtlasTarget,
  worldPackReferenceProblems,
  type WorldAtlasCardKind,
  type WorldAtlasContentFamily,
  type WorldBuilderWorkshopId,
  type WorldPackDocument,
  type WorldPackLink,
  type WorldPackNode,
  type WorldPackRequest,
} from "@narralume/contracts";

/**
 * World content production is a *state machine*, not a giant prompt.
 * Adapted from the author's v0.2 §§1.3, 3.01-3.10, 8.1-8.4 and 9.1-9.7.
 * Each operation works on an actual named subject found in the current graph.
 * The caller, not the LLM, chooses the next operation and when to stop.
 */
export type WorldWorkshop = WorldBuilderWorkshopId;

export interface WorldWorkOrder {
  workshop: WorldWorkshop;
  subjectRef: string | null;
  subjectName: string;
  reason: string;
  deliverables: readonly string[];
  targetFamilies: readonly WorldAtlasContentFamily[];
  suggestedCardKinds: readonly WorldAtlasCardKind[];
  peopleQuestions: readonly string[];
  completionRule: string;
}

export type WorldFamilyCoverageStatus = "missing" | "thin" | "present";

export interface WorldFamilyCoverage {
  family: WorldAtlasContentFamily;
  label: string;
  status: WorldFamilyCoverageStatus;
  evidence: string[];
  reason: string;
  suggestedWorkshop: WorldWorkshop;
}

export interface WorldAtlasProductionAudit {
  families: WorldFamilyCoverage[];
  peopleConnectedWorldObjects: string[];
  orphanWorldObjects: string[];
  nextWorkshop: WorldWorkshop | null;
  nextReason: string | null;
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
  atlasAudit: WorldAtlasProductionAudit;
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
  const atlasTarget = worldBuilderAtlasTarget(workshop);
  return {
    workshop,
    subjectRef: ref,
    subjectName: ref ? named(doc, ref) : "世界/当前地区",
    reason,
    deliverables,
    targetFamilies: atlasTarget.families,
    suggestedCardKinds: atlasTarget.cardKinds,
    peopleQuestions: atlasTarget.peopleQuestions,
    completionRule: atlasTarget.completionRule,
  };
}

function relationMatches(relation: string, pattern: RegExp): boolean {
  return pattern.test(relation.trim());
}

function familyLabel(family: WorldAtlasContentFamily): string {
  return (
    WORLD_ATLAS_CONTENT_FAMILIES.find((entry) => entry.id === family)?.label ??
    family
  );
}

const FAMILY_WORKSHOP: Readonly<
  Record<WorldAtlasContentFamily, WorldWorkshop>
> = {
  space: "geography",
  people: "people",
  organization: "factions",
  power: "power",
  asset: "economy",
  economy: "economy",
  activity: "events",
  information: "social",
  value: "social",
  playable: "playability",
};

const FAMILY_PRIORITY: readonly WorldAtlasContentFamily[] = [
  "people",
  "organization",
  "activity",
  "asset",
  "space",
  "power",
  "information",
  "economy",
  "value",
  "playable",
];

export function auditWorldAtlasProduction(
  doc: WorldPackDocument,
): WorldAtlasProductionAudit {
  const live = currentLinks(doc);
  const people = doc.nodes.filter((node) => node.type === "character");
  const organizations = doc.nodes.filter(
    (node) => node.type === "organization",
  );
  const places = doc.nodes.filter((node) => node.type === "location");
  const assets = doc.nodes.filter((node) => node.type === "item");
  const powers = doc.nodes.filter(
    (node) => node.type === "rule" || node.type === "concept",
  );
  const actors = new Set(
    [...people, ...organizations].map((node) => node.localId),
  );
  const peopleIds = new Set(people.map((node) => node.localId));
  const connectedToPerson = (ref: string) =>
    live.some(
      (edge) =>
        (edge.fromRef === ref && peopleIds.has(edge.toRef)) ||
        (edge.toRef === ref && peopleIds.has(edge.fromRef)),
    ) ||
    doc.activities.some(
      (activity) =>
        activity.actorRefs.some((actor) => peopleIds.has(actor)) &&
        activity.resourceRefs.includes(ref),
    );
  const connectedToActor = (ref: string) =>
    live.some(
      (edge) =>
        (edge.fromRef === ref && actors.has(edge.toRef)) ||
        (edge.toRef === ref && actors.has(edge.fromRef)),
    ) ||
    doc.activities.some(
      (activity) =>
        activity.actorRefs.some((actor) => actors.has(actor)) &&
        activity.resourceRefs.includes(ref),
    );

  const nonPeople = doc.nodes.filter((node) => node.type !== "character");
  const peopleConnectedWorldObjects = nonPeople
    .filter((node) => connectedToPerson(node.localId))
    .map((node) => node.localId);
  const orphanWorldObjects = nonPeople
    .filter(
      (node) =>
        node.type !== "location" &&
        !connectedToPerson(node.localId) &&
        !connectedToActor(node.localId),
    )
    .map((node) => node.localId);

  const socialPeople = people.filter(
    (person) =>
      live.some(
        (edge) =>
          edge.fromRef === person.localId || edge.toRef === person.localId,
      ) ||
      doc.activities.some((activity) =>
        activity.actorRefs.includes(person.localId),
      ),
  );
  const socialOrganizations = organizations.filter((org) =>
    live.some(
      (edge) =>
        (edge.fromRef === org.localId &&
          (peopleIds.has(edge.toRef) ||
            places.some((p) => p.localId === edge.toRef))) ||
        (edge.toRef === org.localId &&
          (peopleIds.has(edge.fromRef) ||
            places.some((p) => p.localId === edge.fromRef))),
    ),
  );
  const activePlaces = places.filter(
    (place) =>
      connectedToActor(place.localId) ||
      (doc.interactions ?? []).some(
        (action) => action.locationRef === place.localId,
      ),
  );
  const controlledAssets = assets.filter((asset) =>
    live.some(
      (edge) =>
        ((edge.toRef === asset.localId && actors.has(edge.fromRef)) ||
          (edge.fromRef === asset.localId && actors.has(edge.toRef))) &&
        relationMatches(
          edge.relation,
          /own|control|hold|custod|possess|拥有|控制|持有|保管|所属|管理/i,
        ),
    ),
  );
  const connectedPowers = powers.filter(
    (power) =>
      connectedToActor(power.localId) ||
      live.some(
        (edge) =>
          (edge.fromRef === power.localId || edge.toRef === power.localId) &&
          relationMatches(
            edge.relation,
            /掌握|使用|传授|克制|反制|ability|use|teach|counter|permit|authorize/i,
          ),
      ),
  );
  const economyEdges = live.filter((edge) =>
    relationMatches(
      edge.relation,
      /生产|加工|运输|交易|消费|产于|来源|供给|销售|购买|produce|manufact|transport|trade|sell|buy|supply|consume/i,
    ),
  );
  const ongoingActivities = doc.activities.filter(
    (activity) =>
      activity.stage === "ongoing" &&
      activity.actorRefs.some((ref) => actors.has(ref)),
  );
  const informationEdges = live.filter((edge) =>
    relationMatches(
      edge.relation,
      /知道|传播|接收|隐瞒|秘密|情报|消息|know|inform|tell|secret|rumou?r|broadcast/i,
    ),
  );
  const informationNodes = powers.filter(
    (node) =>
      node.type === "concept" &&
      (informationEdges.some(
        (edge) => edge.fromRef === node.localId || edge.toRef === node.localId,
      ) ||
        connectedToPerson(node.localId)),
  );
  const valuedNodes = doc.nodes.filter((node) => node.value.trim().length > 0);
  const sociallyPriced = valuedNodes.filter(
    (node) =>
      connectedToActor(node.localId) ||
      live.some(
        (edge) =>
          (edge.fromRef === node.localId || edge.toRef === node.localId) &&
          relationMatches(
            edge.relation,
            /评价|争夺|竞争|购买|交易|重视|威胁|value|price|rival|compete|trade|buy/i,
          ),
      ),
  );
  const availableInteractions = (doc.interactions ?? []).filter(
    (action) => action.state === "available",
  );
  const usefulInteractions = availableInteractions.filter((action) =>
    action.yields.some((term) => term.kind !== "access"),
  );

  const coverage = (
    family: WorldAtlasContentFamily,
    status: WorldFamilyCoverageStatus,
    evidence: string[],
    reason: string,
  ): WorldFamilyCoverage => ({
    family,
    label: familyLabel(family),
    status,
    evidence,
    reason,
    suggestedWorkshop: FAMILY_WORKSHOP[family],
  });

  const families: WorldFamilyCoverage[] = [
    coverage(
      "people",
      people.length === 0
        ? "missing"
        : socialPeople.length === 0
          ? "thin"
          : "present",
      socialPeople.map((node) => node.localId),
      people.length === 0
        ? "没有具名人物。"
        : socialPeople.length === 0
          ? "有人物，但人物尚未进入关系或当前事务。"
          : "人物已经进入关系网或当前事务。",
    ),
    coverage(
      "space",
      places.length === 0
        ? "missing"
        : activePlaces.length === 0
          ? "thin"
          : "present",
      activePlaces.map((node) => node.localId),
      places.length === 0
        ? "没有可定位、可反复进入的地点。"
        : activePlaces.length === 0
          ? "有地点，但没有人与组织在其中活动，也没有可执行入口。"
          : "地点已经接入人物/组织活动或实际入口。",
    ),
    coverage(
      "organization",
      organizations.length === 0
        ? "missing"
        : socialOrganizations.length === 0
          ? "thin"
          : "present",
      socialOrganizations.map((node) => node.localId),
      organizations.length === 0
        ? "没有组织机器。"
        : socialOrganizations.length === 0
          ? "有组织名称，但没有具体人物/地点关系支撑其运转。"
          : "组织已经接上人物或实际区域。",
    ),
    coverage(
      "power",
      powers.length === 0
        ? "missing"
        : connectedPowers.length === 0
          ? "thin"
          : "present",
      connectedPowers.map((node) => node.localId),
      powers.length === 0
        ? "没有公共力量、规则或专业能力对象。"
        : connectedPowers.length === 0
          ? "力量存在，但没有掌握者、使用者、授权或反制关系。"
          : "力量已经连接实际行动者或关系。",
    ),
    coverage(
      "asset",
      assets.length === 0
        ? "missing"
        : controlledAssets.length === 0
          ? "thin"
          : "present",
      controlledAssets.map((node) => node.localId),
      assets.length === 0
        ? "没有可占有、交换或争夺的具体资产。"
        : controlledAssets.length === 0
          ? "有资产，但没有真实持有人/控制者。"
          : "资产已经进入权属或控制关系。",
    ),
    coverage(
      "economy",
      economyEdges.length === 0
        ? assets.length > 0
          ? "thin"
          : "missing"
        : "present",
      economyEdges.map(
        (edge) => edge.fromRef + "|" + edge.relation + "|" + edge.toRef,
      ),
      economyEdges.length === 0
        ? assets.length > 0
          ? "有资产，但生产、加工、运输、交易或消费网络尚未出现。"
          : "没有可观察的生产与流通网络。"
        : "已有生产或流通关系。",
    ),
    coverage(
      "activity",
      ongoingActivities.length === 0
        ? doc.activities.length > 0
          ? "thin"
          : "missing"
        : "present",
      ongoingActivities.map((activity) => activity.localId),
      ongoingActivities.length === 0
        ? doc.activities.length > 0
          ? "有活动记录，但没有真实行动者正在推进的当前事务。"
          : "世界中没有当前正在推进的事务。"
        : "已有行动者在推进当前事务。",
    ),
    coverage(
      "information",
      informationEdges.length === 0 && informationNodes.length === 0
        ? "missing"
        : informationEdges.length === 0
          ? "thin"
          : "present",
      [
        ...informationNodes.map((node) => node.localId),
        ...informationEdges.map(
          (edge) => edge.fromRef + "|" + edge.relation + "|" + edge.toRef,
        ),
      ],
      informationEdges.length === 0 && informationNodes.length === 0
        ? "没有谁知道、传播、隐瞒或误判什么的可查询关系。"
        : informationEdges.length === 0
          ? "存在信息对象，但尚未进入人物认知与传播网络。"
          : "信息已经进入知情或传播关系。",
    ),
    coverage(
      "value",
      valuedNodes.length === 0
        ? "missing"
        : sociallyPriced.length === 0
          ? "thin"
          : "present",
      sociallyPriced.map((node) => node.localId),
      valuedNodes.length === 0
        ? "没有对象被赋予实际世界价值。"
        : sociallyPriced.length === 0
          ? "写了价值说明，但尚未通过人物/组织关系形成社会价格。"
          : "价值对象已经接入实际人物或组织关系。",
    ),
    coverage(
      "playable",
      availableInteractions.length === 0
        ? live.some((edge) =>
            places.some(
              (place) =>
                edge.fromRef === place.localId || edge.toRef === place.localId,
            ),
          )
          ? "thin"
          : "missing"
        : usefulInteractions.length === 0
          ? "thin"
          : "present",
      availableInteractions.map((action) => action.localId),
      availableInteractions.length === 0
        ? "没有明确可执行的进入、取得、学习、经营或争夺入口。"
        : usefulInteractions.length === 0
          ? "已有入口动作，但还没有能留下资产、权限、关系、知识或能力的取得路径。"
          : "已有能产生现实权益的可执行路径。",
    ),
  ];

  const nextFamily = FAMILY_PRIORITY.map((family) =>
    families.find((entry) => entry.family === family),
  ).find((entry) => entry && entry.status !== "present");

  return {
    families,
    peopleConnectedWorldObjects,
    orphanWorldObjects,
    nextWorkshop: nextFamily?.suggestedWorkshop ?? null,
    nextReason: nextFamily ? nextFamily.label + "：" + nextFamily.reason : null,
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

  // v0.2 §9: a short sandbox action chain is an optional *diagnostic*, not
  // a condition for producing or accepting a rich textual world bible.
  // v0.2 §3.04: an ordinary historical/social world has real power systems,
  // just as a supernatural world does (office, law, capital, reputation).
  if (!next && request.intent !== "advance") {
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
        "当前世界缺少能实际改变人物、组织与资源的公共力量体系",
        [...powerDesignProducts(request)],
      );
  }

  // In advance mode the world already exists; if the only available action is
  // merely entering somewhere, the next production gap is still playability.
  if (
    !next &&
    request.intent === "advance" &&
    !(doc.interactions ?? []).some(
      (action) =>
        action.state === "available" &&
        action.yields.some((term) => term.kind !== "access"),
    )
  ) {
    next = order(
      "playability",
      controlledResources[0] ?? places[0]?.localId ?? null,
      doc,
      "已有 Reality 能进入，但还没有把现有资源、权限或关系转化成下一步现实收益的取得路径",
      [
        "由已有具体人物/组织提供的可执行动作",
        "动作完成后留下资产、权限、关系、知识或能力，并能继续连接下一层世界内容",
      ],
    );
  }

  const atlasAudit = auditWorldAtlasProduction(doc);

  return {
    entryLocations: places.map(idOf),
    operatingOrganizations,
    peopleWithSocialTies,
    controlledResources,
    independentActivities,
    actionableRoutes,
    feedbackPaths,
    interactionPaths,
    atlasAudit,
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
    atlasTarget: {
      families: order.targetFamilies,
      suggestedCardKinds: order.suggestedCardKinds,
      peopleQuestions: order.peopleQuestions,
      completionRule: order.completionRule,
    },
    currentAtlasAudit: auditWorldAtlasProduction(state),
    currentWorld: state,
    rule: "Produce candidate World Atlas objects and typed relations, not a prose-only world overview. Creating a node is not completion: connect it into the real world graph, and when appropriate connect non-person content to concrete people or organizations. Reuse existing local IDs to deepen; new IDs must be unique. Return only the new or revised world-content increment. Never author a chapter outline. The engine decides the next work order.",
  };
}
