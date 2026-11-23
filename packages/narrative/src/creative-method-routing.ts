import { z } from "zod";

import {
  type CreativeMethodInvocation,
  type StoryCreativeContext,
  type StoryObjectField,
  type StoryUpgradeLedger,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { JsonSchemaContract } from "@narralume/llm";

import {
  getCreativeMethodDefinition,
  storySearchMethodDefinitions,
  type CreativeMethodDefinition,
} from "./m-series-methods.js";
import type { NarrativeModelClient } from "./model-client.js";
import { zodValidator } from "./schemas.js";
import {
  assertStoryCreativeContextBound,
  withCreativeMethodInvocations,
} from "./story-creative-context.js";

const CreativeMethodRouteSelectionSchema = z.object({
  methodId: z.string().min(1),
  role: z.enum(["primary", "secondary"]),
  purpose: z.string().min(1),
  reason: z.string().min(1),
  inputObjectIds: z.array(z.string().min(1)).min(1),
});

const CreativeMethodRoutingOutputSchema = z.object({
  diagnosis: z.string().min(1),
  selections: z.array(CreativeMethodRouteSelectionSchema).min(1).max(2),
});
type CreativeMethodRoutingOutput = z.infer<
  typeof CreativeMethodRoutingOutputSchema
>;

const CREATIVE_METHOD_ROUTING_CONTRACT: JsonSchemaContract = {
  name: "story_creative_method_routing",
  strict: true,
  schema: z.toJSONSchema(CreativeMethodRoutingOutputSchema),
};

export interface StoryCreativeMethodRoutingRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  upgradeLedger: StoryUpgradeLedger;
  request: string;
  readerNeed: string;
  targetEmotion: string;
}

export interface StoryCreativeMethodRoutingSelection {
  invocation: CreativeMethodInvocation;
  role: "primary" | "secondary" | "manual";
  reason: string;
  title: string;
}

export interface StoryCreativeMethodRoutingPlan {
  mode: "manual" | "auto";
  diagnosis: string;
  selections: StoryCreativeMethodRoutingSelection[];
}

export interface StoryCreativeMethodRoutingResult {
  plan: StoryCreativeMethodRoutingPlan;
  creativeContext: StoryCreativeContext;
  usage: RunBudgetUsage;
  generation: {
    mode: "manual" | "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

function emptyUsage(): RunBudgetUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
    costUsd: 0,
    wallTimeMs: 0,
  };
}

function hasPriorStoryState(context: StoryCreativeContext): boolean {
  const inherited = context.frame.inheritedState;
  return (
    inherited.retainedAssets.length > 0 ||
    inherited.activeStakeLedger.length > 0 ||
    inherited.openExpectationThreads.length > 0 ||
    inherited.sourceStates.length > 0
  );
}

function routerCatalog(definitions: readonly CreativeMethodDefinition[]) {
  return definitions.map((definition) => ({
    methodId: definition.methodId,
    family: definition.methodFamily,
    title: definition.title,
    useWhen: definition.useWhen,
    avoidWhen: definition.avoidWhen,
    requiresMaterials: definition.requiresMaterials,
    requiresPriorStoryState: definition.requiresPriorStoryState,
  }));
}

function routingIssues(
  value: CreativeMethodRoutingOutput,
  definitions: readonly CreativeMethodDefinition[],
  field: StoryObjectField,
): string[] {
  const issues: string[] = [];
  const allowedMethods = new Set(
    definitions.map((definition) => definition.methodId),
  );
  const allowedObjects = new Set(field.objects.map((object) => object.id));
  const methodIds = new Set<string>();
  let primaryCount = 0;
  let secondaryCount = 0;

  for (const selection of value.selections) {
    if (!allowedMethods.has(selection.methodId)) {
      issues.push(`unknown methodId ${selection.methodId}`);
    }
    if (methodIds.has(selection.methodId)) {
      issues.push(`duplicate methodId ${selection.methodId}`);
    }
    methodIds.add(selection.methodId);
    if (selection.role === "primary") primaryCount += 1;
    if (selection.role === "secondary") secondaryCount += 1;
    for (const objectId of selection.inputObjectIds) {
      if (!allowedObjects.has(objectId)) {
        issues.push(`unknown inputObjectId ${objectId}`);
      }
    }
  }

  if (primaryCount !== 1) {
    issues.push("routing must select exactly one primary method");
  }
  if (secondaryCount > 1) {
    issues.push("routing may select at most one secondary method");
  }

  return issues;
}

function compileInvocation(input: {
  definition: CreativeMethodDefinition;
  selection: CreativeMethodRoutingOutput["selections"][number];
  context: StoryCreativeContext;
}): CreativeMethodInvocation {
  return {
    id: `method:${input.definition.methodId}:${input.selection.role}:${input.context.frame.targetOutlineNodeId}`,
    methodFamily: input.definition.methodFamily,
    methodId: input.definition.methodId,
    sourceRef: input.definition.sourceRef,
    scope: input.definition.scope,
    purpose: input.selection.purpose,
    inputObjectIds: input.selection.inputObjectIds,
    instruction: input.definition.instruction,
  };
}

