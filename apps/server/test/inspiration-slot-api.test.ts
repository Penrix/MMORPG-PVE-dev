import type {
  InspirationRollRequest,
  InspirationSlotItem,
  InspirationSlotKey,
} from "@narralume/contracts";
import { SqliteStoryRepository } from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import type { InspirationLlmGenerator } from "@narralume/services";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { ServerConfig } from "../src/config.js";

const config: ServerConfig = {
  dataDirectory: ".",
  databasePath: ":memory:",
  host: "127.0.0.1",
  port: 4317,
  environment: "test",
};
const resources: {
  app: Awaited<ReturnType<typeof buildApp>>;
  database: NodeNarrativeDatabase;
}[] = [];
afterEach(async () => {
  while (resources.length) {
    const resource = resources.pop()!;
    await resource.app.close();
    resource.database.close();
  }
});

async function setup(generateWithLlm?: InspirationLlmGenerator) {
  const database = new NodeNarrativeDatabase();
  const app = await buildApp({
    config,
    database,
    environment: {},
    logger: false,
    ...(generateWithLlm ? { inspirationGenerateWithLlm: generateWithLlm } : {}),
  });
  resources.push({ app, database });
  return { app, database };
}

const slotKeys: InspirationSlotKey[] = [
  "identity",
  "anomalyRule",
  "highValueCircle",
  "twistPressure",
];

function mockSlot(
  request: InspirationRollRequest,
  slot: InspirationSlotKey,
  index: number,
  phrase: string,
): InspirationSlotItem {
  return {
    id: `mock:${index}:${slot}`,
    slot,
    channels: [request.channel],
    label: phrase,
    phrase,
    sourceLibrary: "slot-bank",
    materialType: null,
    tags: [],
  };
}

const mockLlmGenerator: InspirationLlmGenerator = async (
  _database,
  request,
) => {
  const cards = Array.from({ length: request.count }, (_, offset) => {
    const index = offset + 1;
    const identity =
      request.lockedSlots?.identity ??
      mockSlot(request, "identity", index, `木叶第${index}号低位忍者`);
    const anomalyRule =
      request.lockedSlots?.anomalyRule ??
      mockSlot(
        request,
        "anomalyRule",
        index,
        `能从第${index}种忍具残痕里读取战斗经验`,
      );
    const highValueCircle =
      request.lockedSlots?.highValueCircle ??
      mockSlot(
        request,
        "highValueCircle",
        index,
        `火影直属与上忍组成的第${index}层任务圈`,
      );
    const twistPressure =
      request.lockedSlots?.twistPressure ??
      mockSlot(
        request,
        "twistPressure",
        index,
        `却被第${index}支暗部小队追查来源`,
      );
    const slots = {
      identity,
      anomalyRule,
      highValueCircle,
      twistPressure,
    };
    return {
      id: `mock-fire-${index}`,
      channel: request.channel,
      sentence: `我是${identity.phrase}，发现${anomalyRule.phrase}，借此进入${highValueCircle.phrase}，${twistPressure.phrase}。`,
      slots,
      starterBlueprint: {
        suggestedTitle: `木叶发牌${index}`,
        genreLabel: request.topic ?? "火影忍者",
        readerNeed: "得意与阶层跃升",
        targetEmotion: "得意、惊艳、赢麻了",
        protagonistIdentity: identity.phrase,
        advantageHook: anomalyRule.phrase,
        targetCircle: highValueCircle.phrase,
        openingTension: twistPressure.phrase,
      },
    };
  });
  return {
    channel: request.channel,
    mode: "llm",
    topic: request.topic ?? null,
    cards,
    poolStats: {
      slotBankCount: 100,
      m03Count: 0,
      bySlot: Object.fromEntries(
        slotKeys.map((slot) => [
          slot,
          { slotBankCount: 25, m03Count: 0, total: 25 },
        ]),
      ) as Record<
        InspirationSlotKey,
        { slotBankCount: number; m03Count: number; total: number }
      >,
    },
  };
};

