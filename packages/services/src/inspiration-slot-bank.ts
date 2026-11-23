import {
  InspirationRollRequestSchema,
  InspirationRollResponseSchema,
  InspirationSeedCardSchema,
  InspirationSlotKeySchema,
  type InspirationChannel,
  type InspirationRollRequest,
  type InspirationRollResponse,
  type InspirationSlotItem,
  type InspirationSlotKey,
} from "@narralume/contracts";
import type { NarrativeDatabase } from "@narralume/persistence";
import { BUILTIN_INSPIRATION_SLOT_BANK } from "./inspiration-slot-bank-data.js";

export { BUILTIN_INSPIRATION_SLOT_BANK } from "./inspiration-slot-bank-data.js";

export const M03_TYPE_MAPPING: Readonly<Record<string, InspirationSlotKey>> = {
  ROLE: "identity",
  ARCH: "identity",
  TRAIT: "identity",
  BACK: "identity",
  GF: "anomalyRule",
  PLAY: "anomalyRule",
  RULE: "anomalyRule",
  BRG: "anomalyRule",
  WS: "anomalyRule",
  GATE: "highValueCircle",
  REL: "highValueCircle",
  WORLD: "highValueCircle",
  LOC: "highValueCircle",
  SCALE: "highValueCircle",
  HK: "highValueCircle",
  REV: "twistPressure",
  SIT: "twistPressure",
  CP: "twistPressure",
  MOVE: "twistPressure",
  OS: "twistPressure",
  DES: "twistPressure",
};

const SLOT_KEYS = InspirationSlotKeySchema.options;
const TURN = /没想到|却|但|不料|结果|反而/u;

type SegmentRow = {
  project_id: string;
  source_id: string;
  title: string;
  metadata_json: string;
};

/** Reads imported Module-2 materials without linking to any world/Reality object. */
export function loadM03SlotItems(
  database: NarrativeDatabase,
  projectId?: string,
): InspirationSlotItem[] {
  const rows = database.raw
    .prepare(
      "SELECT project_id, source_id, title, metadata_json FROM text_segments " +
        "WHERE source_type = 'creative_material' ORDER BY updated_at DESC, id",
    )
    .all() as unknown as SegmentRow[];
  const candidates = rows.flatMap((row) => {
    let metadata: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(row.metadata_json);
      if (!value || typeof value !== "object" || Array.isArray(value))
        return [];
      metadata = value as Record<string, unknown>;
    } catch {
      return [];
    }
    if (metadata.status !== "active" || metadata.libraryId !== "M03") return [];
    const materialId =
      typeof metadata.materialId === "string" && metadata.materialId.trim()
        ? metadata.materialId.trim()
        : row.source_id.replace(/^M03:/u, "");
    const materialType =
      typeof metadata.materialType === "string"
        ? metadata.materialType.trim().toUpperCase().split(/[-_]/u)[0]!
        : materialId.split(/[-_]/u)[0]!;
    const slot = M03_TYPE_MAPPING[materialType];
    if (!slot || !materialId) return [];
    const name = row.title.replace(/^M03\s+[^｜|]+[｜|]\s*/u, "").trim();
    const summary =
      typeof metadata.summary === "string" ? metadata.summary : "";
    const phrase = extractM03Phrase(name, summary, slot);
    if (!phrase) return [];
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    return [
      {
        projectId: row.project_id,
        item: {
          id: "M03:" + materialId,
          slot,
          channels: ["male"] as InspirationChannel[],
          label: name || phrase,
          phrase,
          sourceLibrary: "M03" as const,
          materialType,
          materialId,
          tags,
        },
      },
    ];
  });
  // Imported M03 is project-indexed; one card must not multiply with each import.
  const ordered = projectId
    ? candidates.sort(
        (a, b) =>
          Number(b.projectId === projectId) - Number(a.projectId === projectId),
      )
    : candidates;
  const seen = new Set<string>();
  return ordered.flatMap(({ item }) => {
    if (seen.has(item.materialId!)) return [];
    seen.add(item.materialId!);
    return [item];
  });
}

function extractM03Phrase(
  name: string,
  summary: string,
  slot: InspirationSlotKey,
): string {
  const clean = (value: string) =>
    value
      .replace(/[\r\n]+/gu, " ")
      .replace(/^(?:摘要|核心玩法|一句话|名称|标题)[:：]\s*/u, "")
      .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu, "")
      .trim();
  const raw = clean(summary) || clean(name);
  if (!raw) return "";
  const fragment = raw
    .split(/[。！？；]/u)[0]!
    .slice(0, 96)
    .trim();
  if (fragment.length < 3) return "";
  if (slot === "identity") return clean(name).slice(0, 38) || fragment;
  if (slot === "twistPressure") {
    return TURN.test(fragment) ? fragment : "没想到" + fragment;
  }
  return fragment;
}

