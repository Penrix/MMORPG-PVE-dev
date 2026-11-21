import {
  worldBuilderWorkshopForAtlasKind,
  worldPackAtlasKind,
  type WorldPackDocument,
  type WorldPackRequest,
} from "@narralume/contracts";
import type { WorldWorkshop } from "./world-production-engine.js";

/**
 * One world-production framework for every source: history, existing IP,
 * finished fiction, author notes and original concepts all go through the
 * v0.1-v0.7 World Design + Game Content Production method. Source provenance
 * affects what we may assert as a fact, not which world systems get built.
 *
 * The only world-physics fork is ordinary vs supernatural. Ordinary worlds
 * still have POWER: law, money, office, reputation, organization and access.
 * This module does not select or paraphrase method-document prompt excerpts.
 */
export type WorldPowerMode = "ordinary" | "supernatural";

export function worldPowerMode(
  request: Pick<WorldPackRequest, "genre" | "premise" | "worldPower">,
): WorldPowerMode {
  if (request.worldPower) return request.worldPower;
  // Backward compatibility for existing requests. Authors may explicitly
  // choose worldPower to avoid genre-label heuristics.
  return /玄幻|修仙|武侠|仙侠|灵力|斗气|魔法|忍术|火影|咒术|查克拉|奇幻|超凡|灵异|神通|异能|妖魔/.test(
    request.genre + request.premise,
  )
    ? "supernatural"
    : "ordinary";
}

/** Historical v0.2 design lenses.
 * These are NOT the ten World Atlas Families and NOT a mandatory runtime queue.
 * Atlas Families describe content coverage; workshops are production operations.
 */
export const WORLD_DESIGN_SYSTEMS = [
  "world-map",
  "factions",
  "npc-ecology",
  "power-system",
  "resources",
  "event-ecology",
  "progression",
  "living-world",
  "social-world",
  "endgame",
] as const;

export function powerDesignProducts(
  request: Pick<WorldPackRequest, "genre" | "premise" | "worldPower">,
): readonly string[] {
  if (worldPowerMode(request) === "supernatural") {
    return [
      "已有世界的超凡现象和实际有效的能力法则、境界及招式表现，不擅自加代价",
      "谁真正掌握这些力量、怎样取得、施展后改变什么具体人事物",
      "超凡能力改变哪些职业、组织、产业、资源价值及社会权限；保留既定金手指",
    ];
  }
  return [
    "既有社会中的实际力量：职位、资本、军权、法规、职业能力、信息与声望，不凭空写超凡",
    "谁具体掌握某项力量，其权限能做什么、通过哪些人与制度取得或转化",
    "力量怎样影响组织、市场、个人生活、社会圈层及更高价值对象",
  ];
}

/** Bootstrap hints for a fresh production batch.
 * The runtime no longer executes this list as a fixed pipeline: after the
 * first step, actual graph deficiencies choose what runs next.
 */
export function initialWorldWorkshopOrder(
  request: WorldPackRequest,
): readonly (
  | "geography"
  | "factions"
  | "people"
  | "economy"
  | "power"
  | "events"
  | "social"
  | "playability"
  | "living"
)[] {
  if (request.intent === "advance") return ["living", "events"];
  const common = ["geography", "factions", "people", "economy"] as const;
  if (request.scale === "W0")
    return [...common, "power", "events", "social", "playability"];
  return [...common, "events", "social", "playability"];
}

/**
 * v0.2 §8: five entry families and open exploration. Start from the named
 * existing world object whenever it has an established identity. Never
 * manufacture geography, factions or NPCs merely to satisfy a fixed outline.
 *
 * A focus phrase not represented in Canon remains unresolved; the producer
 * must first establish its identity rather than pretend it already exists.
 */
export function resolveWorldDesignEntry(
  request: WorldPackRequest,
  world: WorldPackDocument,
): { workshop: WorldWorkshop; subjectRef: string } | null {
  const focus = request.focus.trim();
  if (!focus) return null;
  const exact = world.nodes.filter(
    (n) =>
      n.localId === focus ||
      n.name === focus ||
      n.existingCanonId === focus ||
      (n.existingCanonId != null && "canon:" + n.existingCanonId === focus),
  );
  const candidates = exact.length
    ? exact
    : world.nodes.filter(
        (n) =>
          focus.length >= 3 &&
          n.name.length >= 3 &&
          (focus.includes(n.name) || n.name.includes(focus)),
      );
  if (candidates.length !== 1) return null;
  const node = candidates[0]!;
  const atlasWorkshop = worldBuilderWorkshopForAtlasKind(
    worldPackAtlasKind(node),
  );
  const legacyTypeMap: Record<typeof node.type, WorldWorkshop> = {
    location: "geography",
    organization: "factions",
    character: "people",
    item: "economy",
    rule: "power",
    concept: "social",
  };
  return {
    workshop: atlasWorkshop ?? legacyTypeMap[node.type],
    subjectRef: node.localId,
  };
}
