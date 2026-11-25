import {
  InspirationRollRequestSchema,
  InspirationRollResponseSchema,
  InspirationSeedCardSchema,
  InspirationSlotKeySchema,
  type InspirationChannel,
  type InspirationRollRequest,
  type InspirationRollResponse,
  type InspirationSeedCard,
  type InspirationSlotItem,
  type InspirationSlotKey,
} from "@narralume/contracts";
import type { NarrativeDatabase } from "@narralume/persistence";
import {
  BUILTIN_INSPIRATION_SLOT_BANK,
  INSPIRATION_CHAINS,
  hookFor,
  type InspirationChain,
} from "./inspiration-slot-bank-data.js";

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
const LLM_M03_TYPES = {
  identity: new Set(["ROLE", "ARCH", "TRAIT"]),
  anomalyRule: new Set(["GF", "PLAY", "RULE", "BRG"]),
  highValueCircle: new Set(["GATE", "REL", "WORLD"]),
  twistPressure: new Set(["REV", "SIT", "CP", "MOVE"]),
} satisfies Record<InspirationSlotKey, ReadonlySet<string>>;

type SegmentRow = {
  project_id: string;
  source_id: string;
  title: string;
  metadata_json: string;
};

export interface InspirationMaterialBundle {
  index: number;
  identityHint?: InspirationSlotItem;
  anomalyHint: InspirationSlotItem;
  circleHint?: InspirationSlotItem;
  twistHint: InspirationSlotItem;
}

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
  channel: InspirationChannel | "all",
  m03: readonly InspirationSlotItem[],
) {
  const includesChannel = (item: InspirationSlotItem) =>
    channel === "all" || item.channels.includes(channel);
  const builtin = BUILTIN_INSPIRATION_SLOT_BANK.filter(includesChannel);
  const imported = m03.filter(includesChannel);
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

interface CyclingDrawState {
  round: number;
  remaining: InspirationSlotItem[];
}

interface PriorityDrawState extends CyclingDrawState {
  phase: "primary" | "fallback";
}

function createPriorityDrawState(): PriorityDrawState {
  return { round: -1, phase: "primary", remaining: [] };
}

function drawPriorityItem(
  primary: readonly InspirationSlotItem[],
  fallback: readonly InspirationSlotItem[],
  state: PriorityDrawState,
  keyword: string,
  random: () => number,
): InspirationSlotItem {
  if (!primary.length && !fallback.length)
    throw new Error("inspiration.empty_slot_pool");

  if (!state.remaining.length) {
    if (state.round < 0) {
      state.round = 0;
      state.phase = primary.length ? "primary" : "fallback";
      state.remaining = [...(primary.length ? primary : fallback)];
    } else if (state.phase === "primary" && fallback.length) {
      state.phase = "fallback";
      state.remaining = [...fallback];
    } else {
      state.round += 1;
      state.phase = primary.length ? "primary" : "fallback";
      state.remaining = [...(primary.length ? primary : fallback)];
    }
  }

  const selected = weightedDraw(state.remaining, keyword, random);
  state.remaining = state.remaining.filter((item) => item.id !== selected.id);
  return state.round === 0
    ? selected
    : { ...selected, id: `${selected.id}:deal-round-${state.round + 1}` };
}

const CHAIN_SLOT_FIELDS = {
  identity: "identity",
  anomalyRule: "leverage",
  highValueCircle: "gatekeeper",
  twistPressure: "inbound",
} as const satisfies Record<InspirationSlotKey, keyof InspirationChain>;

/**
 * The card face is the hook; the five-segment chain stays behind it and only
 * feeds the outline. Do not concatenate the chain into the sentence.
 */
function sentenceFor(chain: InspirationChain): string {
  const hook = hookFor(chain);
  if (!TURN.test(hook) || !hook.startsWith("我是")) {
    throw new Error("inspiration.hollow_seed:" + chain.id);
  }
  return hook;
}

function chainSlots(
  chain: InspirationChain,
): Record<InspirationSlotKey, InspirationSlotItem> {
  return Object.fromEntries(
    SLOT_KEYS.map((slot) => {
      const phrase = chain[CHAIN_SLOT_FIELDS[slot]] as string;
      const item: InspirationSlotItem = {
        id: "chain:" + chain.id + ":" + slot,
        slot,
        channels: [chain.channel],
        label: phrase,
        phrase,
        sourceLibrary: "slot-bank",
        materialType: null,
        tags: [chain.channel, slot, chain.packId],
      };
      return [slot, item];
    }),
  ) as Record<InspirationSlotKey, InspirationSlotItem>;
}

function cardFromChain(
  input: InspirationRollRequest,
  chain: InspirationChain,
  index: number,
): InspirationSeedCard {
  const slots = chainSlots(chain);
  return InspirationSeedCardSchema.parse({
    id: `inspiration:chain:${input.seed ?? "random"}:${index + 1}:${chain.id}`,
    channel: input.channel,
    sentence: sentenceFor(chain),
    slots,
    starterBlueprint: {
      suggestedTitle: "我在" + chain.gatekeeper + "的第一笔",
      genreLabel:
        input.channel === "female"
          ? "女频奇遇"
          : input.channel === "male"
            ? "男频奇遇"
            : "奇遇幻想",
      readerNeed:
        input.channel === "female" ? "偏爱与主动权" : "得意与阶层跃升",
      targetEmotion:
        input.channel === "female" ? "被偏爱、掌握命运" : "得意、惊艳、赢麻了",
      protagonistIdentity: chain.identity,
      advantageHook: chain.leverage,
      targetCircle: chain.gatekeeper,
      openingTension: chain.inbound,
      firstTake: chain.firstTake,
      inbound: chain.inbound,
      packId: chain.packId,
      packLabel: chain.packLabel,
    },
    chainId: chain.id,
    packId: chain.packId,
  });
}

function chainMatchesLocks(
  chain: InspirationChain,
  locked: NonNullable<InspirationRollRequest["lockedSlots"]>,
  channel: InspirationChannel,
): boolean {
  for (const slot of SLOT_KEYS) {
    const fixed = locked[slot];
    if (!fixed) continue;
    if (!fixed.channels.includes(channel)) return false;
    if ((chain[CHAIN_SLOT_FIELDS[slot]] as string) !== fixed.phrase) {
      return false;
    }
  }
  return true;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function materialPool(
  channel: InspirationChannel,
  m03: readonly InspirationSlotItem[],
  slot: InspirationSlotKey,
) {
  const preferredTypes = LLM_M03_TYPES[slot];
  const primary = m03.filter(
    (item) =>
      item.slot === slot &&
      item.channels.includes(channel) &&
      item.materialType !== null &&
      preferredTypes.has(item.materialType),
  );
  const fallback = BUILTIN_INSPIRATION_SLOT_BANK.filter(
    (item) => item.slot === slot && item.channels.includes(channel),
  );
  return { primary, fallback };
}

/**
 * Deals one mold bundle per requested LLM seed. Relevant active M03 types are
 * exhausted before the built-in fallback bank, then a new deal round opens.
 * Every bundle keeps the source item intact so the generated slots can write
 * sourceLibrary/materialId/materialType back for auditability.
 */
export function dealMaterialBundlesForLlm(
  database: NarrativeDatabase,
  request: InspirationRollRequest,
): InspirationMaterialBundle[] {
  const input = InspirationRollRequestSchema.parse(request);
  const m03 = input.useM03 ? loadM03SlotItems(database, input.projectId) : [];
  const random = seededRandom(input.seed);
  const keyword = input.topic ?? input.keyword ?? "";
  const states = Object.fromEntries(
    SLOT_KEYS.map((slot) => [slot, createPriorityDrawState()]),
  ) as Record<InspirationSlotKey, PriorityDrawState>;
  const pools = Object.fromEntries(
    SLOT_KEYS.map((slot) => [slot, materialPool(input.channel, m03, slot)]),
  ) as Record<
    InspirationSlotKey,
    { primary: InspirationSlotItem[]; fallback: InspirationSlotItem[] }
  >;
  const locked = input.lockedSlots ?? {};
  const signatures = new Set<string>();

  return Array.from({ length: input.count }, (_, offset) => {
    const draw = (slot: InspirationSlotKey): InspirationSlotItem => {
      const fixed = locked[slot];
      if (fixed) return fixed;
      const pool = pools[slot];
      return drawPriorityItem(
        pool.primary,
        pool.fallback,
        states[slot],
        keyword,
        random,
      );
    };
    const identityHint = draw("identity");
    const anomalyHint = draw("anomalyRule");
    const circleHint = draw("highValueCircle");
    const twistHint = draw("twistPressure");
    const signature = [
      identityHint.id,
      anomalyHint.id,
      circleHint.id,
      twistHint.id,
    ].join("|");
    if (signatures.has(signature)) {
      throw new Error("inspiration.duplicate_material_bundle");
    }
    signatures.add(signature);
    return {
      index: offset + 1,
      identityHint,
      anomalyHint,
      circleHint,
      twistHint,
    };
  });
}

/**
 * Deterministic when seed is supplied. Each unlocked slot is nonrepeating
 * until its pool is exhausted; later shuffle rounds may reuse source cards,
 * while dealt item IDs keep every four-slot signature globally unique.
 */
/**
 * Deals whole chains. A card is one story from one pack; it is never stitched
 * from four unrelated pools. The requested count is capped by how many
 * compatible chains exist, because a repeated story is worse than a short batch.
 */
export function rollInspirationSeeds(
  database: NarrativeDatabase,
  request: InspirationRollRequest,
): InspirationRollResponse {
  const input = InspirationRollRequestSchema.parse(request);
  const m03 = input.useM03 ? loadM03SlotItems(database, input.projectId) : [];
  const stats = inspirationPoolStats(input.channel, m03);
  const random = seededRandom(input.seed);
  const locked = input.lockedSlots ?? {};
  const compatible = INSPIRATION_CHAINS.filter(
    (chain) =>
      chain.channel === input.channel &&
      chainMatchesLocks(chain, locked, input.channel),
  );
  if (!compatible.length) throw new Error("inspiration.no_chain_for_locks");
  const count = Math.min(input.count, compatible.length);
  const cards = shuffled(compatible, random)
    .slice(0, count)
    .map((chain, index) => cardFromChain(input, chain, index));
  return InspirationRollResponseSchema.parse({
    channel: input.channel,
    mode: "local",
    topic: input.topic ?? null,
    cards,
    poolStats: stats,
  });
}
