import { worldAtlasNarrativePriority } from "@narralume/contracts";
import type { ContextSource } from "@narralume/context";
import type { NarrativeDatabase } from "./database.js";
import {
  SqliteProjectRealityRepository,
  type ProjectRealityView,
  type RealitySlot,
} from "./project-reality-repository.js";

export interface WorldAtlasStoryObjectSurface {
  authority: "confirmed" | "reference";
  sourceId: string;
  facet: string;
  slotKey: string;
  value: unknown;
}

export interface WorldAtlasStoryObject {
  entityId: string;
  name: string;
  kind: string;
  aliases: string[];
  surfaces: WorldAtlasStoryObjectSurface[];
  sourceRefs: string[];
}

export interface WorldAtlasStoryContext {
  current: ContextSource[];
  reference: ContextSource[];
  referenceDetail: ContextSource[];
  objects: WorldAtlasStoryObject[];
  counts: {
    entities: number;
    projectSlots: number;
    referenceSlots: number;
    ambiguousSourceBaselines: number;
  };
}

export type WorldAtlasContextAccess = "author" | "narrative" | "character";

export function worldAtlasSourcesForAccess(
  context: WorldAtlasStoryContext,
  access: WorldAtlasContextAccess,
): ContextSource[] {
  if (access === "character") return [];
  if (access === "narrative") {
    return [...context.current, ...context.reference];
  }
  return [...context.current, ...context.reference, ...context.referenceDetail];
}

export interface WorldAtlasStoryContextRequest {
  projectId: string;
  entityIds: readonly string[];
}

/**
 * Module 3 adapter over Module 2.
 *
 * It never creates a second story database. Project Reality remains the current
 * project truth; Source World cards are reference baselines only. The adapter
 * deliberately splits full source-card prose from the lightweight source
 * identity/relation baseline so chapter-draft does not automatically ingest an
 * entire original-work biography or chronology.
 */
export class WorldAtlasStoryContextBuilder {
  private readonly reality: SqliteProjectRealityRepository;

  constructor(database: NarrativeDatabase) {
    this.reality = new SqliteProjectRealityRepository(database);
  }

  build(request: WorldAtlasStoryContextRequest): WorldAtlasStoryContext {
    const current: ContextSource[] = [];
    const reference: ContextSource[] = [];
    const referenceDetail: ContextSource[] = [];
    const objects: WorldAtlasStoryObject[] = [];
    let projectSlots = 0;
    let referenceSlots = 0;
    let ambiguousSourceBaselines = 0;

    for (const entityId of [...new Set(request.entityIds)]) {
      const view = this.reality.getEntityReality(request.projectId, entityId);
      const project = view.effectiveSlots.filter(
        (slot) => slot.origin === "project",
      );
      const source = view.effectiveSlots.filter(
        (slot) => slot.origin === "reference",
      );
      projectSlots += project.length;
      referenceSlots += source.length;
      if (view.ambiguousSourceBaseline) ambiguousSourceBaselines += 1;

      current.push(projectRealitySource(view, project));

      const sourceIdentityAndRelations = source
        .filter((slot) => !(slot.facet === "lore" && slot.slotKey === "card"))
        .sort(compareNarrativeReferenceSlots);

      const objectSurfaces: WorldAtlasStoryObjectSurface[] = [
        ...project.map((slot) => ({
          authority: "confirmed" as const,
          sourceId: `world-reality:${view.entity.id}`,
          facet: slot.facet,
          slotKey: slot.slotKey,
          value: slot.value,
        })),
        ...sourceIdentityAndRelations.map((slot) => ({
          authority: "reference" as const,
          sourceId: `world-source-baseline:${view.entity.id}`,
          facet: slot.facet,
          slotKey: slot.slotKey,
          value: slot.value,
        })),
      ];
      // Even an entity with no current slot is still a concrete project object.
      // Identity is a usable imagination surface; full source-card prose is
      // intentionally excluded because it may contain mother-world future.
      if (objectSurfaces.length === 0) {
        objectSurfaces.push({
          authority: "confirmed",
          sourceId: `world-reality:${view.entity.id}`,
          facet: "identity",
          slotKey: "entity",
          value: {
            id: view.entity.id,
            name: view.entity.name,
            type: view.entity.type,
          },
        });
      }
      objects.push({
        entityId: view.entity.id,
        name: view.entity.name,
        kind: view.entity.type,
        aliases: [...view.entity.aliases],
        surfaces: objectSurfaces,
        sourceRefs: [...new Set(objectSurfaces.map((surface) => surface.sourceId))],
      });
      if (
        sourceIdentityAndRelations.length > 0 ||
        view.ambiguousSourceBaseline ||
        view.sourceReferences.length > 0
      ) {
        reference.push(sourceBaselineSource(view, sourceIdentityAndRelations));
      }

      const fullCard = source.find(
        (slot) => slot.facet === "lore" && slot.slotKey === "card",
      );
      if (fullCard && !view.ambiguousSourceBaseline) {
        referenceDetail.push(sourceCardDetailSource(view, fullCard));
      }
    }

    return {
      current,
      reference,
      referenceDetail,
      objects,
      counts: {
        entities: new Set(request.entityIds).size,
        projectSlots,
        referenceSlots,
        ambiguousSourceBaselines,
      },
    };
  }
}

