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
import {
  worldProductionWorkOrderForWishFulfillment,
} from "../src/world-production-runner.js";

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
    // Public power is required only while absent. This is a create-mode
    // textual world, so an explicit WorldAction chain is not a hard gate.
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
    expect(JSON.stringify(instruction)).toContain("意淫承重");
    expect(JSON.stringify(instruction)).toContain("承重不是平衡税");
    expect(JSON.stringify(instruction)).toContain("Selection decides what deserves production");
  });

  it("keeps coverage audit separate from creative selection and exposes anti-balance-tax bearing", () => {
    const doc = {
      ...emptyWorldDocument(),
      nodes: [node("market", "location", "紫霄坊市")],
    };
    const need = playtestWorld(doc, req).next!;
    const instruction = worldWorkOrderInput(need, doc) as {
      selectionPolicy?: {
        firstQuestion?: string;
        bearingRule?: string;
        selectionVsAudit?: string;
        antiBalanceTax?: string[];
      };
    };
    expect(instruction.selectionPolicy?.firstQuestion).toContain("意淫");
    expect(instruction.selectionPolicy?.bearingRule).toContain("不是平衡税");
    expect(instruction.selectionPolicy?.selectionVsAudit).toContain(
      "Selection decides what deserves production",
    );
    expect(instruction.selectionPolicy?.antiBalanceTax?.join("\n")).toContain(
      "不得因为能力太强",
    );
  });


  it("runs explicit wish-fulfillment selection before generic coverage repair and keeps multi-thread expansion", () => {
    const doc = {
      ...emptyWorldDocument(),
      nodes: [
        node("tsunade", "character", "纲手"),
        node("flying-raijin", "rule", "飞雷神", null, "ability"),
      ],
    };
    const wish = {
      version: "wish-fulfillment-frame.v1" as const,
      authority: "creative-direction" as const,
      mode: "project_current" as const,
      protagonistEntityId: "hero",
      readerFantasy: "让木叶真正的高价人和高价力量逐渐围绕男主重新定价",
      protagonistDesire: "获得足以进入木叶核心圈的力量与认可",
      threads: [
        {
          id: "thread:tsunade-recognition",
          targetRefs: ["tsunade"],
          targetNames: ["纲手"],
          dimension: "relationship",
          readerFantasy: "纲手从注意到认可，再给出只有男主有的私人位置",
          protagonistDesire: "让纲手认可自己的能力",
          desiredChange: "纲手认可男主、主动合作并逐步开放私人信任",
          privatePrivilege: "别人没有的私人准入",
          publicRepricing: "纲手公开背书使木叶高层重新定价男主",
          upgradeLeverage: ["医疗体系", "三忍圈层", "火影政治"],
          phase: "selected" as const,
        },
        {
          id: "thread:tsunade-destiny",
          targetRefs: ["tsunade"],
          targetNames: ["纲手"],
          dimension: "relationship",
          readerFantasy: "男主的存在真正改变纲手原本的人生",
          protagonistDesire: "保护并改变自己重视的人",
          desiredChange: "纲手的人生因男主介入产生高价值分叉",
          privatePrivilege: null,
          publicRepricing: null,
          upgradeLeverage: ["原著命运改写"],
          phase: "candidate" as const,
        },
      ],
      bearingRequirements: [
        {
          id: "bearing:tsunade-choice",
          threadIds: ["thread:tsunade-recognition"],
          kind: "relationship" as const,
          requirement: "纲手必须拥有真实选择权、社会价格和与男主逐步积累的共同历史",
          evidenceRefs: [],
          status: "missing" as const,
          raisesPriceBecause: "她不是谁都认可，偏偏选择男主才贵",
        },
      ],
      settlementTargets: [
        {
          threadId: "thread:tsunade-recognition",
          assetKind: "relationship",
          targetGain: "纲手的公开认可与私人信任",
        },
      ],
    };
    const generic = playtestWorld(doc, req).next;
    expect(generic?.workshop).not.toBe("social");
    const selected = worldProductionWorkOrderForWishFulfillment(wish, doc, {
      ...req,
      wishFulfillment: wish,
    });
    expect(selected).toMatchObject({
      workshop: "social",
      subjectRef: "tsunade",
      wishFulfillmentThreadIds: ["thread:tsunade-recognition"],
      bearingRequirementIds: ["bearing:tsunade-choice"],
    });
    expect(selected?.reason).toContain("纲手认可男主");
    expect(wish.threads).toHaveLength(2);
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
