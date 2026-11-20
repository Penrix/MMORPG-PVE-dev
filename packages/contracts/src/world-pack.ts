import { z } from "zod";

/**
 * Covel-inspired package boundary: a single AI run creates mutually
 * referential world content. Local references are resolved atomically only
 * when the author explicitly adopts the package into NarraLume Canon.
 */
export const WorldPackRequestSchema = z.object({
  requestId: z.string().uuid(),
  intent: z.enum(["create", "advance"]).optional(),
  scale: z.enum(["W0", "W1"]),
  premise: z.string().trim().min(1).max(8_000),
  worldTime: z.string().trim().min(1).max(500),
  focus: z.string().trim().max(2_000),
  genre: z.string().trim().max(2_000),
  scarcity: z.string().trim().max(2_000),
  instruction: z.string().trim().max(8_000),
  parentAreaId: z.string().trim().max(300).nullable(),
  /** Covel WORLD_YAML / WORLD_MD / WORLD_PACKAGE_YAML multi-section authoring source. */
  sourcePackageText: z.string().max(100_000).optional(),
});
export type WorldPackRequest = z.infer<typeof WorldPackRequestSchema>;

export const WorldPackNodeSchema = z
  .object({
    localId: z.string().regex(/^[a-z][a-z0-9_-]{1,79}$/),
    existingCanonId: z.string().trim().min(1).nullable(),
    type: z.enum([
      "character",
      "location",
      "organization",
      "item",
      "rule",
      "concept",
    ]),
    name: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(30_000),
    areaRef: z.string().trim().min(1).nullable(),
    value: z.string().trim().max(5_000),
    access: z.string().trim().max(5_000),
    motive: z.string().trim().max(5_000),
    currentActivity: z.string().trim().max(5_000),
    origin: z.enum([
      "original",
      "inference",
      "historical_claim",
      "source_canon",
    ]),
    sourceNote: z.string().trim().max(3_000),
  })
  .strict();
export type WorldPackNode = z.infer<typeof WorldPackNodeSchema>;

export const WorldPackLinkSchema = z
  .object({
    fromRef: z.string().trim().min(1),
    toRef: z.string().trim().min(1),
    relation: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(5_000),
    status: z.enum(["current", "possible", "ended"]),
  })
  .strict();
export type WorldPackLink = z.infer<typeof WorldPackLinkSchema>;

export const WorldPackActivitySchema = z
  .object({
    localId: z.string().regex(/^[a-z][a-z0-9_-]{1,79}$/),
    actorRefs: z.array(z.string().trim().min(1)).min(1).max(20),
    description: z.string().trim().min(1).max(12_000),
    reason: z.string().trim().min(1).max(5_000),
    resourceRefs: z.array(z.string().trim().min(1)).max(30),
    stage: z.enum(["ongoing", "potential", "ended"]),
    worldTime: z.string().trim().min(1).max(500),
  })
  .strict();
export type WorldPackActivity = z.infer<typeof WorldPackActivitySchema>;

/** Actual MMORPG interactions. These are playable rules, not a list of
 * proposed plot beats. No cost is invented by the engine: the authoring
 * workshop must state real prerequisites and concrete possible results. */
export const WorldActionTermSchema = z.object({
  kind: z.enum(["asset", "permission", "relationship", "knowledge", "ability", "access"]),
  ref: z.string().trim().min(1),
}).strict();

export const WorldActionSchema = z.object({
  localId: z.string().regex(/^[a-z][a-z0-9_-]{1,79}$/),
  name: z.string().trim().min(1).max(300),
  offeredByRef: z.string().trim().min(1),
  locationRef: z.string().trim().min(1).nullable(),
  action: z.string().trim().min(1).max(5000),
  requires: z.array(WorldActionTermSchema).max(20),
  yields: z.array(WorldActionTermSchema).min(1).max(20),
  state: z.enum(["available", "potential"]),
}).strict();
export type WorldAction = z.infer<typeof WorldActionSchema>;