function compareNarrativeReferenceSlots(
  left: RealitySlot,
  right: RealitySlot,
): number {
  const leftRank = narrativeReferenceRank(left);
  const rightRank = narrativeReferenceRank(right);
  return (
    leftRank - rightRank ||
    left.facet.localeCompare(right.facet) ||
    left.slotKey.localeCompare(right.slotKey, "zh-CN")
  );
}

function narrativeReferenceRank(slot: RealitySlot): number {
  if (slot.facet === "state" && slot.slotKey === "source_identity") return -1;
  if (slot.facet !== "relationship") return 10_000;
  const value = slot.value as { otherKind?: unknown };
  return typeof value?.otherKind === "string"
    ? worldAtlasNarrativePriority(
        value.otherKind as Parameters<typeof worldAtlasNarrativePriority>[0],
      )
    : 9_999;
}

function projectRealitySource(
  view: ProjectRealityView,
  slots: readonly RealitySlot[],
): ContextSource {
  return {
    id: `world-reality:${view.entity.id}`,
    kind: "canon",
    label: `Project Reality · ${view.entity.name}`,
    content: JSON.stringify(
      {
        entity: {
          id: view.entity.id,
          name: view.entity.name,
          type: view.entity.type,
          aliases: view.entity.aliases,
          description: view.entity.description,
          attributes: view.entity.attributes,
        },
        rule: "这些是当前项目已确认的 Reality。若与 Source World reference 冲突，以这里为准。",
        slots: slots.map(renderSlot),
      },
      null,
      2,
    ),
    authority: "confirmed",
    priority: 98,
    required: true,
    compressible: false,
    sourceType: "project_reality",
    sourceId: view.entity.id,
    metadata: {
      module: "world-atlas",
      axis: "project-reality",
      sourceBaselineCount: view.sourceReferences.length,
    },
  };
}

function sourceBaselineSource(
  view: ProjectRealityView,
  slots: readonly RealitySlot[],
): ContextSource {
  return {
    id: `world-source-baseline:${view.entity.id}`,
    kind: "canon",
    label: `Source Atlas 参考基线 · ${view.entity.name}`,
    content: JSON.stringify(
      {
        warning:
          "这是母体世界 reference，不是项目当前事实，更不是项目未来。Project Reality 冲突时必须忽略这里。",
        ambiguous: view.ambiguousSourceBaseline,
        sourceReferences: view.sourceReferences.map((entry) => ({
          corpusId: entry.link.corpusId,
          sourceKey: entry.link.sourceKey,
          linkKind: entry.link.linkKind,
          name: entry.dossier.record.name,
          kind: entry.dossier.record.kind,
        })),
        slots: slots.map(renderSlot),
      },
      null,
      2,
    ),
    authority: "reference",
    priority: 76,
    required: false,
    compressible: true,
    sourceType: "source_world_atlas",
    sourceId: view.entity.id,
    metadata: {
      module: "world-atlas",
      axis: "source-reference",
      ambiguous: view.ambiguousSourceBaseline,
    },
  };
}

function sourceCardDetailSource(
  view: ProjectRealityView,
  card: RealitySlot,
): ContextSource {
  const value = card.value as { title?: unknown; content?: unknown };
  const content =
    typeof value?.content === "string"
      ? value.content
      : JSON.stringify(card.value, null, 2);
  return {
    id: `world-source-card:${view.entity.id}`,
    kind: "canon",
    label: `Source Atlas 完整卡片（作者参考）· ${view.entity.name}`,
    content: [
      "【边界】母体世界完整卡片只供作者规划、审查与结算参考；不得把原著未来自动写回当前 Project Reality。",
      content,
    ].join("\n\n"),
    authority: "reference",
    priority: 64,
    required: false,
    compressible: true,
    sourceType: "source_world_card",
    sourceId: view.entity.id,
    metadata: {
      module: "world-atlas",
      axis: "source-reference-detail",
      sourceCorpusId: card.sourceCorpusId,
      sourceKey: card.sourceKey,
    },
  };
}

function renderSlot(slot: RealitySlot) {
  return {
    facet: slot.facet,
    slotKey: slot.slotKey,
    value: slot.value,
    origin: slot.origin,
    revisionId: slot.revisionId,
    sourceCorpusId: slot.sourceCorpusId,
    sourceKey: slot.sourceKey,
  };
}
