import { createProject } from "@narralume/domain";
import {
  SqliteProjectRepository,
  SqliteRetrievalRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUILTIN_INSPIRATION_SLOT_BANK,
  dealMaterialBundlesForLlm,
  loadM03SlotItems,
  rollInspirationSeeds,
} from "../src/inspiration-slot-bank.js";

let database: NodeNarrativeDatabase;
const now = "2026-11-23T00:00:00.000Z";

beforeEach(() => {
  database = new NodeNarrativeDatabase();
  database.migrate();
  new SqliteProjectRepository(database).insert(
    createProject({ id: "material-project", title: "素材索引", now }),
  );
});
afterEach(() => database.close());

function signature(card: {
  slots: Record<
    "identity" | "anomalyRule" | "highValueCircle" | "twistPressure",
    { id: string }
  >;
}) {
  return [
    card.slots.identity.id,
    card.slots.anomalyRule.id,
    card.slots.highValueCircle.id,
    card.slots.twistPressure.id,
  ].join("|");
}

function addM03(id: string, materialType: string, summary: string) {
  new SqliteRetrievalRepository(database).upsertSegment({
    id: "creative-material:M03:" + id,
    projectId: "material-project",
    sourceType: "creative_material",
    sourceId: "M03:" + id,
    title: "M03 " + id + "｜" + summary,
    content: summary,
    authority: "reference",
    metadata: {
      libraryId: "M03",
      materialId: id,
      materialType,
      status: "active",
      summary,
      tags: ["发牌测试"],
    },
    entityIds: [],
    createdAt: now,
    updatedAt: now,
  });
}

