import {
  createSession,
  defaultConfig,
  makeEntity,
} from "./vendor/worldforge/full/engine.js";
import { runAllAgents } from "./vendor/worldforge/full/agent.js";
import { arbitrate } from "./vendor/worldforge/full/arbiter.js";
import {
  deriveRegionResources,
  EARTH_LAWS,
} from "./vendor/worldforge/full/physics.js";
import type { LLMBindings } from "./vendor/worldforge/full/llm.js";
import type {
  EntityCard,
  SimulationEvent,
  WorldLaws,
  SpaceRegion,
} from "./vendor/worldforge/full/types.js";

/**
 * Production boundary between NarraLume's one true Canon and WorldForge's
 * ORIGINAL agent + arbiter. This is a candidate-only sandbox: it cannot
 * commit Canon, rewrite powers or invent ability prices.
 *
 * WorldForge's original physics runs at civilization/territorial scale.
 * Therefore this bridge ONLY presents existing organizations as agents.
 * Individual NPC psychology/GOAP must be integrated separately. Pretending
 * a person is a civilization would generate fake demographic facts.
 */
export interface WorldForgeFactionSeed {
  worldTitle: string;
  worldTime: string;
  organizations: readonly {
    id: string;
    name: string;
    description: string;
  }[];
  locations: readonly { id: string; name: string }[];
  relationships: readonly {
    fromEntityId: string;
    toEntityId: string;
    relation: string;
  }[];
  history: readonly {
    id: string;
    title: string;
    description: string;
    participants: readonly string[];
  }[];
}

export interface WorldForgeFactionPreview {
  /** Source: actual upstream WorldForge runAllAgents + arbitrate. */
  engine: "worldforge";
  worldTime: string;
  organizations: readonly string[];
  /** Proposals are NEVER adopted facts. Numeric deltas aren't applied. */
  proposals: readonly {
    id: string;
    participants: readonly string[];
    description: string;
    major: boolean;
    status: "proposed";
  }[];
  rejected: readonly { description: string; reason: string }[];
}

export async function previewWorldForgeFactions(
  seed: WorldForgeFactionSeed,
  llm: LLMBindings,
): Promise<WorldForgeFactionPreview> {
  const actors = seed.organizations.slice(0, 4);
  if (!actors.length)
    return {
      engine: "worldforge",
      worldTime: seed.worldTime,
      organizations: [],
      proposals: [],
      rejected: [],
    };

  // The adapter deliberately DOES NOT copy the default magic / qi rules:
  // those examples prohibit resurrection and impose energy/cost rules.
  // They are not the author's Canon and must never amend protagonist powers.
  const laws: WorldLaws = {
    ...EARTH_LAWS,
    id: "narralume-sandbox",
    name: seed.worldTitle,
    rules: [],
    narrative: [],
    ontology: [],
  };

  // A *logical* simulation area is not a claim about physical terrain.
  // The physics engine is not invoked in faction-preview mode.
  const location = seed.locations[0];
  const areaId = location?.id ?? "logical-world-area";
  const region: SpaceRegion = {
    id: areaId,
    name: location?.name ?? seed.worldTitle,
    biome: "plains",
    resources: deriveRegionResources("plains", laws),
    neighbors: [],
    layer: 0,
    refined: false,
    character:
      "Temporary logical agent context; terrain, area, population and resources are NOT Canon facts",
  };

  const actorIds = new Set(actors.map((a) => a.id));
  const entities: EntityCard[] = actors.map((actor) => {
    const item = makeEntity(
      actor.id,
      actor.name,
      areaId,
      "未指定",
      "非领土模拟组织",
      {
        population: 1,
        food: 0,
        economy: 0,
        military: 0,
        legitimacy: 50,
        stability: 50,
      },
      {},
      {},
    );
    item.identity.origin_story = actor.description;
    item.internal.active_issues = [
      "Only accepted Canon provides facts. The numeric fields and this regional map are technical placeholders; do not infer money, military, power rules or population from them.",
    ];
    item.geography.neighbors = seed.relationships
      .filter(
        (link) =>
          link.fromEntityId === actor.id || link.toEntityId === actor.id,
      )
      .map((link) =>
        link.fromEntityId === actor.id ? link.toEntityId : link.fromEntityId,
      )
      .filter((id) => actorIds.has(id));
    item.relations = seed.relationships
      .filter(
        (link) =>
          link.fromEntityId === actor.id && actorIds.has(link.toEntityId),
      )
      .map((link) => ({
        target: link.toEntityId,
        stance: link.relation,
        note: "Known relationship from accepted Canon",
      }));
    return item;
  });

  const session = createSession({
    worldId: seed.worldTitle,
    laws,
    regions: { [areaId]: region },
    entities,
    config: { ...defaultConfig(23), autoJump: false, randomness: 0 },
  });
  const known = new Set(actors.map((actor) => actor.id));
  session.events = seed.history
    .filter((event) => event.participants.some((p) => known.has(p)))
    .map((event, index): SimulationEvent => ({
      id: event.id,
      tick: index,
      time_label: seed.worldTime,
      type: "prior-history",
      participants: [...event.participants],
      region: areaId,
      description: event.description || event.title,
      changes: [],
      random: false,
      source: "engine",
    }));
  session.current_tick = session.events.length + 1;

  // runAllAgents is the unchanged upstream parallel agent scheduler.
  // arbitrate is its unchanged conflict / rule / history arbiter.
  const proposed = await runAllAgents(session, { llm, maxTokens: 1400 });
  const ruling = await arbitrate(
    {
      laws: session.laws,
      config: session.config,
      entities: session.entities,
      lore: session.lore,
      currentTick: session.current_tick,
    },
    proposed.events,
  );

  return {
    engine: "worldforge",
    worldTime: seed.worldTime,
    organizations: actors.map((actor) => actor.id),
    proposals: ruling.accepted.map((event) => ({
      id: event.id,
      participants: event.participants,
      description: event.description,
      major: Boolean(event.major),
      status: "proposed" as const,
    })),
    rejected: ruling.rejected.map(({ event, reason }) => ({
      description: event.description,
      reason,
    })),
  };
}
