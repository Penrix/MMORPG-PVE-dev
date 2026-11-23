import type {
  CreativeMethodInvocation,
  CreativeMethodScope,
  StoryCreativeContext,
  StoryObjectField,
} from "@narralume/contracts";
import type {
  RetrievalHit,
  SqliteRetrievalRepository,
} from "@narralume/persistence";

export interface CreativeMethodRecallRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  scope: CreativeMethodScope;
  purpose: string;
  query?: string;
  focusObjectIds?: readonly string[];
  methodFamilies?: readonly string[];
  includeCandidate?: boolean;
  limit?: number;
}

function metadataString(hit: RetrievalHit, key: string): string | null {
  const value = hit.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function methodAllowed(
  hit: RetrievalHit,
  families: ReadonlySet<string>,
  includeCandidate: boolean,
): boolean {
  const family = metadataString(hit, "methodFamily");
  const status = metadataString(hit, "status");
  if (!family || !status) return false;
  if (families.size > 0 && !families.has(family)) return false;
  return status === "active" || (includeCandidate && status === "candidate");
}

/**
 * Cross-cutting M-method recall.
 *
 * The method library is external creative cognition, not Project Reality.
 * Retrieval only proposes methods that may operate on the current Object Field.
 * Adoption into Story / World / Scene remains an author-side speculative step.
 */
export class CreativeMethodRetrievalService {
  constructor(private readonly retrieval: SqliteRetrievalRepository) {}

  recall(request: CreativeMethodRecallRequest): CreativeMethodInvocation[] {
    const { field, creativeContext } = request;
    if (
      field.projectId !== creativeContext.projectId ||
      field.projectId !== creativeContext.protagonistCamera.projectId
    ) {
      throw new Error("creative_method.project_mismatch");
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
      throw new Error("creative_method.empty_object_focus");
    }
    for (const objectId of focusObjectIds) {
      if (!allowedObjects.has(objectId)) {
        throw new Error(`creative_method.unknown_object:${objectId}`);
      }
    }

    const limit = Math.max(1, Math.min(request.limit ?? 8, 24));
    const families = new Set(
      (request.methodFamilies ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
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
      `当前对象：${objects}`,
      families.size ? `方法族：${[...families].join(" ")}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n");

    const hits = this.retrieval.search(field.projectId, query, {
      limit: Math.min(100, Math.max(limit * 8, 40)),
      rerank: true,
      sourceTypes: ["creative_method"],
    });

    return hits
      .filter((hit) =>
        methodAllowed(hit, families, request.includeCandidate ?? false),
      )
      .slice(0, limit)
      .map((hit, index) => {
        const methodFamily = metadataString(hit, "methodFamily")!;
        const methodId = metadataString(hit, "methodId") ?? hit.sourceId;
        const sourcePath = metadataString(hit, "sourcePath");
        return {
          id: `method-invocation:${methodFamily}:${methodId}:${index + 1}`,
          methodFamily,
          methodId,
          sourceRef: sourcePath,
          scope: request.scope,
          purpose: request.purpose,
          inputObjectIds: focusObjectIds,
          instruction: hit.content,
        };
      });
  }
}