describe("inspiration slot machine", () => {
  it("keeps all channels separately stocked with at least twenty cards per slot", () => {
    for (const slot of [
      "identity",
      "anomalyRule",
      "highValueCircle",
      "twistPressure",
    ]) {
      expect(
        BUILTIN_INSPIRATION_SLOT_BANK.filter((item) => item.slot === slot)
          .length,
      ).toBeGreaterThanOrEqual(20);
      for (const channel of ["male", "female", "hybrid"]) {
        expect(
          BUILTIN_INSPIRATION_SLOT_BANK.filter(
            (item) =>
              item.slot === slot &&
              item.channels.includes(channel as "male" | "female" | "hybrid"),
          ).length,
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("deals twelve complete, deterministic chains without mixing stories", () => {
    const input = {
      channel: "male" as const,
      count: 12,
      mode: "local" as const,
      seed: "repeatable",
      useM03: false,
    };
    const first = rollInspirationSeeds(database, input);
    expect(rollInspirationSeeds(database, input)).toEqual(first);
    expect(first.cards).toHaveLength(12);
    for (const card of first.cards) {
      expect(card.chainId).toBeTruthy();
      expect(card.sentence.startsWith("我是")).toBe(true);
      expect(card.sentence.length).toBeLessThanOrEqual(60);
      expect(card.sentence).toMatch(/没想到|却|但|不料|结果|反而/u);
      expect(card.starterBlueprint.firstTake).toBeTruthy();
      expect(card.starterBlueprint.inbound).toBeTruthy();
      for (const key of [
        "identity",
        "anomalyRule",
        "highValueCircle",
        "twistPressure",
      ] as const) {
        expect(card.slots[key].id).toContain(card.chainId!);
      }
    }
    expect(new Set(first.cards.map((card) => card.chainId)).size).toBe(12);
  });

  for (const count of [24, 30]) {
    it(`caps a ${count}-card local request at the number of real chains`, () => {
      const result = rollInspirationSeeds(database, {
        channel: "male",
        count,
        mode: "local",
        useM03: false,
        seed: "large-batch-" + count,
      });
      expect(result.cards.length).toBe(12);
      expect(result.mode).toBe("local");
      expect(new Set(result.cards.map(signature)).size).toBe(12);
    });
  }

  it("treats locked slots as a chain filter instead of recombining stories", () => {
    const baseline = rollInspirationSeeds(database, {
      channel: "male",
      count: 1,
      mode: "local",
      useM03: false,
      seed: "lock-source",
    }).cards[0]!;
    const result = rollInspirationSeeds(database, {
      channel: "male",
      count: 30,
      mode: "local",
      useM03: false,
      seed: "three-locks",
      lockedSlots: {
        identity: baseline.slots.identity,
        anomalyRule: baseline.slots.anomalyRule,
        highValueCircle: baseline.slots.highValueCircle,
      },
    });
    expect(result.cards).toHaveLength(1);
    const [card] = result.cards;
    expect(card!.chainId).toBe(baseline.chainId);
    expect(card!.slots.identity.id).toBe(baseline.slots.identity.id);
    expect(card!.slots.anomalyRule.id).toBe(baseline.slots.anomalyRule.id);
    expect(card!.slots.highValueCircle.id).toBe(
      baseline.slots.highValueCircle.id,
    );
  });

  it("does not leak male or female cards into other channels", () => {
    for (const channel of ["male", "female", "hybrid"] as const) {
      const response = rollInspirationSeeds(database, {
        channel,
        count: 8,
        mode: "local",
        useM03: false,
        seed: "channels",
      });
      expect(
        response.cards.every((card) =>
          Object.values(card.slots).every((slot) =>
            slot.channels.includes(channel),
          ),
        ),
      ).toBe(true);
    }
  });

  it("keeps a locked phrase and deals only the chain that contains it", () => {
    const baseline = rollInspirationSeeds(database, {
      channel: "female",
      count: 1,
      mode: "local",
      seed: "a",
      useM03: true,
    }).cards[0]!;
    const locked = baseline.slots.highValueCircle;
    const rolled = rollInspirationSeeds(database, {
      channel: "female",
      count: 10,
      mode: "local",
      seed: "b",
      useM03: true,
      lockedSlots: { highValueCircle: locked },
    });
    expect(rolled.cards).toHaveLength(1);
    expect(JSON.stringify(rolled.cards[0]!.slots.highValueCircle)).toBe(
      JSON.stringify(locked),
    );
    expect(rolled.cards[0]!.chainId).toBe(baseline.chainId);
  });

  it("mixes imported active M03 cards, tracks material IDs and rejects retired cards", () => {
    const retrieval = new SqliteRetrievalRepository(database);
    for (const [id, status] of [
      ["GF-0099", "active"],
      ["GF-0100", "retired"],
    ] as const) {
      retrieval.upsertSegment({
        id: "creative-material:M03:" + id,
        projectId: "material-project",
        sourceType: "creative_material",
        sourceId: "M03:" + id,
        title: "M03 " + id + "｜触摸旧物",
        content: "可以看到未来的价值",
        authority: "reference",
        metadata: {
          libraryId: "M03",
          materialId: id,
          materialType: "GF",
          status,
          summary: "触摸旧物就能看见未来的价值",
          tags: ["鉴定"],
        },
        entityIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    expect(loadM03SlotItems(database).map((item) => item.materialId)).toEqual([
      "GF-0099",
    ]);
    const result = rollInspirationSeeds(database, {
      channel: "male",
      count: 12,
      mode: "local",
      seed: "m03",
      keyword: "鉴定",
      useM03: true,
    });
    expect(result.poolStats.m03Count).toBe(1);
    // Local mode deals whole chains from built-in packs. Project material is
    // counted for the pool but is not spliced into another world's chain.
    expect(
      result.cards.every((card) =>
        Object.values(card.slots).every(
          (slot) => slot.sourceLibrary === "slot-bank",
        ),
      ),
    ).toBe(true);
  });

  it("deals LLM molds from the preferred active M03 types before slot-bank fallbacks", () => {
    addM03("ROLE-9001", "ROLE", "木叶医院最不起眼的护理忍者");
    addM03("GF-9001", "GF", "治疗伤员就能复制其查克拉特性");
    addM03("GATE-9001", "GATE", "上忍与忍族争夺的医疗资源圈");
    addM03("REV-9001", "REV", "根部却开始追查异常治疗记录");

    const bundles = dealMaterialBundlesForLlm(database, {
      channel: "male",
      count: 24,
      mode: "llm",
      topic: "火影忍者",
      useM03: true,
      seed: "m03-deal",
    });

    expect(bundles).toHaveLength(24);
    expect(bundles[0]!.identityHint).toMatchObject({
      sourceLibrary: "M03",
      materialId: "ROLE-9001",
    });
    expect(bundles[0]!.anomalyHint).toMatchObject({
      sourceLibrary: "M03",
      materialId: "GF-9001",
    });
    expect(bundles[0]!.circleHint).toMatchObject({
      sourceLibrary: "M03",
      materialId: "GATE-9001",
    });
    expect(bundles[0]!.twistHint).toMatchObject({
      sourceLibrary: "M03",
      materialId: "REV-9001",
    });
    const bundleSignatures = bundles.map((bundle) =>
      [
        bundle.identityHint!.id,
        bundle.anomalyHint.id,
        bundle.circleHint!.id,
        bundle.twistHint.id,
      ].join("|"),
    );
    expect(new Set(bundleSignatures).size).toBe(24);
  });

  it("rejects mismatched locked slots and hollow phrases", () => {
    const item = BUILTIN_INSPIRATION_SLOT_BANK.find(
      (card) => card.slot === "identity" && card.channels.includes("male"),
    )!;
    expect(() =>
      rollInspirationSeeds(database, {
        channel: "male",
        count: 1,
        mode: "local",
        useM03: true,
        lockedSlots: { anomalyRule: item },
      }),
    ).toThrow();
    expect(() =>
      rollInspirationSeeds(database, {
        channel: "male",
        count: 1,
        mode: "local",
        useM03: true,
        lockedSlots: { identity: { ...item, phrase: "" } },
      }),
    ).toThrow();
  });
});
