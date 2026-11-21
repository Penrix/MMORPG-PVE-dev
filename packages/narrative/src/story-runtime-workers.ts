import { z } from "zod";

import {
  type CharacterActionProposal,
  type CharacterObservationPacket,
  type WorldArbitrationReceipt,
  type WorldArbitrationConflictKind,
} from "@narralume/contracts";
import type {
  NarrativeRun,
  NarrativeRunStep,
  RunBudgetUsage,
} from "@narralume/domain";
import type { JsonSchemaContract } from "@narralume/llm";

import type { NarrativeModelClient } from "./model-client.js";
import { zodValidator } from "./schemas.js";
import {
  finalizeCharacterActionProposal,
  finalizeWorldArbitrationReceipt,
} from "./vendor/novel-studio/character-agent-protocol.js";

const CharacterDecisionOutputSchema = z.object({
  resources: z.array(z.string().min(1)),
  availableOptions: z.array(z.string().min(1)).min(2).max(12),
  rejectedOptions: z.array(z.string().min(1)).max(11),
  decision: z.string().min(1),
  decisionReason: z.string().min(1),
  intendedAction: z.string().min(1),
  actionDuration: z.string().min(1),
  knowledgeRefs: z.array(z.string().min(1)).min(1).max(30),
  resourceClaims: z.array(z.string().min(1)).max(30),
  constraints: z.array(z.string().min(1)).max(30),
  contingencies: z.array(z.string().min(1)).max(20),
  expectedConsequences: z.array(z.string().min(1)).max(20),
});
type CharacterDecisionOutput = z.infer<typeof CharacterDecisionOutputSchema>;

const ButterflyEffectOutputSchema = z.object({
  effect: z.string().min(1),
  transmissionPath: z.string().min(1),
  arrivalHorizon: z.number().int().nonnegative().max(100),
  protagonistImpact: z.string().min(1),
});

const ArbitrationResolutionOutputSchema = z.object({
  agentId: z.string().min(1),
  actionOrder: z.number().int().positive(),
  outcome: z.enum(["success", "partial", "blocked"]),
  immediateResult: z.string().min(1),
  stateAfter: z.string().min(1),
  butterflyEffects: z.array(ButterflyEffectOutputSchema).min(1).max(20),
  conflictIds: z.array(z.string().min(1)).max(20),
});

const ArbitrationConflictOutputSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "time",
    "location",
    "resource",
    "rule",
    "knowledge",
    "collision",
  ]),
  affectedAgentIds: z.array(z.string().min(1)).min(1),
  feedback: z.string().min(1),
  resolved: z.boolean(),
});

const ProtagonistProjectionOutputSchema = z
  .object({
    characterId: z.string().min(1),
    planConstraints: z.array(z.string().min(1)).min(1).max(30),
    causalChain: z.array(z.string().min(1)).min(1).max(30),
  })
  .nullable();

const WorldArbitrationOutputSchema = z.object({
  resolutions: z.array(ArbitrationResolutionOutputSchema).min(1),
  conflicts: z.array(ArbitrationConflictOutputSchema).max(50),
  hardContractStatus: z.enum(["feasible", "infeasible"]),
  hardContractConflicts: z.array(z.string().min(1)).max(30),
  protagonistProjection: ProtagonistProjectionOutputSchema,
  finalized: z.boolean(),
});
type WorldArbitrationOutput = z.infer<typeof WorldArbitrationOutputSchema>;

const CHARACTER_DECISION_CONTRACT: JsonSchemaContract = {
  name: "story_character_action_proposal",
  strict: true,
  schema: z.toJSONSchema(CharacterDecisionOutputSchema),
};

const WORLD_ARBITRATION_CONTRACT: JsonSchemaContract = {
  name: "story_world_arbitration",
  strict: true,
  schema: z.toJSONSchema(WorldArbitrationOutputSchema),
};

export interface StoryRuntimeModelResult<T> {
  value: T;
  usage: RunBudgetUsage;
  generation: {
    mode: "native" | "json-mode" | "prompt" | "repair";
    attempts: number;
  };
}

export interface WorldArbitrationModelRequest {
  projectId: string;
  generationId: string;
  round: number;
  proposals: readonly CharacterActionProposal[];
  operationalWorldContext: string;
  hardContracts?: readonly string[];
  protagonistCharacterId?: string | null;
}

/**
 * Real model execution boundary for the first Story Runtime loop.
 *
 * It deliberately accepts already-built observations and speculative proposals;
 * it does not write Canon. The caller decides which characters are active and
 * later converts a selected simulation into Story/Chapter targets.
 */
export class StoryRuntimeAgentService {
  constructor(private readonly model: NarrativeModelClient) {}

