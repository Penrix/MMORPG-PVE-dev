import { afterEach, describe, expect, it } from "vitest";
import {
  importNarutoDattebayo,
  installNarutoSourceWorld,
  installNarutoThirdWarKonohaSlice,
  NARUTO_SOURCE_WORLD_ID,
  NARUTO_THIRD_WAR_KONOHA_SLICE_KEY,
  NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
  SqliteUnifiedSourceWorldRepository,
  type NarutoData,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

let db: NodeNarrativeDatabase | null = null;
const now = "2026-11-24T17:00:00.000Z";

function thirdWarFixture(): NarutoData {
  return {
    characters: [
      { id: 1, name: "Minato Namikaze", jutsu: [] },
      { id: 2, name: "Kakashi Hatake", jutsu: ["Chidori"] },
      { id: 3, name: "Obito Uchiha", jutsu: [] },
      { id: 4, name: "Rin Nohara", jutsu: [] },
    ],
    clans: [],
    villages: [
      { id: 16, name: "Konohagakure", characters: [1, 2, 3, 4] },
      { id: 11, name: "Iwagakure", characters: [] },
      { id: 9, name: "Kusagakure", characters: [] },
    ],
    teams: [{ id: 155, name: "Team Minato", characters: [2, 3, 4] }],
    "kekkei-genkai": [],
    "tailed-beasts": [],
    akatsuki: [],
    kara: [],
  };
}

afterEach(() => {
  db?.close();
  db = null;
});

describe("Naruto Third War Konoha Source time slice", () => {
  it("reuses canonical identities, creates a narrow slice graph and is idempotent", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();
    importNarutoDattebayo(db, thirdWarFixture(), now);
    installNarutoSourceWorld(db, now);

    const first = installNarutoThirdWarKonohaSlice(db, now);
    expect(first.sliceKey).toBe(NARUTO_THIRD_WAR_KONOHA_SLICE_KEY);
    expect(first.worldTime).toBe(NARUTO_THIRD_WAR_KONOHA_WORLD_TIME);
    expect(first.createdCards).toHaveLength(6);
    expect(first.resolvedSourceKeys).toMatchObject({
      konoha: "village:16",
      iwa: "village:11",
      kusa: "village:9",
      teamMinato: "team:155",
      minato: "character:1",
      kakashi: "character:2",
      obito: "character:3",
      rin: "character:4",
      chidori: "jutsu:Chidori",
    });

    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    const slice = worlds.getCard(
      NARUTO_SOURCE_WORLD_ID,
      NARUTO_THIRD_WAR_KONOHA_SLICE_KEY,
    );
    expect(slice?.content).toContain(NARUTO_THIRD_WAR_KONOHA_WORLD_TIME);
    expect(slice?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "执行队伍",
          otherName: "Team Minato",
        }),
        expect.objectContaining({
          relation: "相关人物",
          otherName: "Kakashi Hatake",
        }),
        expect.objectContaining({
          relation: "关键地点",
          otherName: "Kannabi Bridge",
        }),
      ]),
    );

    const activity = worlds.getCard(
      NARUTO_SOURCE_WORLD_ID,
      "activity:team-minato-kannabi-mission",
    );
    expect(activity?.content).toContain("阶段：ongoing");
    expect(activity?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "参与者",
          otherName: "Team Minato",
        }),
        expect.objectContaining({
          relation: "涉及",
          otherName: "Iwagakure Kannabi Supply Line",
        }),
      ]),
    );

    const second = installNarutoThirdWarKonohaSlice(
      db,
      "2026-11-24T17:01:00.000Z",
    );
    expect(second.createdCards).toHaveLength(0);
    expect(second.preservedCards).toHaveLength(6);
  });
});
