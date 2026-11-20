import type {
  CanonEntity,
  CanonFact,
  RelationshipEvent,
} from "@narralume/domain";

/** WorldForge-style bounded graph neighborhood for W1 world production.
 * Canon remains the source of truth; these are only retrieved IDs.
 * A social connection is as useful as a geographic one when exploring a map.
 */
export function selectWorldContextIds(input: {
  entities: readonly CanonEntity[];
  facts: readonly CanonFact[];
  relationships: readonly RelationshipEvent[];
  parentAreaId: string | null;
  focus: string;
  premise: string;
  maxCount: number;
}): string[] {
  const byId = new Map(input.entities.map((entity) => [entity.id, entity]));
  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (!byId.has(a) || !byId.has(b) || a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };
  for (const relation of input.relationships) {
    if (relation.state.lifecycle === "voided") continue;
    connect(relation.fromEntityId, relation.toEntityId);
  }
  for (const fact of input.facts) {
    if (fact.objectEntityId) connect(fact.subjectId, fact.objectEntityId);
  }

  const focus = `${input.focus} ${input.premise}`.toLocaleLowerCase();
  const seeds = new Set<string>();
  if (input.parentAreaId && byId.has(input.parentAreaId)) seeds.add(input.parentAreaId);
  for (const entity of input.entities) {
    if (entity.name.length > 1 && focus.includes(entity.name.toLocaleLowerCase()))
      seeds.add(entity.id);
  }

  const distances = new Map<string, number>();
  let frontier = [...seeds];
  for (const id of seeds) distances.set(id, 0);
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, depth + 1);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  const score = (entity: CanonEntity) => {
    const distance = distances.get(entity.id);
    const relationshipScore = distance === undefined ? 0 : [100, 75, 50, 20][distance] ?? 0;
    const matched = focus.includes(entity.name.toLocaleLowerCase()) ? 80 : 0;
    const hasContent = typeof entity.description === "string" && entity.description.length > 30 ? 3 : 0;
    return relationshipScore + matched + hasContent;
  };
  return [...input.entities]
    .sort((a, b) =>
      score(b) - score(a) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(1, input.maxCount))
    .map((entity) => entity.id);
}
