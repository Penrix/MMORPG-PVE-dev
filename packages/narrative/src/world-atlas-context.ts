import type { ContextSource } from "@narralume/context";
import { worldAtlasNarrativePriority } from "@narralume/contracts";
import {
  SqliteProjectRealityRepository,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
  type NarrativeDatabase,
  type ProjectRealityView,
  type SourceWorldCard,
} from "@narralume/persistence";

export interface WorldAtlasNarrativeContextRequest {
  projectId: string;
  focalEntityIds: readonly string[];
  query: string;
  sourceLimit?: number;
}

/**
 * Third-module read adapter.
 *
 * Source World cards stay reference material; Project Reality is confirmed
 * current-world context. This builder never promotes source facts into the
 * project's future and never writes anything.
 */
export class WorldAtlasNarrativeContextBuilder {
  private readonly reality: SqliteProjectRealityRepository;
  private readonly sources: SqliteSourceCorpusRepository;
  private readonly atlas: SqliteUnifiedSourceWorldRepository;

  constructor(private readonly database: NarrativeDatabase) {
    this.reality = new SqliteProjectRealityRepository(database);
    this.sources = new SqliteSourceCorpusRepository(database);
    this.atlas = new SqliteUnifiedSourceWorldRepository(database);
  }

  buildAuthorSources(request: WorldAtlasNarrativeContextRequest): ContextSource[] {
    const out: ContextSource[] = [];
    const seenSourceCards = new Set<string>();

    for (const entityId of [...new Set(request.focalEntityIds)]) {
      let view: ProjectRealityView;
      try {
        view = this.reality.getEntityReality(request.projectId, entityId);
      } catch {
        continue;
      }

      const projectSlots = view.effectiveSlots.filter(
        (entry) => entry.origin === "project",
      );
      if (
        projectSlots.length > 0 ||
        view.currentProjectDossier?.worldAffiliations.length ||
        view.currentProjectDossier?.travelHistory.length
      ) {
        out.push(projectRealitySource(view, projectSlots));
      }

      for (const reference of view.sourceAtlasReferences) {
        const key = cardKey(reference.card);
        if (seenSourceCards.has(key)) continue;
        seenSourceCards.add(key);
        out.push(sourceCardContext(reference.card, true));
      }
    }

    const query = request.query.trim();
    if (query) {
      const limit = Math.min(Math.max(request.sourceLimit ?? 8, 1), 20);
      const hits = this.sources
        .search(query, {
          projectId: request.projectId,
          limit: Math.max(limit * 4, 20),
        })
        .map((hit, index) => ({ hit, index }))
        .sort(
          (left, right) =>
            worldAtlasNarrativePriority(left.hit.kind) -
              worldAtlasNarrativePriority(right.hit.kind) ||
            left.index - right.index,
        );

      let added = 0;
      for (const { hit } of hits) {
        if (added >= limit) break;
        const card = this.atlas.getCardByCorpus(hit.corpusId, hit.sourceKey);
        if (!card) continue;
        const key = cardKey(card);
        if (seenSourceCards.has(key)) continue;
        seenSourceCards.add(key);
        out.push(sourceCardContext(card, false));
        added += 1;
      }
    }

    return out;
  }
}

function cardKey(card: SourceWorldCard): string {
  return JSON.stringify([card.record.corpusId, card.record.sourceKey]);
}

function projectRealitySource(
  view: ProjectRealityView,
  projectSlots: ProjectRealityView["effectiveSlots"],
): ContextSource {
  const dossier = view.currentProjectDossier;
  const body = {
    entity: {
      id: view.entity.id,
      name: view.entity.name,
      type: view.entity.type,
      attributes: view.entity.attributes,
    },
    projectReality: projectSlots.map((entry) => ({
      facet: entry.facet,
      slotKey: entry.slotKey,
      value: entry.value,
      revisionId: entry.revisionId,
    })),
    worldAffiliations: dossier?.worldAffiliations ?? [],
    travelHistory: (dossier?.travelHistory ?? []).slice(-12),
  };
  return {
    id: `project-reality:${view.entity.id}`,
    kind: "canon",
    label: `Project Reality · ${view.entity.name}`,
    content: JSON.stringify(body),
    summary: JSON.stringify({
      entity: body.entity,
      projectReality: body.projectReality.slice(0, 12),
    }),
    authority: "confirmed",
    priority: 96,
    required: true,
    compressible: true,
    sourceType: "project_reality",
    sourceId: view.entity.id,
    metadata: {
      worldAtlas: true,
      layer: "project",
      sourceAtlasReferences: view.sourceAtlasReferences.length,
      ambiguousSourceBaseline: view.ambiguousSourceBaseline,
    },
  };
}

function sourceCardContext(
  card: SourceWorldCard,
  focal: boolean,
): ContextSource {
  const relations = [...card.relations]
    .sort(
      (left, right) =>
        worldAtlasNarrativePriority(left.otherKind) -
          worldAtlasNarrativePriority(right.otherKind) ||
        left.otherName.localeCompare(right.otherName, "zh-CN"),
    )
    .map(
      (relation) =>
        `- ${relation.displayRelation} → ${relation.otherName} [${relation.otherKind}]`,
    );
  const content = [
    `# ${card.record.name}`,
    `类型：${card.record.kind}`,
    card.content,
    ...(relations.length ? ["## Typed Relations", ...relations] : []),
  ].join("\n");
  const summary = [
    `${card.record.name} [${card.record.kind}]`,
    card.record.summary,
    ...relations.slice(0, 8),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `source-atlas:${card.record.corpusId}:${card.record.sourceKey}`,
    kind: "retrieval",
    label: focal
      ? `Source World Atlas · ${card.record.name}（项目母体参考）`
      : `World Atlas 检索 · ${card.record.name}`,
    content,
    summary,
    authority: "reference",
    priority: focal ? 93 : 78,
    required: focal,
    compressible: true,
    sourceType: "source_world_atlas",
    sourceId: card.record.sourceKey,
    metadata: {
      worldAtlas: true,
      layer: "source",
      corpusId: card.record.corpusId,
      cardKind: card.record.kind,
      peopleCenteredPriority: worldAtlasNarrativePriority(card.record.kind),
    },
  };
}
