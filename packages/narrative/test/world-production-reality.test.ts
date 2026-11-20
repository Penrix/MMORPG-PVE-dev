import { describe, expect, it } from "vitest";
import { createCanonEntity, createCanonFact } from "@narralume/domain";
import type { RelationshipEvent, CanonFact } from "@narralume/domain";
import {
  projectExistingWorldForProduction,
  previewProductionReality,
} from "../src/world-production-reality.js";
import {
  emptyWorldDocument,
  playtestWorld,
  applyWorldProductionDelta,
} from "../src/world-production-engine.js";
import type { WorldPackRequest } from "@narralume/contracts";

const projectId = "p",
  now = "2026-11-20T08:00:00Z";
const entity = (
  id: string,
  type: "location" | "organization" | "character" | "item",
  name: string,
) =>
  createCanonEntity({
    id,
    projectId,
    type,
    name,
    description: "能够连续生活和行动的已确认世界实体 " + name,
    now,
  });
const fact = (
  subjectId: string,
  predicate: string,
  value: unknown,
  id = subjectId + "-" + predicate,
) =>
  createCanonFact({
    id,
    projectId,
    subjectId,
    predicate,
    value,
    now,
    authority: "confirmed",
    sourceType: "world-pack",
  });
const request: WorldPackRequest = {
  requestId: "00000000-0000-4000-8000-000000000001",
  intent: "advance",
  scale: "W1",
  premise: "修仙界商会经营",
  genre: "玄幻",
  focus: "玉澜坊市",
  worldTime: "宗门大比当日",
  scarcity: "",
  instruction: "",
  parentAreaId: "market",
};
const relationships: RelationshipEvent[] = [
  {
    id: "loc-org",
    projectId,
    fromEntityId: "guild",
    toEntityId: "market",
    relation: "operates",
    intensity: null,
    state: { description: "商会在此开展丹药生意", lifecycle: "active" },
    outlineNodeId: null,
    storyTime: null,
    sourceId: null,
    supersedesEventId: null,
    createdAt: now,
  },
  {
    id: "chief-org",
    projectId,
    fromEntityId: "chief",
    toEntityId: "guild",
    relation: "leads",
    intensity: null,
    state: { description: "大掌柜有独立决策权", lifecycle: "active" },
    outlineNodeId: null,
    storyTime: null,
    sourceId: null,
    supersedesEventId: null,
    createdAt: now,
  },
  {
    id: "org-item",
    projectId,
    fromEntityId: "guild",
    toEntityId: "pill",
    relation: "owns",
    intensity: null,
    state: { description: "商会实际保管丹药", lifecycle: "active" },
    outlineNodeId: null,
    storyTime: null,
    sourceId: null,
    supersedesEventId: null,
    createdAt: now,
  },
];

describe("Adopted Canon is the real game world for W1 / advances", () => {
  const entities = [
    entity("market", "location", "玉澜坊市"),
    entity("guild", "organization", "玉澜商会"),
    entity("chief", "character", "沈绮罗"),
    entity("pill", "item", "月华补神丹"),
  ];
  const facts: CanonFact[] = [
    createCanonFact({
      id: "guild-area",
      projectId,
      subjectId: "guild",
      predicate: "world.area",
      objectEntityId: "market",
      authority: "confirmed",
      sourceType: "world-pack",
      now,
    }),
    fact("pill", "world.content", {
      value: "可修补神识的稀有丹药",
      access: "通过玉澜商会交易",
      motive: "高价争夺",
      currentActivity: "正被商会保管",
      approvedDescription: "唯一一炉月华补神丹",
    }),
    fact("chief", "world.ongoing_activity", {
      activityLocalId: "bidding",
      stage: "ongoing",
      description: "正在筹办丹药竞价",
      reason: "扩大商会的利润",
      worldTime: "宗门大比前",
      resourceIds: ["pill"],
    }),
    fact("guild", "world.affordance", {
      localId: "enter_market",
      name: "进入坊市商会交易",
      action: "向商会申请访客准入",
      locationId: "market",
      requires: [],
      yields: [{ kind: "access", ref: "market" }],
      state: "available",
    }),
  ];
  it("projects real retained people, possessions, actions, access and locations without inventing new ones", () => {
    const existing = projectExistingWorldForProduction({
      entities,
      facts,
      relationships,
    });
    expect(existing.nodes.map((n) => n.localId)).toEqual(
      expect.arrayContaining([
        "canon:market",
        "canon:guild",
        "canon:chief",
        "canon:pill",
      ]),
    );
    expect(existing.activities).toEqual([
      expect.objectContaining({
        actorRefs: ["canon:chief"],
        resourceRefs: ["canon:pill"],
        stage: "ongoing",
      }),
    ]);
    expect(existing.interactions).toEqual([
      expect.objectContaining({
        offeredByRef: "canon:guild",
        yields: [{ kind: "access", ref: "canon:market" }],
      }),
    ]);
    const missing = playtestWorld(existing, request).next;
    expect(missing?.workshop).toBe("playability");
  });
  it("inspects old Canon plus new deltas while staging only new IDs and rights", () => {
    const existing = projectExistingWorldForProduction({
      entities,
      facts,
      relationships,
    });
    const patch = {
      ...emptyWorldDocument(),
      nodes: [
        {
          localId: "retired_master",
          existingCanonId: null,
          type: "character" as const,
          name: "退隐炼丹师",
          description: "昔日为商会炼丹的前辈，正独立开山收徒",
          areaRef: "canon:market",
          value: "稀有丹术",
          access: "经商会介绍",
          motive: "寻找传人",
          currentActivity: "招收弟子",
          origin: "original" as const,
          sourceNote: "原创人物",
        },
      ],
      links: [
        {
          fromRef: "retired_master",
          toRef: "canon:chief",
          relation: "knows",
          description: "早年为商会炼丹，尚有私人情谊",
          status: "current" as const,
        },
      ],
    };
    const result = applyWorldProductionDelta(
      emptyWorldDocument(),
      patch,
      new Set(entities.map((e) => e.id)),
      "people",
      "canon:chief",
    );
    expect(result.document.nodes.map((n) => n.name)).toEqual(["退隐炼丹师"]);
    const inspected = previewProductionReality(existing, result.document);
    expect(
      inspected.nodes.find((n) => n.name === "沈绮罗")?.existingCanonId,
    ).toBe("chief");
    expect(
      inspected.nodes.find((n) => n.name === "退隐炼丹师")?.existingCanonId,
    ).toBeNull();
    expect(
      inspected.links.some(
        (l) => l.fromRef === "retired_master" && l.toRef === "canon:chief",
      ),
    ).toBe(true);
  });
});
