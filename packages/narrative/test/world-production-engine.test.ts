import { describe, expect, it } from "vitest";
import type {
  WorldAtlasCardKind,
  WorldPackDocument,
  WorldPackRequest,
} from "@narralume/contracts";
import {
  applyWorldProductionDelta,
  auditWorldAtlasProduction,
  emptyWorldDocument,
  playtestWorld,
  worldWorkOrderInput,
} from "../src/world-production-engine.js";

const req: WorldPackRequest = {
  requestId: "00000000-0000-4000-8000-000000000000",
  scale: "W1",
  premise: "玄幻宗门与坊市",
  worldTime: "大比前夜",
  focus: "紫霄坊市",
  genre: "玄幻",
  scarcity: "",
  instruction: "",
  parentAreaId: null,
};
const node = (
  id: string,
  type: "location" | "organization" | "character" | "item" | "rule" | "concept",
  name: string,
  areaRef: string | null = null,
  atlasKind?: WorldAtlasCardKind,
) => ({
  localId: id,
  existingCanonId: null,
  type,
  ...(atlasKind ? { atlasKind } : {}),
  name,
  description: name + "具有持续而具体的世界生活",
  areaRef,
  value: "可提供实际世界收益",
  access: "经商会引荐能够取得",
  motive: "有自己当前追求",
  currentActivity: "正在经营",
  origin: "original" as const,
  sourceNote: "原创",
});
const link = (fromRef: string, toRef: string, relation: string) => ({
  fromRef,
  toRef,
  relation,
  description: "双方通过真实事务长期往来并相互影响",
  status: "current" as const,
});

