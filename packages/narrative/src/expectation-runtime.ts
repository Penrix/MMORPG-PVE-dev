import {
  ExpectationStateDraftSchema,
  ExpectationStateSchema,
  NarrativeAllocationBatchSchema,
  NarrativeAllocationDecisionDraftSchema,
  NarrativeAllocationDecisionSchema,
  type ExpectationState,
  type ExpectationStateDraft,
  type NarrativeAllocationBatch,
  type NarrativeAllocationDecision,
  type NarrativeAllocationDecisionDraft,
  type NarrativeCandidate,
  type WorldArbitrationReceipt,
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

function requireUniqueIds(
  label: string,
  values: readonly { id: string }[],
): Set<string> {
  const ids = new Set<string>();
  for (const item of values) {
    if (ids.has(item.id)) {
      throw new Error(
        `story_runtime.expectation.duplicate_${label}:${item.id}`,
      );
    }
    ids.add(item.id);
  }
  return ids;
}

function requireRefs(
  label: string,
  refs: readonly string[],
  allowed: ReadonlySet<string>,
): void {
  for (const ref of refs) {
    if (!allowed.has(ref)) {
      throw new Error(`story_runtime.expectation.unknown_${label}:${ref}`);
    }
  }
}

/**
 * Finalize author-side expectation state.
 *
 * This intentionally validates relationships between evidence, established
 * cognition and protagonist advantage rather than inventing a scalar score.
 */
export function finalizeExpectationState(
  draft: ExpectationStateDraft,
): ExpectationState {
  const parsed = ExpectationStateDraftSchema.parse(draft);
  const scarcityIds = requireUniqueIds(
    "scarcity_evidence",
    parsed.scarcityEvidence,
  );
  const beliefIds = requireUniqueIds(
    "established_belief",
    parsed.establishedBeliefs,
  );
  const advantageIds = requireUniqueIds(
    "protagonist_advantage",
    parsed.protagonistAdvantages,
  );
  requireUniqueIds("expectation_thread", parsed.threads);

  for (const belief of parsed.establishedBeliefs) {
    requireRefs(
      "scarcity_evidence",
      belief.supportingScarcityEvidenceIds,
      scarcityIds,
    );
  }
  for (const advantage of parsed.protagonistAdvantages) {
    requireRefs(
      "established_belief",
      advantage.contradictsBeliefIds,
      beliefIds,
    );
  }

  const advantagesById = new Map(
    parsed.protagonistAdvantages.map((advantage) => [advantage.id, advantage]),
  );

  for (const thread of parsed.threads) {
    requireRefs("scarcity_evidence", thread.scarcityEvidenceIds, scarcityIds);
    requireRefs("established_belief", thread.establishedBeliefIds, beliefIds);
    requireRefs(
      "protagonist_advantage",
      thread.protagonistAdvantageIds,
      advantageIds,
    );

    if (
      thread.phase !== "seeding" &&
      (thread.establishedBeliefIds.length === 0 ||
        thread.protagonistAdvantageIds.length === 0)
    ) {
      throw new Error(
        `story_runtime.expectation.thread_gap_incomplete:${thread.id}`,
      );
    }

    if (["ripe", "payoff", "settled"].includes(thread.phase)) {
      const readerCanSeeGap = thread.protagonistAdvantageIds.some((id) => {
        const advantage = advantagesById.get(id);
        return advantage && advantage.readerKnowledge !== "hidden";
      });
      if (!readerCanSeeGap) {
        throw new Error(
          `story_runtime.expectation.ripe_without_reader_visible_advantage:${thread.id}`,
        );
      }
      if (thread.reactionTargetEntityIds.length === 0) {
        throw new Error(
          `story_runtime.expectation.ripe_without_reaction_targets:${thread.id}`,
        );
      }
    }
  }

  const withoutDigest = parsed;
  return ExpectationStateSchema.parse({
    ...withoutDigest,
    digest: digest(withoutDigest),
  });
}

function allocationReferenceSets(state: ExpectationState) {
  return {
    scarcityIds: new Set(state.scarcityEvidence.map((item) => item.id)),
    beliefIds: new Set(state.establishedBeliefs.map((item) => item.id)),
    threadIds: new Set(state.threads.map((item) => item.id)),
    threadById: new Map(state.threads.map((item) => [item.id, item])),
  };
}

/**
 * Bind one narrative-allocation decision to an existing Reality candidate and
 * active expectation state. The Director may allocate Reader Time, but may not
 * rewrite the underlying event or character intent.
 */
export function finalizeNarrativeAllocationDecision(
  draft: NarrativeAllocationDecisionDraft,
  state: ExpectationState,
  candidate: NarrativeCandidate,
): NarrativeAllocationDecision {
  const parsed = NarrativeAllocationDecisionDraftSchema.parse(draft);
  if (
    parsed.projectId !== state.projectId ||
    parsed.projectId !== candidate.projectId ||
    parsed.candidateId !== candidate.id
  ) {
    throw new Error("story_runtime.expectation.allocation_not_bound");
  }

  const refs = allocationReferenceSets(state);
  requireRefs(
    "expectation_thread",
    parsed.expectationThreadIds,
    refs.threadIds,
  );
  requireRefs(
    "scarcity_evidence",
    parsed.deepenScarcityEvidenceIds,
    refs.scarcityIds,
  );
  requireRefs("established_belief", parsed.reinforceBeliefIds, refs.beliefIds);
  requireRefs("established_belief", parsed.widenGapBeliefIds, refs.beliefIds);
  requireRefs("expectation_thread", parsed.payoffThreadIds, refs.threadIds);

  if (parsed.action === "skip" && parsed.readerTime !== "none") {
    throw new Error("story_runtime.expectation.skip_requires_no_reader_time");
  }
  if (
    parsed.action === "background" &&
    !["mention", "beat"].includes(parsed.readerTime)
  ) {
    throw new Error(
      "story_runtime.expectation.background_reader_time_too_large",
    );
  }
  if (
    ["seed", "charge", "payoff"].includes(parsed.action) &&
    parsed.readerTime === "none"
  ) {
    throw new Error(
      "story_runtime.expectation.story_action_requires_reader_time",
    );
  }
  if (
    ["seed", "charge", "payoff"].includes(parsed.action) &&
    parsed.expectationThreadIds.length === 0
  ) {
    throw new Error("story_runtime.expectation.story_action_requires_thread");
  }

  const operations =
    parsed.deepenScarcityEvidenceIds.length +
    parsed.reinforceBeliefIds.length +
    parsed.widenGapBeliefIds.length +
    parsed.embodimentTargets.length;

  if (parsed.action === "charge" && operations === 0) {
    throw new Error("story_runtime.expectation.charge_without_operation");
  }

  if (parsed.action === "payoff") {
    if (parsed.payoffThreadIds.length === 0) {
      throw new Error("story_runtime.expectation.payoff_requires_thread");
    }
    for (const threadId of parsed.payoffThreadIds) {
      const thread = refs.threadById.get(threadId);
      if (!thread || !["ripe", "payoff"].includes(thread.phase)) {
        throw new Error(
          `story_runtime.expectation.payoff_thread_not_ripe:${threadId}`,
        );
      }
    }
  } else if (parsed.payoffThreadIds.length > 0) {
    throw new Error("story_runtime.expectation.nonpayoff_cannot_settle_thread");
  }

  const withoutDigest = parsed;
  return NarrativeAllocationDecisionSchema.parse({
    ...withoutDigest,
    digest: digest(withoutDigest),
  });
}

export function finalizeNarrativeAllocationBatch(
  state: ExpectationState,
  candidates: readonly NarrativeCandidate[],
  drafts: readonly NarrativeAllocationDecisionDraft[],
): NarrativeAllocationBatch {
  if (candidates.length === 0) {
    throw new Error("story_runtime.expectation.no_candidates");
  }
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  if (candidateById.size !== candidates.length) {
    throw new Error("story_runtime.expectation.duplicate_candidate");
  }
  if (drafts.length !== candidates.length) {
    throw new Error("story_runtime.expectation.incomplete_allocation");
  }

  const seen = new Set<string>();
  const decisions = drafts.map((draft) => {
    if (seen.has(draft.candidateId)) {
      throw new Error(
        `story_runtime.expectation.duplicate_allocation:${draft.candidateId}`,
      );
    }
    seen.add(draft.candidateId);
    const candidate = candidateById.get(draft.candidateId);
    if (!candidate) {
      throw new Error(
        `story_runtime.expectation.unknown_candidate:${draft.candidateId}`,
      );
    }
    return finalizeNarrativeAllocationDecision(draft, state, candidate);
  });

  for (const candidate of candidates) {
    if (!seen.has(candidate.id)) {
      throw new Error(
        `story_runtime.expectation.missing_candidate:${candidate.id}`,
      );
    }
  }

  const selectedCandidateIds = decisions
    .filter((decision) =>
      ["seed", "charge", "payoff"].includes(decision.action),
    )
    .map((decision) => decision.candidateId);

  const withoutDigest = {
    version: "narrative-allocation-batch.v1" as const,
    authority: "speculative" as const,
    projectId: state.projectId,
    expectationStateDigest: state.digest,
    candidateIds: candidates.map((candidate) => candidate.id),
    decisions,
    selectedCandidateIds,
  };

  return NarrativeAllocationBatchSchema.parse({
    ...withoutDigest,
    digest: digest(withoutDigest),
  });
}

/**
 * Bridge Layer 1 Reality Runtime into Layer 2 Expectation Runtime.
 *
 * Every finalized character resolution becomes one speculative NarrativeCandidate.
 * The candidate preserves what actually happened in the arbitration receipt; the
 * expectation layer may allocate Reader Time, but may not rewrite it.
 */
export function narrativeCandidatesFromArbitration(
  receipt: WorldArbitrationReceipt,
): NarrativeCandidate[] {
  if (!receipt.finalized) {
    throw new Error("story_runtime.expectation.arbitration_not_final");
  }

  return [...receipt.resolutions]
    .sort((left, right) => left.actionOrder - right.actionOrder)
    .map((resolution) => ({
      id: `candidate:${receipt.digest}:${resolution.agentId}`,
      projectId: receipt.projectId,
      generationId: receipt.generationId,
      source: "actor_initiative" as const,
      authority: "speculative" as const,
      summary: [
        resolution.characterName,
        resolution.intendedAction,
        `outcome=${resolution.outcome}`,
        resolution.immediateResult,
      ].join(" | "),
      involvedEntityIds: [resolution.characterId],
      evidenceRefs: [resolution.proposalDigest, receipt.digest],
      effects: [
        `stateAfter=${resolution.stateAfter}`,
        ...resolution.butterflyEffects.map(
          (effect) =>
            `${effect.effect} | via=${effect.transmissionPath} | horizon=${effect.arrivalHorizon} | protagonistImpact=${effect.protagonistImpact}`,
        ),
      ],
      originDigest: receipt.digest,
    }));
}
