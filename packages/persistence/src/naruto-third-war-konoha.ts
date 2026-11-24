import type { WorldAtlasCardKind } from "@narralume/contracts";
import type { NarrativeDatabase } from "./database.js";
import { SqliteSourceCorpusRepository } from "./source-corpus-repository.js";
import {
  NARUTO_CANONICAL_CORPUS,
  NARUTO_SOURCE_WORLD_ID,
} from "./naruto-source-world.js";
import { SqliteUnifiedSourceWorldRepository } from "./unified-source-world-repository.js";

export const NARUTO_THIRD_WAR_KONOHA_SLICE_KEY =
  "slice:konoha-third-war-kannabi";
export const NARUTO_THIRD_WAR_KONOHA_WORLD_TIME =
  "第三次忍界大战｜神无毗桥作战阶段";

const OFFICIAL_MINATO_COLUMN =
  "https://naruto-official.com/en/news/01_1517";
const OFFICIAL_KAKASHI_CHRONICLES =
  "https://naruto-official.com/en/anime/naruto2/list/01_563";
const NARUTOPEDIA_KANNABI =
  "https://naruto.fandom.com/wiki/Kannabi_Bridge";

export interface NarutoThirdWarKonohaSliceReport {
  sliceKey: string;
  worldTime: string;
  createdCards: string[];
  preservedCards: string[];
  resolvedSourceKeys: Record<string, string>;
}

