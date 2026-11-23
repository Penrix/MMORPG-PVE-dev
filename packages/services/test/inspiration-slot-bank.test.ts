import { createProject } from "@narralume/domain";
import {
  SqliteProjectRepository,
  SqliteRetrievalRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUILTIN_INSPIRATION_SLOT_BANK,
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

  it("builds twelve complete, nonhollow, deterministic seeds without repeated unlocked cards", () => {
    const input = {
      channel: "male" as const,
      count: 12,
      seed: "repeatable",
      useM03: false,
    };
    const first = rollInspirationSeeds(database, input);
    expect(rollInspirationSeeds(database, input)).toEqual(first);
    for (const card of first.cards) {
      expect(card.sentence).toMatch(
        /我是.+偶然发现自己.+借此闯入.+没想到|却|但|结果|不料|反而/u,
      );
      expect(card.starterBlueprint.protagonistIdentity).toBeTruthy();
      expect(card.starterBlueprint.targetCircle).toBeTruthy();
    }
    for (const key of [
      "identity",
      "anomalyRule",
      "highValueCircle",
      "twistPressure",
    ] as const) {
      expect(new Set(first.cards.map((card) => card.slots[key].id)).size).toBe(
        12,
      );
    }
  });

  it("does not leak male or female cards into other channels", () => {
    for (const channel of ["male", "female", "hybrid"] as const) {
      const response = rollInspirationSeeds(database, {
        channel,
        count: 8,
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

  it("preserves locked items byte-for-byte and rotates the remaining three slots", () => {
    const baseline = rollInspirationSeeds(database, {
      channel: "female",
      count: 1,
      seed: "a",
    }).cards[0]!;
    const locked = baseline.slots.highValueCircle;
    const rolled = rollInspirationSeeds(database, {
      channel: "female",
      count: 10,
      seed: "b",
      lockedSlots: { highValueCircle: locked },
    });
    expect(
      rolled.cards.every((card) => card.slots.highValueCircle.id === locked.id),
    ).toBe(true);
    expect(
      new Set(rolled.cards.map((card) => card.slots.identity.id)).size,
    ).toBe(10);
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
      seed: "m03",
      keyword: "鉴定",
    });
    expect(result.poolStats.m03Count).toBe(1);
    expect(
      result.cards.some(
        (card) =>
          card.slots.anomalyRule.sourceLibrary === "M03" &&
          card.slots.anomalyRule.materialId === "GF-0099",
      ),
    ).toBe(true);
  });

  it("rejects mismatched locked slots and hollow phrases", () => {
    const item = BUILTIN_INSPIRATION_SLOT_BANK.find(
      (card) => card.slot === "identity" && card.channels.includes("male"),
    )!;
    expect(() =>
      rollInspirationSeeds(database, {
        channel: "male",
        count: 1,
        lockedSlots: { anomalyRule: item },
      }),
    ).toThrow();
    expect(() =>
      rollInspirationSeeds(database, {
        channel: "male",
        count: 1,
        lockedSlots: { identity: { ...item, phrase: "" } },
      }),
    ).toThrow();
  });
});