describe("inspiration API", () => {
  it("exposes catalog counts and M03 type mappings", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "GET",
      url: "/api/inspirations/catalog",
    });
    expect(response.statusCode, response.body).toBe(200);
    const catalog = response.json();
    expect(catalog.channels).toEqual(["male", "female", "hybrid"]);
    expect(catalog.slots).toEqual([
      "identity",
      "anomalyRule",
      "highValueCircle",
      "twistPressure",
    ]);
    expect(catalog.poolStats.slotBankCount).toBeGreaterThanOrEqual(80);
    expect(catalog.m03TypeMapping.GF).toBe("anomalyRule");
  });

  it("rolls six local cards, then locks identity and rerolls the remaining slots", async () => {
    const { app } = await setup();
    const first = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: {
        channel: "male",
        count: 6,
        mode: "local",
        seed: "first",
        useM03: false,
      },
    });
    expect(first.statusCode, first.body).toBe(200);
    const original = first.json();
    expect(original.cards).toHaveLength(6);
    const locked = original.cards[0].slots.identity;
    const reroll = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: {
        channel: "male",
        count: 8,
        mode: "local",
        useM03: false,
        seed: "second",
        lockedSlots: { identity: locked },
      },
    });
    expect(reroll.statusCode, reroll.body).toBe(200);
    const cards = reroll.json().cards;
    expect(cards).toHaveLength(8);
    expect(
      cards.every(
        (card: { slots: { identity: unknown } }) =>
          JSON.stringify(card.slots.identity) === JSON.stringify(locked),
      ),
    ).toBe(true);
    expect(
      new Set(
        cards.map(
          (card: { slots: { anomalyRule: { id: string } } }) =>
            card.slots.anomalyRule.id,
        ),
      ).size,
    ).toBe(8);
  });

  it("routes one 24-card 火影 LLM batch through the injected generator and preserves locked slots", async () => {
    const { app } = await setup(mockLlmGenerator);
    const local = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: {
        channel: "male",
        count: 1,
        mode: "local",
        useM03: false,
        seed: "locked",
      },
    });
    const locked = local.json().cards[0].slots.identity;

    const response = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: {
        channel: "male",
        mode: "llm",
        topic: "火影忍者",
        count: 24,
        useM03: true,
        lockedSlots: { identity: locked },
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json();
    expect(body.mode).toBe("llm");
    expect(body.topic).toBe("火影忍者");
    expect(body.cards).toHaveLength(24);
    expect(
      body.cards.every((card: { sentence: string }) =>
        /木叶|火影|忍者/u.test(card.sentence),
      ),
    ).toBe(true);
    expect(
      body.cards.every(
        (card: { slots: { identity: unknown } }) =>
          JSON.stringify(card.slots.identity) === JSON.stringify(locked),
      ),
    ).toBe(true);
  });

  it("returns a clear 422 when LLM mode has no configured writing model", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: {
        channel: "male",
        mode: "llm",
        topic: "火影忍者",
        count: 24,
        useM03: false,
      },
    });
    expect(response.statusCode, response.body).toBe(422);
    expect(response.json().error).toMatchObject({
      code: "inspiration.model_unavailable",
    });
    expect(response.json().error.message).toContain("免费词库速摇");
  });

  it("atomically creates a project with intent, premise and book outline", async () => {
    const { app, database } = await setup();
    const roll = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: {
        channel: "hybrid",
        count: 1,
        mode: "local",
        seed: "project",
      },
    });
    expect(roll.statusCode).toBe(200);
    const card = roll.json().cards[0];
    const created = await app.inject({
      method: "POST",
      url: "/api/inspirations/create-project",
      payload: { card, title: "灵感开书测试", language: "zh-CN" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const { project, outlineNodeId } = created.json();
    expect(project.title).toBe("灵感开书测试");
    expect(project.premise).toBe(card.sentence);
    const story = new SqliteStoryRepository(database);
    const intent = story.getAuthorIntent(project.id);
    expect(intent?.promise).toBe(card.sentence);
    expect(JSON.parse(intent!.currentFocus!)).toEqual(card.starterBlueprint);
    const book = story.getOutlineNode(project.id, outlineNodeId);
    expect(book).toMatchObject({
      kind: "book",
      summary: card.sentence,
      goal: card.starterBlueprint.targetCircle,
      conflict: card.starterBlueprint.openingTension,
    });
    expect(book?.metadata.starterBlueprint).toEqual(card.starterBlueprint);
    const bible = await app.inject({
      method: "GET",
      url: "/api/projects/" + project.id + "/story-bible",
    });
    expect(bible.statusCode).toBe(200);
    expect(bible.json().outline[0].id).toBe(outlineNodeId);
  });
});