export function inspirationPoolStats(
  channel: InspirationChannel,
  m03: readonly InspirationSlotItem[],
) {
  const builtin = BUILTIN_INSPIRATION_SLOT_BANK.filter((item) =>
    item.channels.includes(channel),
  );
  const imported = m03.filter((item) => item.channels.includes(channel));
  const bySlot = Object.fromEntries(
    SLOT_KEYS.map((slot) => {
      const slotBankCount = builtin.filter((item) => item.slot === slot).length;
      const m03Count = imported.filter((item) => item.slot === slot).length;
      return [
        slot,
        { slotBankCount, m03Count, total: slotBankCount + m03Count },
      ];
    }),
  ) as Record<
    InspirationSlotKey,
    { slotBankCount: number; m03Count: number; total: number }
  >;
  return { slotBankCount: builtin.length, m03Count: imported.length, bySlot };
}

function seededRandom(seed?: string): () => number {
  if (seed === undefined) return Math.random;
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedDraw(
  items: readonly InspirationSlotItem[],
  keyword: string,
  random: () => number,
): InspirationSlotItem {
  if (!items.length) throw new Error("inspiration.empty_slot_pool");
  const normalized = keyword.trim().toLocaleLowerCase();
  const weights = items.map((item) => {
    const match =
      normalized &&
      [item.label, item.phrase, ...item.tags].some((value) =>
        value.toLocaleLowerCase().includes(normalized),
      );
    return (match ? 12 : 1) * (item.sourceLibrary === "M03" ? 2 : 1);
  });
  let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < items.length; index++) {
    ticket -= weights[index]!;
    if (ticket < 0) return items[index]!;
  }
  return items[items.length - 1]!;
}

function makeSentence(
  slots: Record<InspirationSlotKey, InspirationSlotItem>,
): string {
  const identity = slots.identity.phrase.replace(/^我是/u, "");
  const anomaly = slots.anomalyRule.phrase.replace(/^(?:我能|能够)/u, "");
  const circle = slots.highValueCircle.phrase;
  const twist = slots.twistPressure.phrase;
  const pressure = TURN.test(twist) ? twist : "没想到" + twist;
  const sentence =
    "我是" +
    identity +
    "，偶然发现自己" +
    anomaly +
    "，借此闯入" +
    circle +
    "，" +
    pressure.replace(/^[，。\s]+/u, "") +
    (/[。！？]$/u.test(pressure) ? "" : "。");
  if (
    !TURN.test(sentence) ||
    SLOT_KEYS.some((key) => !slots[key].phrase.trim())
  ) {
    throw new Error("inspiration.hollow_seed");
  }
  return sentence;
}

/** Deterministic when seed is supplied; nonlocked slot cards never repeat within a batch. */
export function rollInspirationSeeds(
  database: NarrativeDatabase,
  request: InspirationRollRequest,
): InspirationRollResponse {
  const input = InspirationRollRequestSchema.parse(request);
  const m03 = input.useM03 ? loadM03SlotItems(database, input.projectId) : [];
  const stats = inspirationPoolStats(input.channel, m03);
  const random = seededRandom(input.seed);
  const available = [...BUILTIN_INSPIRATION_SLOT_BANK, ...m03].filter((item) =>
    item.channels.includes(input.channel),
  );
  const locked = input.lockedSlots ?? {};
  for (const slot of SLOT_KEYS) {
    if (
      !locked[slot] &&
      available.filter((item) => item.slot === slot).length < input.count
    ) {
      throw new Error("inspiration.insufficient_slot_pool:" + slot);
    }
  }
  const used = Object.fromEntries(
    SLOT_KEYS.map((slot) => [slot, new Set<string>()]),
  ) as Record<InspirationSlotKey, Set<string>>;
  const cards = Array.from({ length: input.count }, (_, index) => {
    const slots = Object.fromEntries(
      SLOT_KEYS.map((slot) => {
        if (locked[slot]) return [slot, locked[slot]];
        const eligible = available.filter(
          (item) => item.slot === slot && !used[slot].has(item.id),
        );
        const selected = weightedDraw(eligible, input.keyword ?? "", random);
        used[slot].add(selected.id);
        return [slot, selected];
      }),
    ) as Record<InspirationSlotKey, InspirationSlotItem>;
    const sentence = makeSentence(slots);
    return InspirationSeedCardSchema.parse({
      id:
        "inspiration:" +
        (input.seed ?? "random") +
        ":" +
        String(index + 1) +
        ":" +
        Math.floor(random() * 0xffffffff).toString(16),
      channel: input.channel,
      sentence,
      slots,
      starterBlueprint: {
        suggestedTitle: "我在" + slots.highValueCircle.label + "的秘密",
        genreLabel:
          input.channel === "female"
            ? "女频奇遇"
            : input.channel === "male"
              ? "男频奇遇"
              : "奇遇幻想",
        readerNeed:
          input.channel === "female" ? "偏爱与主动权" : "得意与阶层跃升",
        targetEmotion:
          input.channel === "female"
            ? "被偏爱、掌握命运"
            : "得意、惊艳、赢麻了",
        protagonistIdentity: slots.identity.phrase,
        advantageHook: slots.anomalyRule.phrase,
        targetCircle: slots.highValueCircle.phrase,
        openingTension: slots.twistPressure.phrase,
      },
    });
  });
  return InspirationRollResponseSchema.parse({
    channel: input.channel,
    cards,
    poolStats: stats,
  });
}