export const WorldPackDocumentSchema = z
  .object({
    summary: z.string().trim().min(1).max(16_000),
    nodes: z.array(WorldPackNodeSchema).min(1).max(80),
    links: z.array(WorldPackLinkSchema).max(180),
    activities: z.array(WorldPackActivitySchema).max(80),
    openThreads: z.array(z.string().trim().min(1).max(3_000)).max(70),
    interactions: z.array(WorldActionSchema).max(90).optional(),
    /** Explicit observed emergent dimensions; WorldForge registry evaluates promotion. */
    dimensionSignals: z
      .array(
        z
          .object({
            dim: z.string().trim().min(1).max(100),
            kind: z.enum(["tech", "value"]),
            frequency: z.number().min(0).max(1),
            consequence: z.number().min(0).max(1),
            lawConsistency: z.number().min(0).max(1),
            potential: z.number().min(0).max(100),
            description: z.string().max(300).optional(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict();
export type WorldPackDocument = z.infer<typeof WorldPackDocumentSchema>;

export const WorldPackRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  runId: z.string(),
  status: z.enum(["draft", "adopted"]),
  version: z.number().int().positive(),
  request: WorldPackRequestSchema,
  document: WorldPackDocumentSchema,
  canonIds: z.record(z.string(), z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorldPackRecord = z.infer<typeof WorldPackRecordSchema>;

export const UpdateWorldPackRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  document: WorldPackDocumentSchema,
});
export const AdoptWorldPackRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

/**
 * WorldForge-style graph references: local IDs or `canon:<existing-id>`.
 * Models cannot invent database IDs; references must resolve before adoption.
 */
export function worldPackReferenceProblems(
  document: WorldPackDocument,
  knownCanonIds: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const nodes = new Map<string, WorldPackNode>();
  const names = new Set<string>();
  for (const node of document.nodes) {
    if (nodes.has(node.localId))
      problems.push(`duplicate local node: ${node.localId}`);
    nodes.set(node.localId, node);
    const nameKey = `${node.type}:${node.name.toLocaleLowerCase()}`;
    if (names.has(nameKey))
      problems.push(`duplicate Canon name in package: ${node.name}`);
    names.add(nameKey);
    if (node.existingCanonId && !knownCanonIds.has(node.existingCanonId))
      problems.push(`unknown existing Canon entity: ${node.existingCanonId}`);
  }
  const resolve = (ref: string) => {
    if (ref.startsWith("canon:")) {
      if (!knownCanonIds.has(ref.slice(6)))
        problems.push(`unknown Canon ref: ${ref}`);
    } else if (!nodes.has(ref)) {
      problems.push(`unresolved world ref: ${ref}`);
    }
  };
  for (const node of document.nodes) {
    if (node.areaRef) {
      resolve(node.areaRef);
      const local = nodes.get(node.areaRef);
      if (local && local.type !== "location")
        problems.push(`non-location area: ${node.localId} -> ${node.areaRef}`);
    }
    if (node.areaRef === node.localId)
      problems.push(`self-referential area: ${node.localId}`);
    const visited = new Set([node.localId]);
    let ancestor = node.areaRef;
    while (ancestor && nodes.has(ancestor)) {
      if (visited.has(ancestor)) {
        problems.push(`cyclic area ancestry: ${node.localId}`);
        break;
      }
      visited.add(ancestor);
      ancestor = nodes.get(ancestor)?.areaRef ?? null;
    }
  }
  const seenCurrentLinks = new Set<string>();
  for (const link of document.links) {
    resolve(link.fromRef);
    resolve(link.toRef);
    if (link.fromRef === link.toRef)
      problems.push(`self-link: ${link.fromRef}`);
    const key = `${link.fromRef}|${link.relation}|${link.toRef}`;
    if (seenCurrentLinks.has(key))
      problems.push(`duplicate relationship action: ${key}`);
    seenCurrentLinks.add(key);
  }
  const activities = new Set<string>();
  for (const event of document.activities) {
    if (activities.has(event.localId))
      problems.push(`duplicate activity: ${event.localId}`);
    activities.add(event.localId);
    for (const ref of [...event.actorRefs, ...event.resourceRefs]) resolve(ref);
  }
  const actions = new Set<string>();
  for (const action of document.interactions ?? []) {
    if (actions.has(action.localId))
      problems.push("duplicate world action: " + action.localId);
    actions.add(action.localId);
    resolve(action.offeredByRef);
    if (action.locationRef) {
      resolve(action.locationRef);
      const at = nodes.get(action.locationRef);
      if (at && at.type !== "location")
        problems.push("non-location action: " + action.localId);
    }
    for (const term of [...action.requires, ...action.yields]) resolve(term.ref);
  }
  return [...new Set(problems)];
}
