import { SqliteStoryRepository } from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
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
async function setup() {
  const database = new NodeNarrativeDatabase();
  const app = await buildApp({
    config,
    database,
    environment: {},
    logger: false,
  });
  resources.push({ app, database });
  return { app, database };
}

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

  it("rolls six cards, then locks identity and rerolls the remaining slots", async () => {
    const { app } = await setup();
    const first = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: { channel: "male", seed: "first", useM03: false },
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

  it("atomically creates a project with intent, premise and book outline", async () => {
    const { app, database } = await setup();
    const roll = await app.inject({
      method: "POST",
      url: "/api/inspirations/roll",
      payload: { channel: "hybrid", count: 1, seed: "project" },
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
