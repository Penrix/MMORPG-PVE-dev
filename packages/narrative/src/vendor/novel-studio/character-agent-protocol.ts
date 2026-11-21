/**
 * Adapted from Xiaoyangy/novel-studio (Apache-2.0).
 *
 * Upstream source:
 *   internal/domain/character_agents.go
 *   blob: 99ed52aadea2ac85145e23a2288aaff02960d7e3
 *
 * This is a TypeScript adaptation for NarraLume's existing Canon Entity and
 * StoryState model. It intentionally does not copy novel-studio's storage,
 * Go runtime, agent registry, resource protocol, or chapter numbering.
 *
 * Core invariants retained:
 * - a decision proposal is cryptographically/logically bound to one observation;
 * - a character may reference only evidence present in that observation;
 * - arbitration resolves every proposal but must not rewrite character intent;
 * - unresolved conflicts prevent finalization;
 * - arbitration output remains speculative until manuscript Settlement.
 *
 * Licensed under the Apache License, Version 2.0.
 */

import {
  CharacterActionProposalDraftSchema,
  CharacterActionProposalSchema,
  SpeculativeRealityDeltaSchema,
  WorldArbitrationReceiptDraftSchema,
  WorldArbitrationReceiptSchema,
  type CharacterActionProposal,
  type CharacterActionProposalDraft,
  type CharacterObservationPacket,
  type SpeculativeRealityDelta,
  type WorldArbitrationReceipt,
  type WorldArbitrationReceiptDraft,
} from "@narralume/contracts";
import { sha256Hex } from "@narralume/domain";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return sha256Hex(stableJson(value));
}

