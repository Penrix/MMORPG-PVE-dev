import {
  ExpectationDesignDraftSchema,
  ExpectationDesignSchema,
  ExpectationStateDraftSchema,
  ExpectationStateSchema,
  NarrativeAllocationBatchSchema,
  NarrativeAllocationDecisionDraftSchema,
  NarrativeAllocationDecisionSchema,
  StoryReaderTimePlanDraftSchema,
  StoryReaderTimePlanSchema,
  type ExpectationDesign,
  type ExpectationDesignDraft,
  type ExpectationState,
  type ExpectationStateDraft,
  type NarrativeAllocationBatch,
  type NarrativeAllocationDecision,
  type NarrativeAllocationDecisionDraft,
  type NarrativeCandidate,
  type StoryReaderTimePlan,
  type StoryReaderTimePlanDraft,
  type StorySceneExpansion,
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

export function finalizeExpectationDesign(
  draft: ExpectationDesignDraft,
  allowedEvidenceRefs?: ReadonlySet<string>,
  allowedEntityIds?: ReadonlySet<string>,
): ExpectationDesign {
  const parsed = ExpectationDesignDraftSchema.parse(draft);

  const evidenceRefs = [
    ...parsed.protagonistAdvantageRefs,
    ...parsed.worldFocusRefs,
    ...parsed.scarcityIntents.flatMap((item) => item.existingEvidenceRefs),
    ...parsed.beliefIntents.flatMap((item) => item.existingEvidenceRefs),
  ];
  if (allowedEvidenceRefs) {
    requireRefs("design_evidence", evidenceRefs, allowedEvidenceRefs);
  }

  if (allowedEntityIds) {
    requireRefs(
      "design_entity",
      [
        parsed.protagonistId,
        ...parsed.reactionTargetEntityIds,
        ...parsed.activationEntityIds,
        ...parsed.beliefIntents.flatMap((item) => item.holderEntityIds),
      ],
      allowedEntityIds,
    );
  }

  if (
    parsed.scarcityIntents.every(
      (item) =>
        item.existingEvidenceRefs.length === 0 &&
        item.evidenceToEstablish.length === 0,
    )
  ) {
    throw new Error("story_runtime.expectation.design_without_scarcity_path");
  }
  if (
    parsed.beliefIntents.every(
      (item) =>
        item.existingEvidenceRefs.length === 0 &&
        item.stakeToCultivate.length === 0,
    )
  ) {
    throw new Error("story_runtime.expectation.design_without_belief_path");
  }

  const withoutDigest = parsed;
  return ExpectationDesignSchema.parse({
    ...withoutDigest,
    digest: digest(withoutDigest),
  });
}

export interface ExpectationRealityFocus {
  projectId: string;
  expectationDesignDigest: string;
  priorityEntityIds: readonly string[];
  worldFocusRefs: readonly string[];
  scarcityQuestions: readonly string[];
  beliefQuestions: readonly string[];
}

/**
 * Layer 2 is designed first, but this bridge only tells Layer 1 where to look.
 * It never tells a Character Agent what decision to make or the Arbiter what
 * outcome to produce.
 */
export function realityFocusFromExpectationDesign(
  design: ExpectationDesign,
): ExpectationRealityFocus {
  return {
    projectId: design.projectId,
    expectationDesignDigest: design.digest,
    priorityEntityIds: [...new Set(design.activationEntityIds)],
    worldFocusRefs: [...new Set(design.worldFocusRefs)],
    scarcityQuestions: design.scarcityIntents.map((intent) =>
      [
        intent.claim,
        intent.evidenceToEstablish.length > 0
          ? `需要验证/建立：${intent.evidenceToEstablish.join("；")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    ),
    beliefQuestions: design.beliefIntents.map((intent) =>
      [
        intent.proposition,
        intent.stakeToCultivate.length > 0
          ? `观察人物是否会据此下注：${intent.stakeToCultivate.join("；")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    ),
  };
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
    reactionEntityIds: new Set([
      ...state.establishedBeliefs.flatMap((item) => item.holderEntityIds),
      ...state.threads.flatMap((item) => item.reactionTargetEntityIds),
    ]),
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
  if (candidate.realityFingerprint !== state.realityFingerprint) {
    throw new Error("story_runtime.expectation.allocation_stale_reality");
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
  requireRefs(
    "reaction_target_entity",
    parsed.reactionTargetEntityIds,
    refs.reactionEntityIds,
  );

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
    const payoffReactionTargets = new Set<string>();
    for (const threadId of parsed.payoffThreadIds) {
      const thread = refs.threadById.get(threadId);
      if (!thread || !["ripe", "payoff"].includes(thread.phase)) {
        throw new Error(
          `story_runtime.expectation.payoff_thread_not_ripe:${threadId}`,
        );
      }
      for (const entityId of thread.reactionTargetEntityIds) {
        payoffReactionTargets.add(entityId);
      }
    }
    requireRefs(
      "payoff_reaction_target",
      parsed.reactionTargetEntityIds,
      payoffReactionTargets,
    );
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
 * Bridge one authored S04/S05 Event into S07 Reader Time allocation.
 *
 * Every finalized character resolution becomes one speculative beat candidate
 * within the already-authored Event. This bridge does NOT decide whether a
 * random Reality event becomes Story. S04 already made that authorial choice.
 * S07 may allocate Reader Time across the realized beats, but may not rewrite
 * the event, the character intent, or the arbitration result.
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
      storyUnitDesignDigest: receipt.storyUnitDesignDigest,
      storyUnitEventId: receipt.storyUnitEventId,
      realityFingerprint: receipt.realityFingerprint,
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

/**
 * S07 Reader Time over already-authored S06 scenes.
 *
 * S07 decides presentation/release, not Reality and not Scene content. The
 * lecturer rule is continuity of expectation: layer information, avoid paying
 * every old expectation before a new one is seeded, and transfer focus after a
 * payoff instead of leaving Reader Time empty.
 */
export function finalizeStoryReaderTimePlan(
  draft: StoryReaderTimePlanDraft,
  state: ExpectationState,
  expansion: StorySceneExpansion,
): StoryReaderTimePlan {
  const parsed = StoryReaderTimePlanDraftSchema.parse(draft);
  if (
    parsed.projectId !== state.projectId ||
    parsed.projectId !== expansion.projectId ||
    parsed.expectationStateDigest !== state.digest ||
    parsed.storySceneExpansionDigest !== expansion.digest ||
    parsed.realityFingerprint !== state.realityFingerprint ||
    parsed.realityFingerprint !== expansion.realityFingerprint
  ) {
    throw new Error("story_runtime.reader_time.not_bound");
  }

  const sceneIds = expansion.scenes.map((scene) => scene.id);
  if (
    parsed.sceneIds.length !== sceneIds.length ||
    parsed.sceneIds.some((sceneId) => !sceneIds.includes(sceneId))
  ) {
    throw new Error("story_runtime.reader_time.scene_set_mismatch");
  }

  const decisionByScene = new Map(
    parsed.decisions.map((decision) => [decision.sceneId, decision]),
  );
  if (
    decisionByScene.size !== parsed.decisions.length ||
    parsed.decisions.length !== sceneIds.length
  ) {
    throw new Error("story_runtime.reader_time.incomplete_scene_decisions");
  }
  for (const sceneId of sceneIds) {
    if (!decisionByScene.has(sceneId)) {
      throw new Error(
        `story_runtime.reader_time.missing_scene_decision:${sceneId}`,
      );
    }
  }

  const orders = parsed.decisions
    .map((decision) => decision.readerOrder)
    .sort((left, right) => left - right);
  if (
    orders.some((order, index) => order !== index + 1) ||
    new Set(orders).size !== orders.length
  ) {
    throw new Error("story_runtime.reader_time.invalid_reader_order");
  }

  const refs = allocationReferenceSets(state);
  for (const decision of parsed.decisions) {
    requireRefs(
      "reader_time_expectation_thread",
      decision.expectationThreadIds,
      refs.threadIds,
    );
    requireRefs(
      "reader_time_scarcity_evidence",
      decision.deepenScarcityEvidenceIds,
      refs.scarcityIds,
    );
    requireRefs(
      "reader_time_established_belief",
      decision.reinforceBeliefIds,
      refs.beliefIds,
    );
    requireRefs(
      "reader_time_established_belief",
      decision.widenGapBeliefIds,
      refs.beliefIds,
    );
    requireRefs(
      "reader_time_payoff_thread",
      decision.payoffThreadIds,
      refs.threadIds,
    );
    requireRefs(
      "reader_time_focus_shift_thread",
      decision.focusShiftThreadIds,
      refs.threadIds,
    );
    requireRefs(
      "reader_time_reaction_target",
      decision.reactionTargetEntityIds,
      refs.reactionEntityIds,
    );

    if (decision.action === "skip" && decision.readerTime !== "none") {
      throw new Error(
        "story_runtime.reader_time.skip_requires_no_reader_time",
      );
    }
    if (
      decision.action === "background" &&
      !["mention", "beat"].includes(decision.readerTime)
    ) {
      throw new Error(
        "story_runtime.reader_time.background_reader_time_too_large",
      );
    }
    if (
      ["seed", "charge", "payoff"].includes(decision.action) &&
      decision.readerTime === "none"
    ) {
      throw new Error(
        "story_runtime.reader_time.story_action_requires_reader_time",
      );
    }
    if (
      ["seed", "charge", "payoff"].includes(decision.action) &&
      decision.expectationThreadIds.length === 0
    ) {
      throw new Error(
        "story_runtime.reader_time.story_action_requires_thread",
      );
    }

    const operations =
      decision.deepenScarcityEvidenceIds.length +
      decision.reinforceBeliefIds.length +
      decision.widenGapBeliefIds.length +
      decision.embodimentTargets.length;
    if (decision.action === "charge" && operations === 0) {
      throw new Error("story_runtime.reader_time.charge_without_operation");
    }

    if (decision.action === "payoff") {
      if (decision.payoffThreadIds.length === 0) {
        throw new Error("story_runtime.reader_time.payoff_requires_thread");
      }
      for (const threadId of decision.payoffThreadIds) {
        const thread = refs.threadById.get(threadId);
        if (!thread || !["ripe", "payoff"].includes(thread.phase)) {
          throw new Error(
            `story_runtime.reader_time.payoff_thread_not_ripe:${threadId}`,
          );
        }
      }
      if (
        decision.focusShiftThreadIds.length === 0 &&
        decision.nextExpectationSeed === null &&
        decision.terminalExpectationReason === null
      ) {
        throw new Error(
          "story_runtime.reader_time.payoff_without_expectation_bridge",
        );
      }
    } else {
      if (decision.payoffThreadIds.length > 0) {
        throw new Error(
          "story_runtime.reader_time.nonpayoff_cannot_settle_thread",
        );
      }
      if (decision.terminalExpectationReason !== null) {
        throw new Error(
          "story_runtime.reader_time.terminal_reason_requires_payoff",
        );
      }
    }
  }

  return StoryReaderTimePlanSchema.parse({
    ...parsed,
    digest: digest(parsed),
  });
}

