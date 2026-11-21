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

const opened: Array<{
  app: Awaited<ReturnType<typeof buildApp>>;
  db: NodeNarrativeDatabase;
}> = [];

afterEach(async () => {
  while (opened.length) {
    const current = opened.pop()!;
    await current.app.close();
    current.db.close();
  }
});

describe("World Atlas content framework API", () => {
  it("stores expanded card kinds and derives framework relation inverses without new SQL tables", async () => {
    const db = new NodeNarrativeDatabase();
    const app = await buildApp({
      config,
      database: db,
      enableRunWorker: false,
      logger: false,
    });
    opened.push({ app, db });

    const framework = await app.inject({
      method: "GET",
      url: "/api/source-worlds/framework",
    });
    expect(framework.statusCode).toBe(200);
    expect(framework.json().version).toBe("0.1");
    expect(
      framework.json().contentFamilies.map((entry: { id: string }) => entry.id),
    ).toEqual(
      expect.arrayContaining(["space", "power", "economy", "playable"]),
    );
    expect(
      framework.json().cardTypes.map((entry: { kind: string }) => entry.kind),
    ).toEqual(expect.arrayContaining(["character", "resource", "information"]));

    const world = await app.inject({
      method: "POST",
      url: "/api/source-worlds",
      payload: {
        id: "naruto-framework",
        name: "火影原生世界",
        kind: "fictional",
        description: "World Content Framework smoke",
      },
    });
    expect(world.statusCode).toBe(201);

    const location = await app.inject({
      method: "POST",
      url: "/api/source-worlds/naruto-framework/cards",
      payload: {
        entityKey: "location:iron-country",
        kind: "location",
        name: "铁之国",
        aliases: [],
        content: "# 铁之国\n\n原生世界地点资料。",
      },
    });
    expect(location.statusCode).toBe(201);

    const resource = await app.inject({
      method: "POST",
      url: "/api/source-worlds/naruto-framework/cards",
      payload: {
        entityKey: "resource:chakra-metal",
        kind: "resource",
        name: "查克拉金属",
        aliases: [],
        content: "# 查克拉金属\n\n产于：[[location:iron-country|铁之国]]",
      },
    });
    expect(resource.statusCode).toBe(201);
    expect(resource.json().card.record.kind).toBe("resource");

    const place = await app.inject({
      method: "GET",
      url: "/api/source-worlds/naruto-framework/cards/location%3Airon-country",
    });
    expect(place.statusCode).toBe(200);
    expect(place.json().relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "in",
          displayRelation: "产出",
          otherName: "查克拉金属",
        }),
      ]),
    );
  });
});