function normalizedStrings(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function observationAllowedEvidenceIds(
  observation: CharacterObservationPacket,
): Set<string> {
  return new Set(
    [
      ...observation.knownFacts,
      ...observation.perceivedEvents,
      ...observation.relationships,
      ...observation.memory,
    ].map((entry) => entry.id),
  );
}

export function finalizeCharacterActionProposal(
  draft: CharacterActionProposalDraft,
  observation: CharacterObservationPacket,
): CharacterActionProposal {
  const parsed = CharacterActionProposalDraftSchema.parse(draft);
  if (
    parsed.projectId !== observation.projectId ||
    parsed.generationId !== observation.generationId ||
    parsed.round !== observation.round ||
    parsed.agentId !== observation.agentId ||
    parsed.characterId !== observation.characterId ||
    parsed.characterName !== observation.characterName ||
    parsed.observationDigest !== observation.digest
  ) {
    throw new Error("story_runtime.proposal.not_bound_to_observation");
  }
  if (
    parsed.currentGoal !== observation.currentGoal ||
    parsed.pressure !== observation.pressure ||
    parsed.location !== observation.location
  ) {
    throw new Error("story_runtime.proposal.rewrites_observation_state");
  }

  const availableOptions = normalizedStrings(parsed.availableOptions);
  const rejectedOptions = normalizedStrings(parsed.rejectedOptions);
  if (availableOptions.length < 2) {
    throw new Error("story_runtime.proposal.requires_options");
  }
  if (!availableOptions.includes(parsed.decision)) {
    throw new Error("story_runtime.proposal.decision_not_in_options");
  }
  if (rejectedOptions.includes(parsed.decision)) {
    throw new Error("story_runtime.proposal.rejects_chosen_decision");
  }
  for (const rejected of rejectedOptions) {
    if (!availableOptions.includes(rejected)) {
      throw new Error("story_runtime.proposal.rejects_unknown_option");
    }
  }

  const allowedEvidence = observationAllowedEvidenceIds(observation);
  const knowledgeRefs = normalizedStrings(parsed.knowledgeRefs);
  if (knowledgeRefs.length === 0) {
    throw new Error("story_runtime.proposal.requires_knowledge");
  }
  for (const ref of knowledgeRefs) {
    if (!allowedEvidence.has(ref)) {
      throw new Error(
        `story_runtime.proposal.unavailable_knowledge:${ref}`,
      );
    }
  }

  const observationResources = new Set(observation.resources);
  const resources = normalizedStrings(parsed.resources);
  for (const resource of resources) {
    if (!observationResources.has(resource)) {
      throw new Error(
        `story_runtime.proposal.unavailable_resource:${resource}`,
      );
    }
  }

  const withoutDigest = {
    ...parsed,
    resources,
    availableOptions,
    rejectedOptions,
    knowledgeRefs,
    resourceClaims: normalizedStrings(parsed.resourceClaims),
    constraints: normalizedStrings(parsed.constraints),
    contingencies: normalizedStrings(parsed.contingencies),
    expectedConsequences: normalizedStrings(parsed.expectedConsequences),
  };
  return CharacterActionProposalSchema.parse({
    ...withoutDigest,
    digest: digest(withoutDigest),
  });
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const a = normalizedStrings(left);
  const b = normalizedStrings(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function finalizeWorldArbitrationReceipt(
  draft: WorldArbitrationReceiptDraft,
  proposals: readonly CharacterActionProposal[],
): WorldArbitrationReceipt {
  const parsed = WorldArbitrationReceiptDraftSchema.parse(draft);
  if (proposals.length === 0) {
    throw new Error("story_runtime.arbitration.no_proposals");
  }
  const projectIds = new Set(proposals.map((proposal) => proposal.projectId));
  const generationIds = new Set(
    proposals.map((proposal) => proposal.generationId),
  );
  const rounds = new Set(proposals.map((proposal) => proposal.round));
  if (
    projectIds.size !== 1 ||
    generationIds.size !== 1 ||
    rounds.size !== 1 ||
    !projectIds.has(parsed.projectId) ||
    !generationIds.has(parsed.generationId) ||
    !rounds.has(parsed.round)
  ) {
    throw new Error("story_runtime.arbitration.proposal_cycle_mismatch");
  }

  const byAgent = new Map(
    proposals.map((proposal) => [proposal.agentId, proposal]),
  );
  if (
    byAgent.size !== proposals.length ||
    !sameStringSet(
      parsed.proposalDigests,
      proposals.map((proposal) => proposal.digest),
    )
  ) {
    throw new Error("story_runtime.arbitration.proposal_digest_mismatch");
  }

  const seenAgents = new Set<string>();
  const seenOrders = new Set<number>();
  for (const resolution of parsed.resolutions) {
    const proposal = byAgent.get(resolution.agentId);
    if (
      !proposal ||
      resolution.characterId !== proposal.characterId ||
      resolution.characterName !== proposal.characterName ||
      resolution.proposalDigest !== proposal.digest
    ) {
      throw new Error("story_runtime.arbitration.resolution_not_bound");
    }
    if (
      resolution.decision !== proposal.decision ||
      resolution.intendedAction !== proposal.intendedAction
    ) {
      throw new Error("story_runtime.arbitration.rewrites_character_intent");
    }
    if (seenAgents.has(resolution.agentId)) {
      throw new Error("story_runtime.arbitration.duplicate_resolution");
    }
    if (seenOrders.has(resolution.actionOrder)) {
      throw new Error("story_runtime.arbitration.duplicate_action_order");
    }
    seenAgents.add(resolution.agentId);
    seenOrders.add(resolution.actionOrder);
  }
  if (seenAgents.size !== proposals.length) {
    throw new Error("story_runtime.arbitration.unresolved_proposal");
  }

  const conflictIds = new Set<string>();
  let unresolvedConflict = false;
  for (const conflict of parsed.conflicts) {
    if (conflictIds.has(conflict.id)) {
      throw new Error("story_runtime.arbitration.duplicate_conflict");
    }
    conflictIds.add(conflict.id);
    for (const agentId of conflict.affectedAgentIds) {
      if (!byAgent.has(agentId)) {
        throw new Error("story_runtime.arbitration.conflict_unknown_agent");
      }
    }
    if (!conflict.resolved) unresolvedConflict = true;
  }
  for (const resolution of parsed.resolutions) {
    for (const conflictId of resolution.conflictIds) {
      if (!conflictIds.has(conflictId)) {
        throw new Error("story_runtime.arbitration.unknown_conflict_reference");
      }
    }
  }

  if (
    parsed.hardContractStatus === "feasible" &&
    parsed.hardContractConflicts.length > 0
  ) {
    throw new Error("story_runtime.arbitration.feasible_with_hard_conflict");
  }
  if (
    parsed.hardContractStatus === "infeasible" &&
    parsed.hardContractConflicts.length === 0
  ) {
    throw new Error("story_runtime.arbitration.infeasible_without_reason");
  }
  if (parsed.finalized && unresolvedConflict) {
    throw new Error("story_runtime.arbitration.finalized_with_open_conflict");
  }
  if (
    parsed.finalized &&
    parsed.hardContractStatus === "infeasible"
  ) {
    throw new Error("story_runtime.arbitration.infeasible_cannot_finalize");
  }
  if (
    !parsed.finalized &&
    !unresolvedConflict &&
    parsed.hardContractStatus !== "infeasible"
  ) {
    throw new Error(
      "story_runtime.arbitration.nonfinal_requires_open_conflict",
    );
  }

  if (parsed.protagonistProjection) {
    const proposal = proposals.find(
      (candidate) =>
        candidate.characterId === parsed.protagonistProjection?.characterId,
    );
    if (
      !proposal ||
      parsed.protagonistProjection.chosenDecision !== proposal.decision ||
      !sameStringSet(
        parsed.protagonistProjection.availableOptions,
        proposal.availableOptions,
      )
    ) {
      throw new Error(
        "story_runtime.arbitration.protagonist_projection_not_bound",
      );
    }
  }

  const normalized = {
    ...parsed,
    proposalDigests: normalizedStrings(parsed.proposalDigests),
    hardContractConflicts: normalizedStrings(parsed.hardContractConflicts),
    conflicts: parsed.conflicts.map((conflict) => ({
      ...conflict,
      affectedAgentIds: normalizedStrings(conflict.affectedAgentIds),
    })),
  };
  return WorldArbitrationReceiptSchema.parse({
    ...normalized,
    digest: digest(normalized),
  });
}

export function speculativeRealityDeltaFromArbitration(
  receipt: WorldArbitrationReceipt,
): SpeculativeRealityDelta {
  if (!receipt.finalized) {
    throw new Error("story_runtime.delta.requires_final_arbitration");
  }
  const withoutDigest = {
    version: "speculative-reality-delta.v1" as const,
    authority: "speculative" as const,
    projectId: receipt.projectId,
    generationId: receipt.generationId,
    arbitrationDigest: receipt.digest,
    mutations: receipt.resolutions.map((resolution) => ({
      agentId: resolution.agentId,
      characterId: resolution.characterId,
      outcome: resolution.outcome,
      stateAfter: resolution.stateAfter,
      effects: resolution.butterflyEffects,
    })),
    warning:
      "Simulation only. Do not write to Canon; manuscript Settlement remains the accepted write path." as const,
  };
  return SpeculativeRealityDeltaSchema.parse({
    ...withoutDigest,
    digest: digest(withoutDigest),
  });
}
