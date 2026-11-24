import {
  worldPackAtlasKind,
  worldPackReferenceProblems,
  type SourceWorldProductionDraft,
  type WorldPackDocument,
  type WorldPackNode,
} from "@narralume/contracts";
import {
  SqliteSourceWorldProductionRepository,
  SqliteUnifiedSourceWorldRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";

export function adoptSourceWorldProduction(
  database: NarrativeDatabase,
  worldId: string,
  draftId: string,
  expectedVersion: number,
  now = new Date().toISOString(),
): SourceWorldProductionDraft {
  const worlds = new SqliteUnifiedSourceWorldRepository(database);
  const drafts = new SqliteSourceWorldProductionRepository(database);
  const draft = drafts.get(worldId, draftId);
  if (!draft)
    throw serviceError(
      "source.world.production.not_found",
      "Source World production draft not found",
      404,
    );
  const world = worlds.getWorld(worldId);
  if (!world)
    throw serviceError("source.world.not_found", "Source World not found", 404);

  return database.transaction(() => {
    const knownSourceKeys = new Set(worlds.listCardKeys(worldId));
    const problems = worldPackReferenceProblems(
      draft.document,
      new Set<string>(),
      knownSourceKeys,
    );
    if (problems.length)
      throw serviceError(
        "source.world.production.bad_references",
        problems.join("; "),
        422,
      );

    const nodeByLocal = new Map(
      draft.document.nodes.map((node) => [node.localId, node]),
    );
    const adoptedKeys: Record<string, string> = {};
    const reserved = new Set(knownSourceKeys);

    for (const node of draft.document.nodes) {
      if (node.existingCanonId)
        throw serviceError(
          "source.world.production.project_authority_leak",
          `Source World candidate ${node.name} points at Project Canon`,
          422,
        );
      if (node.origin === "source_canon" && !node.existingSourceKey)
        throw serviceError(
          "source.world.production.fabricated_canon",
          `New candidate ${node.name} cannot claim source_canon`,
          422,
        );
      const key = node.existingSourceKey ?? sourceKeyFor(node);
      if (!node.existingSourceKey && reserved.has(key))
        throw serviceError(
          "source.world.production.key_collision",
          `Source key already exists: ${key}`,
          409,
        );
      if (node.existingSourceKey && !knownSourceKeys.has(key))
        throw serviceError(
          "source.world.production.source_missing",
          `Existing Source card not found: ${key}`,
          422,
        );
      reserved.add(key);
      adoptedKeys[node.localId] = key;
    }

    const resolve = (ref: string): string => {
      if (ref.startsWith("canon:"))
        throw serviceError(
          "source.world.production.project_authority_leak",
          `Project Canon ref cannot enter Source World: ${ref}`,
          422,
        );
      if (ref.startsWith("source:")) {
        const key = ref.slice(7);
        if (!knownSourceKeys.has(key) && !reserved.has(key))
          throw serviceError(
            "source.world.production.source_missing",
            `Unknown Source ref: ${ref}`,
            422,
          );
        return key;
      }
      const key = adoptedKeys[ref];
      if (!key)
        throw serviceError(
          "source.world.production.unresolved_ref",
          `Unresolved local ref: ${ref}`,
          422,
        );
      return key;
    };

    const outgoing = new Map<
      string,
      Array<{ relation: string; targetKey: string }>
    >();
    for (const link of draft.document.links) {
      if (link.status !== "current") continue;
      const fromKey = resolve(link.fromRef);
      const targetKey = resolve(link.toRef);
      const list = outgoing.get(fromKey) ?? [];
      list.push({ relation: link.relation, targetKey });
      outgoing.set(fromKey, list);
    }

    // Phase 1: create/update every candidate node without cross-node typed
    // links. This guarantees all new target identities exist before reindexing.
    for (const node of draft.document.nodes) {
      const key = adoptedKeys[node.localId]!;
      const existing = worlds.getCard(worldId, key);
      const expansion = renderAdoptedExpansion({
        draftId,
        node,
        relations: [],
        resolveName: (targetKey) =>
          worlds.getCard(worldId, targetKey)?.record.name ?? targetKey,
      });
      worlds.upsertCard({
        worldId,
        entityKey: key,
        kind: worldPackAtlasKind(node),
        name: node.name,
        aliases: existing?.record.aliases ?? [],
        content: existing
          ? appendManagedExpansion(existing.content, expansion)
          : `# ${node.name}\n\n${expansion}`,
        now,
      });
      if (node.readerSemantics)
        worlds.upsertReaderSemantics({
          worldId,
          entityKey: key,
          semantics: node.readerSemantics,
          now,
        });
    }

    // Phase 2: now that every new target exists, append relation truth and let
    // upsertCard rebuild source_relations from the complete Markdown graph.
    for (const [fromKey, relations] of outgoing) {
      const existing = worlds.getCard(worldId, fromKey);
      if (!existing)
        throw serviceError(
          "source.world.production.source_missing",
          `Relation source card not found after node adoption: ${fromKey}`,
          422,
        );
      const expansion = renderAdoptedExpansion({
        draftId,
        node: undefined,
        relations,
        resolveName: (targetKey) =>
          worlds.getCard(worldId, targetKey)?.record.name ?? targetKey,
      });
      worlds.upsertCard({
        worldId,
        entityKey: fromKey,
        kind: existing.record.kind,
        name: existing.record.name,
        aliases: existing.record.aliases,
        content: appendManagedExpansion(existing.content, expansion),
        now,
      });
    }

    for (const activity of draft.document.activities) {
      if (activity.stage === "potential") continue;
      const key = `activity:${activity.localId}`;
      if (reserved.has(key))
        throw serviceError(
          "source.world.production.key_collision",
          `Source activity key already exists: ${key}`,
          409,
        );
      reserved.add(key);
      adoptedKeys["activity:" + activity.localId] = key;
      const actorLines = activity.actorRefs.map(
        (ref) => `参与者：${wikiRef(resolve(ref), nameForRef(ref, nodeByLocal, adoptedKeys, worlds, worldId))}`,
      );
      const resourceLines = activity.resourceRefs.map(
        (ref) => `涉及：${wikiRef(resolve(ref), nameForRef(ref, nodeByLocal, adoptedKeys, worlds, worldId))}`,
      );
      worlds.upsertCard({
        worldId,
        entityKey: key,
        kind: "activity",
        name: activity.description.slice(0, 100),
        content: [
          `# ${activity.description.slice(0, 100)}`,
          "",
          activity.description,
          "",
          `阶段：${activity.stage}`,
          `世界时间：${activity.worldTime}`,
          `原因：${activity.reason}`,
          ...actorLines,
          ...resourceLines,
          "",
          `来源：World Builder adopted draft ${draftId}`,
        ].join("\n"),
        now,
      });
    }

    for (const action of draft.document.interactions ?? []) {
      const operatorKey = resolve(action.offeredByRef);
      const operator = worlds.getCard(worldId, operatorKey);
      if (!operator) continue;
      const lines = [
        `### 可玩入口｜${action.name}`,
        action.action,
        action.locationRef
          ? `地点：${wikiRef(resolve(action.locationRef), nameForRef(action.locationRef, nodeByLocal, adoptedKeys, worlds, worldId))}`
          : "",
        action.requires.length
          ? "需要：" +
            action.requires
              .map((term) =>
                wikiRef(
                  resolve(term.ref),
                  nameForRef(term.ref, nodeByLocal, adoptedKeys, worlds, worldId),
                ),
              )
              .join("、")
          : "",
        "可能取得：" +
          action.yields
            .map((term) =>
              wikiRef(
                resolve(term.ref),
                nameForRef(term.ref, nodeByLocal, adoptedKeys, worlds, worldId),
              ),
            )
            .join("、"),
      ].filter(Boolean);
      worlds.upsertCard({
        worldId,
        entityKey: operatorKey,
        kind: operator.record.kind,
        name: operator.record.name,
        aliases: operator.record.aliases,
        content: appendManagedExpansion(
          operator.content,
          [
            `<!-- world-builder-action:${draftId}:${action.localId} -->`,
            ...lines,
          ].join("\n"),
        ),
        now,
      });
    }

    return drafts.markAdopted(
      worldId,
      draftId,
      expectedVersion,
      adoptedKeys,
      now,
    );
  });
}

function sourceKeyFor(node: WorldPackNode): string {
  return `${worldPackAtlasKind(node)}:${node.localId}`;
}

function renderAdoptedExpansion(input: {
  draftId: string;
  node: WorldPackNode | undefined;
  relations: Array<{ relation: string; targetKey: string }>;
  resolveName: (targetKey: string) => string;
}): string {
  const node = input.node;
  const lines = [
    `<!-- world-builder:${input.draftId} -->`,
    "## World Builder 采纳扩展",
  ];
  if (node) {
    lines.push(
      node.description,
      "",
      `来源身份：${node.origin}`,
      node.sourceNote ? `来源说明：${node.sourceNote}` : "",
      node.value ? `世界内部价值：${node.value}` : "",
      node.access ? `准入/取得：${node.access}` : "",
      node.motive ? `自身目标/作用：${node.motive}` : "",
      node.currentActivity ? `当前事务：${node.currentActivity}` : "",
    );
  }
  for (const relation of input.relations)
    lines.push(
      `${relation.relation}：${wikiRef(
        relation.targetKey,
        input.resolveName(relation.targetKey),
      )}`,
    );
  return lines.filter(Boolean).join("\n");
}

function appendManagedExpansion(content: string, expansion: string): string {
  if (content.includes(expansion)) return content;
  return content.trimEnd() + "\n\n" + expansion + "\n";
}

function wikiRef(key: string, name: string): string {
  return `[[${key}|${name}]]`;
}

function nameForRef(
  ref: string,
  nodeByLocal: Map<string, WorldPackNode>,
  adoptedKeys: Record<string, string>,
  worlds: SqliteUnifiedSourceWorldRepository,
  worldId: string,
): string {
  if (ref.startsWith("source:")) {
    const key = ref.slice(7);
    return worlds.getCard(worldId, key)?.record.name ?? key;
  }
  const node = nodeByLocal.get(ref);
  if (node) return node.name;
  const key = adoptedKeys[ref];
  return key ? worlds.getCard(worldId, key)?.record.name ?? key : ref;
}

function serviceError(
  code: string,
  message: string,
  statusCode: number,
): Error {
  return Object.assign(new Error(message), { code, statusCode });
}

export function validateSourceWorldProductionDocument(
  document: WorldPackDocument,
  knownSourceKeys: ReadonlySet<string>,
): string[] {
  return worldPackReferenceProblems(
    document,
    new Set<string>(),
    knownSourceKeys,
  );
}