/**
 * Choose a search method for an already-defined creative problem.
 *
 * This router never decides "what story is worth writing". Doc 23 / the
 * lecturer Story Director owns that decision. The router only chooses how the
 * model should search for more candidates around the current problem.
 */
export class CreativeMethodRoutingService {
  constructor(private readonly model: NarrativeModelClient) {}

  async routeStorySearch(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: StoryCreativeMethodRoutingRequest,
    signal: AbortSignal,
  ): Promise<StoryCreativeMethodRoutingResult> {
    if (
      run.projectId !== request.field.projectId ||
      request.creativeContext.projectId !== request.field.projectId ||
      request.request.trim().length === 0
    ) {
      throw new Error("creative_method_routing.invalid_request");
    }

    assertStoryCreativeContextBound(
      request.creativeContext,
      request.field,
      request.upgradeLedger,
    );

    if (request.creativeContext.methodInvocations.length > 0) {
      return {
        plan: {
          mode: "manual",
          diagnosis:
            "调用方已经明确指定创作方法，自动路由不覆盖作者/上游选择。",
          selections: request.creativeContext.methodInvocations.map(
            (invocation) => {
              const definition = getCreativeMethodDefinition(
                invocation.methodId,
              );
              return {
                invocation,
                role: "manual" as const,
                reason: invocation.purpose,
                title: definition?.title ?? invocation.methodId,
              };
            },
          ),
        },
        creativeContext: request.creativeContext,
        usage: emptyUsage(),
        generation: {
          mode: "manual",
          attempts: 0,
        },
      };
    }

    const definitions = storySearchMethodDefinitions({
      hasMaterials: request.creativeContext.materialSelections.length > 0,
      hasPriorStoryState: hasPriorStoryState(request.creativeContext),
    });
    if (definitions.length === 0) {
      throw new Error("creative_method_routing.no_eligible_method");
    }

    const result = await this.model.structured(
      run,
      step,
      "story-creative-method-routing",
      {
        instructions: [
          "你只负责选择创作搜索方法，不负责决定故事写什么。",
          "Story Director已经给出了当前Upgrade、男主目标、Reader需求和创作问题。不要改写这些上位目标。",
          "从eligibleMethods中选且只选1个primary；只有当第二种方法提供明显不同的搜索运动时，才额外选1个secondary。",
          "禁止为了显得全面选择多个近义方法，禁止输出未列出的methodId。",
          "方法只作用于当前Object Field中的具体对象。inputObjectIds只能使用给出的object.id。",
          "如果当前已有Creative Materials，可以选择需要素材的COMPOSE/演奏类方法；没有素材时这些方法不会出现在eligibleMethods里。",
          "诊断当前卡点属于：对象没玩起来、升级/人物/Reader太薄、第一先验太熟、缺成熟人物因果、已有方案缺变奏、旧资产/人物线没继续供戏、需要开放联想/反惰性/猎场扫描等哪一类。",
          "最终只解释为什么选这个搜索动作，不给具体剧情答案。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                scale: request.field.scale,
                request: request.request,
                readerNeed: request.readerNeed,
                targetEmotion: request.targetEmotion,
                upgradeLedger: request.upgradeLedger,
                protagonistCamera: request.creativeContext.protagonistCamera,
                inheritedState: request.creativeContext.frame.inheritedState,
                materialSelections:
                  request.creativeContext.materialSelections.map(
                    (selection) => ({
                      id: selection.id,
                      materialId: selection.materialId,
                      materialType: selection.materialType,
                      title: selection.title,
                      purpose: selection.purpose,
                      tags: selection.tags,
                    }),
                  ),
                objectCatalog: request.field.objects.map((object) => ({
                  id: object.id,
                  entityId: object.entityId,
                  name: object.name,
                  kind: object.kind,
                })),
                eligibleMethods: routerCatalog(definitions),
              },
              null,
              2,
            ),
          },
        ],
        reasoningEffort: "medium",
      },
      CREATIVE_METHOD_ROUTING_CONTRACT,
      zodValidator(CreativeMethodRoutingOutputSchema, (value) =>
        routingIssues(value, definitions, request.field),
      ),
      signal,
    );

    const selections: StoryCreativeMethodRoutingSelection[] =
      result.value.selections.map((selection) => {
        const definition = getCreativeMethodDefinition(selection.methodId);
        if (!definition) {
          throw new Error(
            `creative_method_routing.missing_definition:${selection.methodId}`,
          );
        }
        return {
          invocation: compileInvocation({
            definition,
            selection,
            context: request.creativeContext,
          }),
          role: selection.role,
          reason: selection.reason,
          title: definition.title,
        };
      });
    const creativeContext = withCreativeMethodInvocations(
      request.creativeContext,
      selections.map((selection) => selection.invocation),
    );

    return {
      plan: {
        mode: "auto",
        diagnosis: result.value.diagnosis,
        selections,
      },
      creativeContext,
      usage: result.usage,
      generation: {
        mode: result.mode,
        attempts: result.attempts,
      },
    };
  }
}