export function installNarutoThirdWarKonohaSlice(
  db: NarrativeDatabase,
  now = new Date().toISOString(),
): NarutoThirdWarKonohaSliceReport {
  const worlds = new SqliteUnifiedSourceWorldRepository(db);
  const sources = new SqliteSourceCorpusRepository(db);
  const world = worlds.getWorld(NARUTO_SOURCE_WORLD_ID);
  if (!world) throw new Error("naruto.third_war.source_world_missing");
  if (world.canonicalCorpusId !== NARUTO_CANONICAL_CORPUS)
    throw new Error("naruto.third_war.canonical_corpus_mismatch");

  const required = {
    konoha: requireCard(worlds, "Konohagakure", "location"),
    iwa: requireCard(worlds, "Iwagakure", "location"),
    kusa: requireCard(worlds, "Kusagakure", "location"),
    teamMinato: requireCard(worlds, "Team Minato", "organization"),
    minato: requireCard(worlds, "Minato Namikaze", "character"),
    kakashi: requireCard(worlds, "Kakashi Hatake", "character"),
    obito: requireCard(worlds, "Obito Uchiha", "character"),
    rin: requireCard(worlds, "Rin Nohara", "character"),
    chidori: requireCard(worlds, "Chidori", "ability"),
  };

  const line = (...parts: string[]) => parts.join("\n");
  const wiki = (key: string, name: string) => "[[" + key + "|" + name + "]]";

  const curated = [
    {
      key: NARUTO_THIRD_WAR_KONOHA_SLICE_KEY,
      kind: "event" as const,
      name: "第三次忍界大战｜木叶·神无毗桥任务窗口",
      sourceUrl: OFFICIAL_MINATO_COLUMN,
      provenance: "source_canon_curated_view",
      summary:
        "第三次忍界大战中，木叶与岩隐战线围绕草之国及岩隐补给线展开；Team Minato 接到破坏神无毗桥、切断补给线的任务。",
      content: () =>
        line(
          "# 第三次忍界大战｜木叶·神无毗桥任务窗口",
          "",
          "世界时间：" + NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          "来源身份：source_canon",
          "来源说明：NARUTO Official Site 的 Minato Column 与 Kakashi Chronicles 明确把 Team Minato、神无毗桥任务、岩隐补给线置于第三次忍界大战；本卡只是时间切片视图，不创造第二个火影世界。",
          "",
          "母体地点：" + wiki(required.konoha.key, required.konoha.name),
          "敌对方向：" + wiki(required.iwa.key, required.iwa.name),
          "战场经过：" + wiki(required.kusa.key, required.kusa.name),
          "执行队伍：" + wiki(required.teamMinato.key, required.teamMinato.name),
          "相关人物：" + wiki(required.minato.key, required.minato.name),
          "相关人物：" + wiki(required.kakashi.key, required.kakashi.name),
          "相关人物：" + wiki(required.obito.key, required.obito.name),
          "相关人物：" + wiki(required.rin.key, required.rin.name),
          "关键地点：" + wiki("location:kannabi-bridge", "Kannabi Bridge"),
          "战场资产：" +
            wiki(
              "item:kakashi-minato-special-kunai",
              "Minato's Special Kunai Given to Kakashi",
            ),
          "当期能力：" + wiki(required.chidori.key, required.chidori.name),
          "战略资源：" +
            wiki(
              "resource:iwa-kannabi-supply-line",
              "Iwagakure Kannabi Supply Line",
            ),
          "任务情报：" +
            wiki(
              "information:kannabi-mission-objective",
              "Kannabi Bridge Mission Objective",
            ),
          "当前事务：" +
            wiki(
              "activity:team-minato-kannabi-mission",
              "Team Minato: destroy Kannabi Bridge",
            ),
        ),
    },
    {
      key: "location:kannabi-bridge",
      kind: "location" as const,
      name: "Kannabi Bridge",
      sourceUrl: NARUTOPEDIA_KANNABI,
      provenance: "source_canon",
      summary:
        "第三次忍界大战期间位于草之国方向、对岩隐补给线具有战略意义的桥梁。",
      content: () =>
        line(
          "# Kannabi Bridge",
          "",
          "世界时间：" + NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          "来源身份：source_canon",
          "来源说明：Kakashi Gaiden / Kakashi Chronicles 与相关资料明确把神无毗桥作为 Team Minato 的任务目标；地点细节以 Source Reference 为准。",
          "世界内部价值：它是岩隐补给线的关键通路，破坏后会直接改变木叶与岩隐战线的补给条件。",
          "准入/取得：位于第三次忍界大战的草之国战区，进入受战争与任务编成约束。",
          "",
          "发生于：" + wiki(required.kusa.key, required.kusa.name),
          "任务执行者：" +
            wiki(required.teamMinato.key, required.teamMinato.name),
          "承载：" +
            wiki(
              "resource:iwa-kannabi-supply-line",
              "Iwagakure Kannabi Supply Line",
            ),
        ),
    },
    {
      key: "resource:iwa-kannabi-supply-line",
      kind: "resource" as const,
      name: "Iwagakure Kannabi Supply Line",
      sourceUrl: OFFICIAL_MINATO_COLUMN,
      provenance: "source_canon",
      summary:
        "岩隐推进所依赖的补给线；木叶的神无毗桥任务以切断这条补给为目标。",
      content: () =>
        line(
          "# Iwagakure Kannabi Supply Line",
          "",
          "世界时间：" + NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          "来源身份：source_canon",
          "来源说明：NARUTO Official Site 明确说明 Team Minato 受命袭击岩隐补给线以减缓其推进；本卡把该既有战略对象显式化为 Asset/Economy 可查询资源。",
          "世界内部价值：维持岩隐前线推进的战略物流资源；对木叶而言，切断它能改变战线压力。",
          "准入/取得：不是普通商品，而是战区中的军事物流网络；控制、护送或破坏取决于战场位置与任务权限。",
          "自身目标/作用：持续向岩隐前线输送战争所需补给。",
          "",
          "运输经由：" + wiki("location:kannabi-bridge", "Kannabi Bridge"),
          "争夺方：" + wiki(required.teamMinato.key, required.teamMinato.name),
        ),
    },
    {
      key: "item:kakashi-minato-special-kunai",
      kind: "item" as const,
      name: "Minato's Special Kunai Given to Kakashi",
      sourceUrl: OFFICIAL_KAKASHI_CHRONICLES,
      provenance: "source_canon",
      summary:
        "神无毗桥任务开始前，Minato 交给刚晋升上忍的 Kakashi 的特殊苦无。",
      content: () =>
        line(
          "# Minato's Special Kunai Given to Kakashi",
          "",
          "世界时间：" + NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          "来源身份：source_canon",
          "来源说明：Kakashi Chronicles / Kakashi Gaiden 的任务开场明确记录 Minato 将特殊苦无交给新晋上忍 Kakashi。",
          "世界内部价值：这是处于三战前线任务中的具体高价值随身资产，并把 Kakashi 与 Minato 的战场支援能力直接连接起来。",
          "准入/取得：由 Minato 在任务开始阶段直接交给 Kakashi，不是公共领取物资。",
          "",
          "持有者：" + wiki(required.kakashi.key, required.kakashi.name),
          "授予者：" + wiki(required.minato.key, required.minato.name),
          "相关事务：" +
            wiki(
              "activity:team-minato-kannabi-mission",
              "Team Minato: destroy Kannabi Bridge",
            ),
        ),
    },
    {
      key: "information:kannabi-mission-objective",
      kind: "information" as const,
      name: "Kannabi Bridge Mission Objective",
      sourceUrl: OFFICIAL_MINATO_COLUMN,
      provenance: "source_canon",
      summary:
        "破坏神无毗桥、切断岩隐补给线，以减缓岩隐推进的任务目标。",
      content: () =>
        line(
          "# Kannabi Bridge Mission Objective",
          "",
          "世界时间：" + NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          "来源身份：source_canon",
          "来源说明：NARUTO Official Site 与 Kakashi Chronicles 均明确给出 Team Minato 的任务目标。",
          "世界内部价值：它决定 Team Minato 在这一时间窗口的行动方向，也是木叶战线试图撬动岩隐后勤的关键信息。",
          "",
          "知道：" + wiki(required.teamMinato.key, required.teamMinato.name),
          "指向：" + wiki("location:kannabi-bridge", "Kannabi Bridge"),
          "针对：" +
            wiki(
              "resource:iwa-kannabi-supply-line",
              "Iwagakure Kannabi Supply Line",
            ),
        ),
    },
    {
      key: "activity:team-minato-kannabi-mission",
      kind: "activity" as const,
      name: "Team Minato: destroy Kannabi Bridge",
      sourceUrl: OFFICIAL_MINATO_COLUMN,
      provenance: "source_canon",
      summary:
        "Team Minato 在第三次忍界大战中执行破坏神无毗桥、切断岩隐补给线的任务。",
      content: () =>
        line(
          "# Team Minato: destroy Kannabi Bridge",
          "",
          "阶段：ongoing",
          "世界时间：" + NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          "原因：木叶需要通过破坏神无毗桥切断岩隐补给线，减缓岩隐在战线上的推进。",
          "来源身份：source_canon",
          "来源说明：NARUTO Official Site / Kakashi Chronicles；此处将已知任务显式化为 Source World Activity，而不是新增小说剧情。",
          "",
          "参与者：" + wiki(required.teamMinato.key, required.teamMinato.name),
          "行动者：" + wiki(required.kakashi.key, required.kakashi.name),
          "涉及：" + wiki("location:kannabi-bridge", "Kannabi Bridge"),
          "涉及：" + wiki(required.chidori.key, required.chidori.name),
          "涉及：" +
            wiki(
              "resource:iwa-kannabi-supply-line",
              "Iwagakure Kannabi Supply Line",
            ),
          "涉及：" +
            wiki(
              "information:kannabi-mission-objective",
              "Kannabi Bridge Mission Objective",
            ),
        ),
    },
  ];

  return db.transaction(() => {
    const createdCards: string[] = [];
    const preservedCards: string[] = [];

    for (const card of curated) {
      if (worlds.getCard(NARUTO_SOURCE_WORLD_ID, card.key)) {
        preservedCards.push(card.key);
        continue;
      }
      sources.upsertRecord({
        corpusId: NARUTO_CANONICAL_CORPUS,
        sourceKey: card.key,
        kind: card.kind,
        name: card.name,
        aliases: [],
        summary: card.summary,
        raw: {
          atlasCard: true,
          curatedTimeSlice: NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
          provenance: card.provenance,
          evidenceUrls: [
            OFFICIAL_MINATO_COLUMN,
            OFFICIAL_KAKASHI_CHRONICLES,
            NARUTOPEDIA_KANNABI,
          ],
        },
        sourceUrl: card.sourceUrl,
        originCollection: "curated-naruto-third-war-konoha",
        importedAt: now,
      });
      worlds.upsertCard({
        worldId: NARUTO_SOURCE_WORLD_ID,
        entityKey: card.key,
        kind: card.kind,
        name: card.name,
        content:
          "# " +
          card.name +
          "\n\n世界时间：" +
          NARUTO_THIRD_WAR_KONOHA_WORLD_TIME +
          "\n\n状态：等待关系装配。",
        now,
      });
      createdCards.push(card.key);
    }

    for (const card of curated) {
      if (!createdCards.includes(card.key)) continue;
      worlds.upsertCard({
        worldId: NARUTO_SOURCE_WORLD_ID,
        entityKey: card.key,
        kind: card.kind,
        name: card.name,
        content: card.content(),
        now,
      });
    }

    return {
      sliceKey: NARUTO_THIRD_WAR_KONOHA_SLICE_KEY,
      worldTime: NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
      createdCards,
      preservedCards,
      resolvedSourceKeys: Object.fromEntries(
        Object.entries(required).map(([label, value]) => [label, value.key]),
      ),
    };
  });
}

function requireCard(
  worlds: SqliteUnifiedSourceWorldRepository,
  name: string,
  kind: WorldAtlasCardKind,
): { key: string; name: string } {
  const card = worlds.findCardByReference(NARUTO_SOURCE_WORLD_ID, name, {
    kind,
  });
  if (!card)
    throw new Error(
      "naruto.third_war.required_source_missing:" + kind + ":" + name,
    );
  return { key: card.record.sourceKey, name: card.record.name };
}