  async proposeCharacterAction(
    run: NarrativeRun,
    step: NarrativeRunStep,
    observation: CharacterObservationPacket,
    signal: AbortSignal,
  ): Promise<StoryRuntimeModelResult<CharacterActionProposal>> {
    if (
      run.projectId !== observation.projectId ||
      observation.authority !== "confirmed"
    ) {
      throw new Error("story_runtime.agent.invalid_observation");
    }

    const result = await this.model.structured(
      run,
      step,
      "story-character-action-plan",
      {
        instructions: [
          "你只扮演输入 observation 中这一名人物，不是作者、导演或全知旁白。",
          "只允许使用 observation 中提供的 knownFacts、perceivedEvents、relationships、memory 与 resources；knowledgeRefs 必须填写这些 evidence 的真实 id。",
          "先给至少两个此人真实可行的选项，再按此人的 currentGoal、pressure、资源、关系与已知事实自主选择。",
          "不要为了维护大纲、制造爽点或帮助主角而改变人物意志。角色可以拒绝合作、逃跑、拖延、误判或采取对主角不利的行动，只要符合他实际知道的 Reality。",
          "decision 必须逐字等于 availableOptions 中的一项；rejectedOptions 只能来自 availableOptions 且不能包含 decision。",
          "resources 只能填写 observation.resources 中本次实际打算调用的资源。不要虚构新资源、新知识或已经发生的结果。",
          "输出的是人物意图 Proposal，不是已经发生的 Reality。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(observation, null, 2),
          },
        ],
        reasoningEffort: "medium",
      },
      CHARACTER_DECISION_CONTRACT,
      zodValidator(CharacterDecisionOutputSchema),
      signal,
    );

    const output = result.value;
    const value = finalizeCharacterActionProposal(
      {
        version: "character-action-proposal.v1",
        authority: "speculative",
        projectId: observation.projectId,
        generationId: observation.generationId,
        round: observation.round,
        agentId: observation.agentId,
        characterId: observation.characterId,
        characterName: observation.characterName,
        observationDigest: observation.digest,
        location: observation.location,
        currentGoal: observation.currentGoal,
        pressure: observation.pressure,
        resources: output.resources,
        availableOptions: output.availableOptions,
        rejectedOptions: output.rejectedOptions,
        decision: output.decision,
        decisionReason: output.decisionReason,
        intendedAction: output.intendedAction,
        actionDuration: output.actionDuration,
        knowledgeRefs: output.knowledgeRefs,
        resourceClaims: output.resourceClaims,
        constraints: output.constraints,
        contingencies: output.contingencies,
        expectedConsequences: output.expectedConsequences,
        submittedAt: new Date().toISOString(),
      },
      observation,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }

  async arbitrateWorld(
    run: NarrativeRun,
    step: NarrativeRunStep,
    request: WorldArbitrationModelRequest,
    signal: AbortSignal,
  ): Promise<StoryRuntimeModelResult<WorldArbitrationReceipt>> {
    if (run.projectId !== request.projectId || request.proposals.length === 0) {
      throw new Error("story_runtime.arbiter.invalid_request");
    }
    const proposalByAgent = new Map(
      request.proposals.map((proposal) => [proposal.agentId, proposal]),
    );
    if (proposalByAgent.size !== request.proposals.length) {
      throw new Error("story_runtime.arbiter.duplicate_agent");
    }

    const modelInput = {
      projectId: request.projectId,
      generationId: request.generationId,
      round: request.round,
      operationalWorldContext: request.operationalWorldContext,
      hardContracts: request.hardContracts ?? [],
      protagonistCharacterId: request.protagonistCharacterId ?? null,
      proposals: request.proposals.map((proposal) => ({
        agentId: proposal.agentId,
        characterId: proposal.characterId,
        characterName: proposal.characterName,
        decision: proposal.decision,
        intendedAction: proposal.intendedAction,
        actionDuration: proposal.actionDuration,
        resourceClaims: proposal.resourceClaims,
        constraints: proposal.constraints,
        contingencies: proposal.contingencies,
        expectedConsequences: proposal.expectedConsequences,
        proposalDigest: proposal.digest,
      })),
    };

    const result = await this.model.structured(
      run,
      step,
      "story-world-arbitration-plan",
      {
        instructions: [
          "你是世界裁判，不是人物作者。所有 proposals 都是人物已经独立作出的意图。",
          "你只能判断这些意图在当前 operationalWorldContext 下如何同时结算：成功、部分成功或受阻。",
          "禁止替人物改主意。不要输出新的 decision / intendedAction；宿主会从原 Proposal 原样绑定。",
          "必须处理时间、地点、资源、规则、知识和行动碰撞。一个人物做不到，不等于他突然选择别的行动。",
          "resolution 必须覆盖每一个 agentId 且每人一次，actionOrder 不得重复。",
          "butterflyEffects 记录已裁结果怎样沿世界传播；arrivalHorizon=0 表示立即，正数表示以后才抵达。",
          "hardContracts 是作者侧不可破坏约束。若当前 Reality 下确实不可实现，标 infeasible 并指出原因，但不要伪造世界来满足它。",
          "这是 speculative simulation，不是 Canon，不要宣称未来已经发生。",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: JSON.stringify(modelInput, null, 2),
          },
        ],
        reasoningEffort: "medium",
      },
      WORLD_ARBITRATION_CONTRACT,
      zodValidator(WorldArbitrationOutputSchema, (value) =>
        arbitrationOutputIssues(value, proposalByAgent),
      ),
      signal,
    );

