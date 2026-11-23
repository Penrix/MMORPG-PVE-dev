import type {
  CreativeMethodInvocation,
  StoryCreativeContext,
  StoryObjectField,
  StoryUpgradeLedger,
} from "@narralume/contracts";
import type { NarrativeRun, NarrativeRunStep, RunBudgetUsage } from "@narralume/domain";

import {
  creativeMethodEligibilityIssue,
  getCreativeMethodDefinition,
  type CreativeMethodDefinition,
} from "./m-series-methods.js";
import type { NarrativeModelClient } from "./model-client.js";
import {
  assertStoryCreativeContextBound,
  withCreativeMethodInvocations,
} from "./story-creative-context.js";

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
  role: "manual";
  reason: string;
  title: string;
}

export interface StoryCreativeMethodRoutingPlan {
  mode: "manual";
  diagnosis: string;
  selections: StoryCreativeMethodRoutingSelection[];
}

export interface StoryCreativeMethodRoutingResult {
  plan: StoryCreativeMethodRoutingPlan;
  creativeContext: StoryCreativeContext;
  usage: RunBudgetUsage;
  generation: { mode: "manual"; attempts: number };
}

export interface CreativeOperatorInvocationRequest {
  field: StoryObjectField;
  creativeContext: StoryCreativeContext;
  upgradeLedger: StoryUpgradeLedger;
  methodId: string;
  purpose: string;
  inputObjectIds: readonly string[];
}

export interface CreativeOperatorInvocationResult {
  definition: CreativeMethodDefinition;
  invocation: CreativeMethodInvocation;
  creativeContext: StoryCreativeContext;
}

function emptyUsage(): RunBudgetUsage {
  return { inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0, wallTimeMs: 0 };
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

function validateExplicitOperator(
  request: CreativeOperatorInvocationRequest,
): CreativeMethodDefinition {
  assertStoryCreativeContextBound(
    request.creativeContext,
    request.field,
    request.upgradeLedger,
  );

  const definition = getCreativeMethodDefinition(request.methodId);
  if (!definition) {
    throw new Error(`creative_operator.unknown_method:${request.methodId}`);
  }
  if (definition.placement !== "module2-operator") {
    throw new Error(
      `creative_operator.embedded_not_callable:${request.methodId}`,
    );
  }

  const issue = creativeMethodEligibilityIssue(definition, {
    materials: request.creativeContext.materialSelections,
    hasPriorStoryState: hasPriorStoryState(request.creativeContext),
  });
  if (issue) {
    throw new Error(
      `creative_operator.prerequisite:${request.methodId}:${issue}`,
    );
  }

  if (
    request.purpose.trim().length === 0 ||
    request.inputObjectIds.length === 0
  ) {
    throw new Error("creative_operator.invalid_request");
  }
  const allowedObjectIds = new Set(
    request.field.objects.map((object) => object.id),
  );
  for (const objectId of request.inputObjectIds) {
    if (!allowedObjectIds.has(objectId)) {
      throw new Error(`creative_operator.unknown_object:${objectId}`);
    }
  }

  return definition;
}

/**
 * Module-2 Creative Operator Space invocation.
 *
 * Operators are tools, not a pipeline. The caller explicitly names one
 * operator for one local creative problem. M01B is deliberately rejected here
 * because it is embedded in Module 3 instead of being a callable operator.
 */
export class CreativeOperatorInvocationService {
  invoke(
    request: CreativeOperatorInvocationRequest,
  ): CreativeOperatorInvocationResult {
    const definition = validateExplicitOperator(request);
    const invocation: CreativeMethodInvocation = {
      id: `operator:${definition.methodId}:${request.creativeContext.frame.targetOutlineNodeId}:${request.creativeContext.methodInvocations.length + 1}`,
      methodFamily: definition.methodFamily,
      methodId: definition.methodId,
      sourceRef: definition.sourceRef,
      scope: definition.scope,
      purpose: request.purpose,
      inputObjectIds: [...request.inputObjectIds],
      instruction: definition.instruction,
    };

    return {
      definition,
      invocation,
      creativeContext: withCreativeMethodInvocations(
        request.creativeContext,
        [invocation],
      ),
    };
  }
}

/**
 * Compatibility shell for the previous automatic method router.
 *
 * Automatic "pick one primary + one secondary" routing is intentionally
 * disabled. Story Director owns the flow; Module-2 operators are invoked
 * explicitly when a local problem needs one.
 */
export class CreativeMethodRoutingService {
  constructor(_model?: NarrativeModelClient) {}

  async routeStorySearch(
    run: NarrativeRun,
    _step: NarrativeRunStep,
    request: StoryCreativeMethodRoutingRequest,
    _signal: AbortSignal,
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

    const selections = request.creativeContext.methodInvocations.map(
      (invocation): StoryCreativeMethodRoutingSelection => ({
        invocation,
        role: "manual",
        reason: invocation.purpose,
        title:
          getCreativeMethodDefinition(invocation.methodId)?.title ??
          invocation.methodId,
      }),
    );

    return {
      plan: {
        mode: "manual",
        diagnosis:
          selections.length > 0
            ? "已使用调用方显式指定的第二模块创意算子；自动方法路由已停用。"
            : "没有显式算子调用；M01B仍作为第三模块常驻三意识运行，自动方法路由已停用。",
        selections,
      },
      creativeContext: request.creativeContext,
      usage: emptyUsage(),
      generation: { mode: "manual", attempts: 0 },
    };
  }
}
