import type {
  CreativeMaterialSelection,
  CreativeMaterialUseScope,
  StoryCreativeContext,
  StoryObjectField,
} from "@narralume/contracts";
import type {
  RetrievalHit,
  SqliteRetrievalRepository,
} from "@narralume/persistence";

export interface CreativeMaterialRecallRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  scope: CreativeMaterialUseScope;
  purpose: string;
  query?: string;
  focusObjectIds?: readonly string[];
  libraries?: readonly string[];
  includeCandidate?: boolean;
  limit?: number;
}

function metadataString(hit: RetrievalHit, key: string): string | null {
  const value = hit.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataStrings(hit: RetrievalHit, key: string): string[] {
  const value = hit.metadata[key];
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
}

function materialAllowed(
  hit: RetrievalHit,
  libraries: ReadonlySet<string>,
  includeCandidate: boolean,
): boolean {
  const libraryId = metadataString(hit, "libraryId");
  const status = metadataString(hit, "status");
  if (!libraryId || !status) return false;
  if (libraries.size > 0 && !libraries.has(libraryId)) return false;
  return status === "active" || (includeCandidate && status === "candidate");
}

/**
 * Module-2 creative-material recall.
 *
 * World objects and creative materials are two queryable object spaces:
 * - StoryObjectField supplies objects that exist in the current story world.
 * - Creative material libraries supply reusable imagination objects.
 *
 * Retrieval never turns a material card into Reality or an M algorithm.
 * Module 3 may select a material to think with against concrete world objects.
 */
export class CreativeMaterialRetrievalService {
  constructor(private readonly retrieval: SqliteRetrievalRepository) {}

  recall(request: CreativeMaterialRecallRequest): CreativeMaterialSelection[] {
    const { field, creativeContext } = request;
    if (
      field.projectId !== creativeContext.projectId ||
      field.projectId !== creativeContext.protagonistCamera.projectId
    ) {
      throw new Error("creative_material.project_mismatch");
    }

    const allowedObjects = new Map(
      field.objects.map((object) => [object.id, object]),
    );
    const focusObjectIds = [
      ...new Set(
        request.focusObjectIds ??
          creativeContext.protagonistCamera.focusObjectIds,
      ),
    ];
    if (focusObjectIds.length === 0) {
      throw new Error("creative_material.empty_object_focus");
    }
    for (const objectId of focusObjectIds) {
      if (!allowedObjects.has(objectId)) {
        throw new Error(`creative_material.unknown_object:${objectId}`);
      }
    }

    const limit = Math.max(1, Math.min(request.limit ?? 8, 24));
    const libraries = new Set(
      (request.libraries ?? []).map((value) => value.trim()).filter(Boolean),
    );
    const frame = creativeContext.frame;
    const camera = creativeContext.protagonistCamera;
    const objects = focusObjectIds
      .map((id) => allowedObjects.get(id)!)
      .map((object) => `${object.name}（${object.kind}）`)
      .join("；");
    const query = [
      request.query?.trim(),
      request.purpose.trim(),
      `男主当前目标：${camera.currentGoal}`,
      `当前升级需要：${camera.upgradeNeed}`,
      `男主准备行动：${camera.activeMove}`,
      `当前区段：${frame.currentFrame.title}`,
      frame.currentFrame.goal ? `区段目标：${frame.currentFrame.goal}` : null,
      frame.currentFrame.conflict
        ? `区段问题：${frame.currentFrame.conflict}`
        : null,
      frame.inheritedState.unresolvedQuestions.length
        ? `未解问题：${frame.inheritedState.unresolvedQuestions.join("；")}`
        : null,
      `当前世界对象：${objects}`,
      libraries.size ? `素材库：${[...libraries].join(" ")}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n");

    const hits = this.retrieval.search(field.projectId, query, {
      limit: Math.min(100, Math.max(limit * 8, 40)),
      rerank: true,
      sourceTypes: ["creative_material"],
    });

    return hits
      .filter((hit) =>
        materialAllowed(hit, libraries, request.includeCandidate ?? false),
      )
      .slice(0, limit)
      .map((hit, index) => {
        const libraryId = metadataString(hit, "libraryId")!;
        const materialId = metadataString(hit, "materialId") ?? hit.sourceId;
        const materialType = metadataString(hit, "materialType") ?? "unknown";
        const status = metadataString(hit, "status");
        if (
          status !== "active" &&
          status !== "candidate" &&
          status !== "merged" &&
          status !== "retired"
        ) {
          throw new Error(
            `creative_material.invalid_status:${libraryId}:${materialId}`,
          );
        }
        return {
          id: `material-selection:${libraryId}:${materialId}:${index + 1}`,
          libraryId,
          materialId,
          materialType,
          status,
          title: hit.title,
          summary: metadataString(hit, "summary") ?? hit.title,
          sourceRef: metadataString(hit, "sourcePath"),
          scope: request.scope,
          purpose: request.purpose,
          inputObjectIds: focusObjectIds,
          callWhen: metadataStrings(hit, "callWhen"),
          tags: metadataStrings(hit, "tags"),
          curationStage: metadataString(hit, "curationStage"),
          content: hit.content,
        };
      });
  }
}