    const output = result.value;
    const resolutions = output.resolutions.map((resolution) => {
      const proposal = proposalByAgent.get(resolution.agentId);
      if (!proposal) {
        throw new Error(
          `story_runtime.arbiter.unknown_agent:${resolution.agentId}`,
        );
      }
      return {
        agentId: proposal.agentId,
        characterId: proposal.characterId,
        characterName: proposal.characterName,
        proposalDigest: proposal.digest,
        decision: proposal.decision,
        intendedAction: proposal.intendedAction,
        actionOrder: resolution.actionOrder,
        outcome: resolution.outcome,
        immediateResult: resolution.immediateResult,
        stateAfter: resolution.stateAfter,
        butterflyEffects: resolution.butterflyEffects,
        conflictIds: resolution.conflictIds,
      };
    });

    const protagonistProposal = request.protagonistCharacterId
      ? request.proposals.find(
          (proposal) =>
            proposal.characterId === request.protagonistCharacterId,
        )
      : undefined;
    const protagonistProjection =
      output.protagonistProjection && protagonistProposal
        ? {
            characterId: protagonistProposal.characterId,
            chosenDecision: protagonistProposal.decision,
            availableOptions: protagonistProposal.availableOptions,
            decisionReason: protagonistProposal.decisionReason,
            planConstraints: output.protagonistProjection.planConstraints,
            causalChain: output.protagonistProjection.causalChain,
          }
        : null;

    const value = finalizeWorldArbitrationReceipt(
      {
        version: "world-arbitration-receipt.v1",
        authority: "speculative",
        projectId: request.projectId,
        generationId: request.generationId,
        round: request.round,
        proposalDigests: request.proposals.map(
          (proposal) => proposal.digest,
        ),
        resolutions,
        conflicts: output.conflicts,
        hardContractStatus: output.hardContractStatus,
        hardContractConflicts: output.hardContractConflicts,
        protagonistProjection,
        finalized: output.finalized,
        generatedAt: new Date().toISOString(),
      },
      request.proposals,
    );

    return {
      value,
      usage: result.usage,
      generation: { mode: result.mode, attempts: result.attempts },
    };
  }
}

function arbitrationOutputIssues(
  value: WorldArbitrationOutput,
  proposals: ReadonlyMap<string, CharacterActionProposal>,
): string[] {
  const issues: string[] = [];
  const seenAgents = new Set<string>();
  const seenOrders = new Set<number>();
  for (const resolution of value.resolutions) {
    if (!proposals.has(resolution.agentId)) {
      issues.push(`resolutions: unknown agentId ${resolution.agentId}`);
    }
    if (seenAgents.has(resolution.agentId)) {
      issues.push(`resolutions: duplicate agentId ${resolution.agentId}`);
    }
    if (seenOrders.has(resolution.actionOrder)) {
      issues.push(
        `resolutions: duplicate actionOrder ${resolution.actionOrder}`,
      );
    }
    seenAgents.add(resolution.agentId);
    seenOrders.add(resolution.actionOrder);
  }
  for (const agentId of proposals.keys()) {
    if (!seenAgents.has(agentId)) {
      issues.push(`resolutions: missing agentId ${agentId}`);
    }
  }
  const conflictIds = new Set(value.conflicts.map((conflict) => conflict.id));
  for (const resolution of value.resolutions) {
    for (const id of resolution.conflictIds) {
      if (!conflictIds.has(id)) {
        issues.push(`resolutions: unknown conflictId ${id}`);
      }
    }
  }
  for (const conflict of value.conflicts) {
    for (const agentId of conflict.affectedAgentIds) {
      if (!proposals.has(agentId)) {
        issues.push(`conflicts: unknown agentId ${agentId}`);
      }
    }
  }
  if (
    value.hardContractStatus === "feasible" &&
    value.hardContractConflicts.length > 0
  ) {
    issues.push("hardContractConflicts must be empty when feasible");
  }
  if (
    value.hardContractStatus === "infeasible" &&
    value.hardContractConflicts.length === 0
  ) {
    issues.push("hardContractConflicts are required when infeasible");
  }
  if (
    value.finalized &&
    value.conflicts.some((conflict) => !conflict.resolved)
  ) {
    issues.push("finalized arbitration cannot contain unresolved conflicts");
  }
  return issues;
}

export function worldArbitrationConflictKinds(): readonly WorldArbitrationConflictKind[] {
  return [
    "time",
    "location",
    "resource",
    "rule",
    "knowledge",
    "collision",
  ] as const;
}