describe("MMORPG world production engine (not a one-shot story prompt)", () => {
  it("dispatches named world-production workshops based on actual graph deficiencies", () => {
    let doc: WorldPackDocument = emptyWorldDocument();
    expect(playtestWorld(doc, req).next?.workshop).toBe("geography");
    doc = { ...doc, nodes: [node("market", "location", "紫霄坊市")] };
    expect(playtestWorld(doc, req).next?.workshop).toBe("factions");
    doc = {
      ...doc,
      nodes: [
        ...doc.nodes,
        node("guild", "organization", "三江商会", "market"),
      ],
      links: [link("guild", "market", "operates")],
    };
    expect(playtestWorld(doc, req).next?.workshop).toBe("people");
    doc = {
      ...doc,
      nodes: [...doc.nodes, node("chief", "character", "叶掌柜", "market")],
      links: [...doc.links, link("chief", "guild", "leads")],
    };
    expect(playtestWorld(doc, req).next?.workshop).toBe("economy");
    doc = {
      ...doc,
      nodes: [...doc.nodes, node("ore", "item", "千年紫金矿", "market")],
      links: [...doc.links, link("guild", "ore", "owns")],
    };
    expect(playtestWorld(doc, req).next?.workshop).toBe("events");
    doc = {
      ...doc,
      activities: [
        {
          localId: "bidding",
          actorRefs: ["chief"],
          resourceRefs: ["ore"],
          stage: "ongoing",
          worldTime: "大比前夜",
          reason: "与宗门争取矿山管理权",
          description: "掌柜已经出面与工匠联合竞买矿权",
        },
      ],
    };
    // Every world needs concrete public powers; playable action chains are
    // optional diagnostics rather than mandatory game-runtime mechanics.
    expect(playtestWorld(doc, req).next?.workshop).toBe("power");
    doc = {
      ...doc,
      nodes: [...doc.nodes, node("cultivation", "rule", "灵脉炼器规则")],
      links: [...doc.links, link("chief", "cultivation", "can_use")],
    };
    expect(playtestWorld(doc, req).next).toBeNull();
    doc = {
      ...doc,
      interactions: [
        {
          localId: "enter",
          name: "进入市场",
          offeredByRef: "guild",
          locationRef: "market",
          action: "商会柜台允许初次来访者进入市场",
          requires: [],
          yields: [{ kind: "access", ref: "market" }],
          state: "available",
        },
        {
          localId: "purchase",
          name: "取得矿权",
          offeredByRef: "chief",
          locationRef: "market",
          action: "用已有准入权参与具体竞价并完成交割",
          requires: [{ kind: "access", ref: "market" }],
          yields: [{ kind: "asset", ref: "ore" }],
          state: "available",
        },
      ],
    };
    const state = playtestWorld(doc, req);
    expect(state.next).toBeNull();
    expect(state.interactionPaths).toContainEqual(["enter", "purchase"]);
    expect(state.independentActivities).toEqual(["bidding"]);
    expect(state.controlledResources).toEqual(["ore"]);
    expect(state.feedbackPaths).toEqual(["bidding"]);
  });

  it("resolves an open work order around a real organization, rather than providing a checklist", () => {
    const doc = {
      ...emptyWorldDocument(),
      nodes: [
        node("market", "location", "紫霄坊市"),
        node("guild", "organization", "三江商会", "market"),
      ],
      links: [link("guild", "market", "runs")],
    };
    const need = playtestWorld(doc, req).next!;
    expect(need).toMatchObject({
      workshop: "people",
      subjectRef: "guild",
      subjectName: "三江商会",
    });
    const instruction = worldWorkOrderInput(need, doc);
    expect(instruction).toMatchObject({
      operation: "people",
      actualSubject: { ref: "guild", name: "三江商会" },
    });
    expect(JSON.stringify(instruction)).toContain("当前");
  });

  it("merges new graph actors and edges by identity, rejects invented missing actors and changed identities", () => {
    const root = {
      ...emptyWorldDocument(),
      nodes: [node("market", "location", "紫霄坊市")],
    };
    const delta = {
      ...emptyWorldDocument(),
      summary: "新增加真实商会",
      nodes: [node("guild", "organization", "三江商会", "market")],
      links: [link("guild", "market", "operates")],
    };
    const result = applyWorldProductionDelta(
      root,
      delta,
      new Set(),
      "factions",
      "market",
    );
    expect(result.document.nodes).toHaveLength(2);
    expect(result.step.changedRefs).toEqual(
      expect.arrayContaining(["guild", "guild|operates|market"]),
    );
    expect(() =>
      applyWorldProductionDelta(
        result.document,
        {
          ...emptyWorldDocument(),
          nodes: [node("guild", "organization", "另一家商会", "market")],
        },
        new Set(),
        "factions",
        "guild",
      ),
    ).toThrow("identity_changed");
    expect(() =>
      applyWorldProductionDelta(
        root,
        {
          ...emptyWorldDocument(),
          nodes: [node("guild", "organization", "三江商会")],
          links: [link("guild", "unknown", "controls")],
        },
        new Set(),
        "factions",
        "market",
      ),
    ).toThrow("bad_graph");
  });

  it("does not misreport an inert static world as playable just because it has many named entities", () => {
    const many = {
      ...emptyWorldDocument(),
      nodes: [
        node("city", "location", "都城"),
        node("sect", "organization", "剑宗", "city"),
        ...Array.from({ length: 12 }, (_, i) =>
          node("npc" + i, "character", "弟子" + i, "city"),
        ),
      ],
    };
    const check = playtestWorld(many, req);
    expect(check.next?.workshop).toBe("people");
    expect(check.independentActivities).toEqual([]);
    expect(check.controlledResources).toEqual([]);
  });
  it("audits Atlas families by relationships instead of counting named nodes", () => {
    const doc: WorldPackDocument = {
      ...emptyWorldDocument(),
      nodes: [
        node("market", "location", "紫霄坊市"),
        node("guild", "organization", "三江商会", "market"),
        node("chief", "character", "叶掌柜", "market"),
        node("ore", "item", "千年紫金矿", "market"),
      ],
      links: [
        link("guild", "market", "operates"),
        link("chief", "guild", "leads"),
      ],
    };
    const first = auditWorldAtlasProduction(doc);
    expect(
      first.families.find((entry) => entry.family === "people")?.status,
    ).toBe("present");
    expect(
      first.families.find((entry) => entry.family === "asset")?.status,
    ).toBe("thin");
    expect(first.orphanWorldObjects).toContain("ore");

    const connected: WorldPackDocument = {
      ...doc,
      links: [...doc.links, link("chief", "ore", "owns")],
    };
    const second = auditWorldAtlasProduction(connected);
    expect(
      second.families.find((entry) => entry.family === "asset")?.status,
    ).toBe("present");
    expect(second.peopleConnectedWorldObjects).toContain("ore");
    expect(second.orphanWorldObjects).not.toContain("ore");
  });

  it("puts Atlas targets and people questions into every real work order", () => {
    const doc = {
      ...emptyWorldDocument(),
      nodes: [node("market", "location", "紫霄坊市")],
    };
    const need = playtestWorld(doc, req).next!;
    const instruction = worldWorkOrderInput(need, doc);
    expect(need.targetFamilies.length).toBeGreaterThan(0);
    expect(need.peopleQuestions.length).toBeGreaterThan(0);
    expect(instruction).toMatchObject({
      atlasTarget: {
        families: need.targetFamilies,
        suggestedCardKinds: need.suggestedCardKinds,
      },
    });
    expect(instruction).toMatchObject({
      atlasTarget: {
        peopleQuestions: need.peopleQuestions,
        completionRule: need.completionRule,
      },
    });
  });
  it("keeps information cards distinct from assets and power after coarse staging", () => {
    const doc: WorldPackDocument = {
      ...emptyWorldDocument(),
      nodes: [
        node("market", "location", "紫霄坊市"),
        node("chief", "character", "叶掌柜", "market"),
        node("secret", "concept", "矿脉密报", "market", "information"),
        node("ore", "item", "千年紫金矿", "market", "resource"),
        node("skill", "rule", "炼器术", "market", "ability"),
      ],
      links: [
        link("chief", "secret", "知道"),
        link("chief", "ore", "拥有"),
        link("chief", "skill", "掌握"),
      ],
    };
    const audit = auditWorldAtlasProduction(doc);
    expect(
      audit.families.find((entry) => entry.family === "information")?.status,
    ).toBe("present");
    expect(
      audit.families.find((entry) => entry.family === "asset")?.status,
    ).toBe("present");
    expect(
      audit.families.find((entry) => entry.family === "power")?.status,
    ).toBe("present");
    expect(audit.peopleConnectedWorldObjects).toEqual(
      expect.arrayContaining(["secret", "ore", "skill"]),
    );
  });
});
