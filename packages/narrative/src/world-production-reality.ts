import type {
  CanonEntity,
  CanonFact,
  RelationshipEvent,
} from "@narralume/domain";
import type {
  WorldPackDocument,
  WorldPackNode,
  WorldPackActivity,
  WorldAction,
} from "@narralume/contracts";

/**
 * The *read-only* existing game world, projected from adopted Canon Reality.
 * References in this inspection graph use canon:<stable ID>, not invented
 * names or copied local IDs. Nothing from this graph is staged for re-adoption.
 */
export function projectExistingWorldForProduction(input: {
  entities: readonly CanonEntity[];
  facts: readonly CanonFact[];
  relationships: readonly RelationshipEvent[];
}): WorldPackDocument {
  const byId = new Map(input.entities.map((e) => [e.id, e]));
  const inScope = new Set(byId.keys());
  const latest = (id: string, predicate: string) =>
    input.facts.find((f) => f.subjectId === id && f.predicate === predicate);
  const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const stringValue = (value: unknown): string =>
    typeof value === "string" ? value : "";
  const ref = (id: string) => "canon:" + id;
  const nodes: WorldPackNode[] = input.entities.map((e) => {
    const content = record(latest(e.id, "world.content")?.value);
    const attrs = e.attributes;
    const area = latest(e.id, "world.area")?.objectEntityId;
    return {
      localId: ref(e.id),
      existingCanonId: e.id,
      type: e.type,
      name: e.name,
      description:
        e.description ??
        (stringValue(content.approvedDescription) || "已确认的世界对象"),
      areaRef: area && inScope.has(area) ? ref(area) : null,
      value: stringValue(content.value) || stringValue(attrs.worldValue),
      access: stringValue(content.access) || stringValue(attrs.worldAccess),
      motive: stringValue(content.motive) || stringValue(attrs.worldMotive),
      currentActivity:
        stringValue(content.currentActivity) ||
        stringValue(attrs.currentActivity),
      origin: "source_canon",
      sourceNote: "已确认的Canon世界事实",
    };
  });
  const links: WorldPackDocument["links"] = [];
  const seen = new Set<string>();
  const add = (
    fromRef: string,
    toRef: string,
    relation: string,
    description: string,
  ) => {
    const key = fromRef + "|" + relation + "|" + toRef;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ fromRef, toRef, relation, description, status: "current" });
  };
  for (const event of input.relationships) {
    if (
      !inScope.has(event.fromEntityId) ||
      !inScope.has(event.toEntityId) ||
      event.state.lifecycle === "voided"
    )
      continue;
    add(
      ref(event.fromEntityId),
      ref(event.toEntityId),
      event.relation,
      stringValue(event.state.description) || "已确认的世界关系",
    );
  }
  for (const f of input.facts) {
    if (
      f.predicate !== "world.area" ||
      !f.objectEntityId ||
      !inScope.has(f.subjectId) ||
      !inScope.has(f.objectEntityId)
    )
      continue;
    add(
      ref(f.subjectId),
      ref(f.objectEntityId),
      "located_in",
      "已确认的区域位置",
    );
  }
  const activities: WorldPackActivity[] = [];
  const interactions: WorldAction[] = [];
  for (const fact of input.facts) {
    if (!inScope.has(fact.subjectId)) continue;
    const v = record(fact.value);
    if (fact.predicate === "world.ongoing_activity") {
      const id = stringValue(v.activityLocalId);
      if (!id || v.stage === "ended") continue;
      const resourceIds = Array.isArray(v.resourceIds)
        ? v.resourceIds.filter(
            (value): value is string =>
              typeof value === "string" && inScope.has(value),
          )
        : [];
      activities.push({
        localId: id,
        actorRefs: [ref(fact.subjectId)],
        resourceRefs: resourceIds.map(ref),
        description: stringValue(v.description) || "已确认的正在进行的事务",
        reason: stringValue(v.reason),
        stage: v.stage === "potential" ? "potential" : "ongoing",
        worldTime: stringValue(v.worldTime) || "当前世界时间",
      });
    }
    if (fact.predicate === "world.affordance") {
      const id = stringValue(v.localId),
        name = stringValue(v.name);
      if (!id || !name) continue;
      const convert = (value: unknown) => {
        if (!Array.isArray(value)) return [];
        return value
          .map(record)
          .filter(
            (t) =>
              typeof t.kind === "string" &&
              typeof t.ref === "string" &&
              inScope.has(t.ref),
          )
          .map((t) => ({
            kind: t.kind as WorldAction["requires"][number]["kind"],
            ref: ref(t.ref as string),
          }));
      };
      const locationId = stringValue(v.locationId);
      interactions.push({
        localId: id,
        name,
        offeredByRef: ref(fact.subjectId),
        locationRef: inScope.has(locationId) ? ref(locationId) : null,
        action: stringValue(v.action) || name,
        requires: convert(v.requires),
        yields: convert(v.yields),
        state: v.state === "potential" ? "potential" : "available",
      });
    }
  }
  return {
    summary:
      "Canonical world Reality; read-only reference for new workshop production",
    nodes,
    links,
    activities,
    interactions,
    openThreads: [],
    dimensionSignals: [],
  };
}

/** Only inspect this combined view. New-world delta is stored separately;
 * the existing Canon objects are not rewritten as generated objects.
 */
export function previewProductionReality(
  existing: WorldPackDocument,
  delta: WorldPackDocument,
): WorldPackDocument {
  const combine = <T>(
    old: readonly T[],
    fresh: readonly T[],
    key: (v: T) => string,
  ): T[] => {
    const map = new Map(old.map((item) => [key(item), item]));
    for (const item of fresh) map.set(key(item), item);
    return [...map.values()];
  };
  return {
    summary: delta.summary,
    nodes: combine(existing.nodes, delta.nodes, (n) => n.localId),
    links: combine(
      existing.links,
      delta.links,
      (l) => l.fromRef + "|" + l.relation + "|" + l.toRef,
    ),
    activities: combine(
      existing.activities,
      delta.activities,
      (a) => a.localId,
    ),
    interactions: combine(
      existing.interactions ?? [],
      delta.interactions ?? [],
      (a) => a.localId,
    ),
    openThreads: [...new Set([...existing.openThreads, ...delta.openThreads])],
    dimensionSignals: [
      ...(existing.dimensionSignals ?? []),
      ...(delta.dimensionSignals ?? []),
    ],
  };
}
