import { z } from "zod";

export const StoryRuntimeAuthoritySchema = z.enum([
  "confirmed",
  "reference",
  "speculative",
]);
export type StoryRuntimeAuthority = z.infer<typeof StoryRuntimeAuthoritySchema>;

export const StoryEventSourceSchema = z.enum([
  "actor_initiative",
  "world_initiative",
  "director_catalyst",
]);
export type StoryEventSource = z.infer<typeof StoryEventSourceSchema>;

export const CharacterObservationEvidenceKindSchema = z.enum([
  "fact",
  "relationship",
  "event",
  "knowledge",
  "rule",
  "resource",
  "memory",
  "state",
]);
export type CharacterObservationEvidenceKind = z.infer<
  typeof CharacterObservationEvidenceKindSchema
>;

export const CharacterObservationEvidenceSchema = z.object({
  id: z.string().min(1),
  kind: CharacterObservationEvidenceKindSchema,
  text: z.string().min(1),
  sourceType: z.string().min(1),
  visibility: z.string().min(1).nullable().optional(),
});
export type CharacterObservationEvidence = z.infer<
  typeof CharacterObservationEvidenceSchema
>;

export const CharacterObservationPacketSchema = z.object({
  version: z.literal("character-observation.v1"),
  authority: z.literal("confirmed"),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  round: z.number().int().positive(),
  agentId: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  targetOutlineNodeId: z.string().min(1).nullable(),
  currentGoal: z.string().min(1),
  pressure: z.string().min(1),
  location: z.string().min(1).nullable(),
  resources: z.array(z.string().min(1)),
  relationships: z.array(CharacterObservationEvidenceSchema),
  knownFacts: z.array(CharacterObservationEvidenceSchema),
  perceivedEvents: z.array(CharacterObservationEvidenceSchema),
  memory: z.array(CharacterObservationEvidenceSchema),
  storyStateFingerprint: z.string().min(1),
  realityFingerprint: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  digest: z.string().min(1),
});
export type CharacterObservationPacket = z.infer<
  typeof CharacterObservationPacketSchema
>;
export const CharacterObservationPacketDraftSchema =
  CharacterObservationPacketSchema.omit({ digest: true });
export type CharacterObservationPacketDraft = z.infer<
  typeof CharacterObservationPacketDraftSchema
>;

export const CharacterActionProposalSchema = z.object({
  version: z.literal("character-action-proposal.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  round: z.number().int().positive(),
  agentId: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  observationDigest: z.string().min(1),
  location: z.string().min(1).nullable(),
  currentGoal: z.string().min(1),
  pressure: z.string().min(1),
  resources: z.array(z.string().min(1)),
  availableOptions: z.array(z.string().min(1)).min(2),
  rejectedOptions: z.array(z.string().min(1)),
  decision: z.string().min(1),
  decisionReason: z.string().min(1),
  intendedAction: z.string().min(1),
  actionDuration: z.string().min(1),
  knowledgeRefs: z.array(z.string().min(1)).min(1),
  resourceClaims: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
  contingencies: z.array(z.string().min(1)),
  expectedConsequences: z.array(z.string().min(1)),
  submittedAt: z.string().min(1).nullable(),
  digest: z.string().min(1),
});
export type CharacterActionProposal = z.infer<
  typeof CharacterActionProposalSchema
>;
export const CharacterActionProposalDraftSchema =
  CharacterActionProposalSchema.omit({ digest: true });
export type CharacterActionProposalDraft = z.infer<
  typeof CharacterActionProposalDraftSchema
>;

export const WorldArbitrationConflictKindSchema = z.enum([
  "time",
  "location",
  "resource",
  "rule",
  "knowledge",
  "collision",
]);
export type WorldArbitrationConflictKind = z.infer<
  typeof WorldArbitrationConflictKindSchema
>;

export const WorldArbitrationConflictSchema = z.object({
  id: z.string().min(1),
  kind: WorldArbitrationConflictKindSchema,
  affectedAgentIds: z.array(z.string().min(1)).min(1),
  feedback: z.string().min(1),
  resolved: z.boolean(),
});
export type WorldArbitrationConflict = z.infer<
  typeof WorldArbitrationConflictSchema
>;

export const StoryButterflyEffectSchema = z.object({
  effect: z.string().min(1),
  transmissionPath: z.string().min(1),
  arrivalHorizon: z.number().int().nonnegative(),
  protagonistImpact: z.string().min(1),
});
export type StoryButterflyEffect = z.infer<typeof StoryButterflyEffectSchema>;

export const CharacterDecisionResolutionSchema = z.object({
  agentId: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  proposalDigest: z.string().min(1),
  decision: z.string().min(1),
  intendedAction: z.string().min(1),
  actionOrder: z.number().int().positive(),
  outcome: z.enum(["success", "partial", "blocked"]),
  immediateResult: z.string().min(1),
  stateAfter: z.string().min(1),
  butterflyEffects: z.array(StoryButterflyEffectSchema).min(1),
  conflictIds: z.array(z.string().min(1)),
});
export type CharacterDecisionResolution = z.infer<
  typeof CharacterDecisionResolutionSchema
>;

export const ProtagonistProjectionSchema = z.object({
  characterId: z.string().min(1),
  chosenDecision: z.string().min(1),
  availableOptions: z.array(z.string().min(1)).min(2),
  decisionReason: z.string().min(1),
  planConstraints: z.array(z.string().min(1)).min(1),
  causalChain: z.array(z.string().min(1)).min(1),
});
export type ProtagonistProjection = z.infer<typeof ProtagonistProjectionSchema>;

export const WorldArbitrationReceiptSchema = z.object({
  version: z.literal("world-arbitration-receipt.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  round: z.number().int().positive(),
  proposalDigests: z.array(z.string().min(1)).min(1),
  resolutions: z.array(CharacterDecisionResolutionSchema).min(1),
  conflicts: z.array(WorldArbitrationConflictSchema),
  hardContractStatus: z.enum(["feasible", "infeasible"]),
  hardContractConflicts: z.array(z.string().min(1)),
  protagonistProjection: ProtagonistProjectionSchema.nullable(),
  finalized: z.boolean(),
  generatedAt: z.string().min(1).nullable(),
  digest: z.string().min(1),
});
export type WorldArbitrationReceipt = z.infer<
  typeof WorldArbitrationReceiptSchema
>;
export const WorldArbitrationReceiptDraftSchema =
  WorldArbitrationReceiptSchema.omit({ digest: true });
export type WorldArbitrationReceiptDraft = z.infer<
  typeof WorldArbitrationReceiptDraftSchema
>;

export const SpeculativeRealityMutationSchema = z.object({
  agentId: z.string().min(1),
  characterId: z.string().min(1),
  outcome: z.enum(["success", "partial", "blocked"]),
  stateAfter: z.string().min(1),
  effects: z.array(StoryButterflyEffectSchema),
});
export type SpeculativeRealityMutation = z.infer<
  typeof SpeculativeRealityMutationSchema
>;

export const SpeculativeRealityDeltaSchema = z.object({
  version: z.literal("speculative-reality-delta.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  arbitrationDigest: z.string().min(1),
  mutations: z.array(SpeculativeRealityMutationSchema),
  warning: z.literal(
    "Simulation only. Do not write to Canon; manuscript Settlement remains the accepted write path.",
  ),
  digest: z.string().min(1),
});
export type SpeculativeRealityDelta = z.infer<
  typeof SpeculativeRealityDeltaSchema
>;

export const HorizonForecastSchema = z.object({
  horizon: z.number().int().positive(),
  assumptions: z.array(z.string().min(1)),
  conditionalForecast: z.string().min(1),
  causalLinks: z.array(z.string().min(1)),
  timeResourceChecks: z.array(z.string().min(1)),
});
export type HorizonForecast = z.infer<typeof HorizonForecastSchema>;

export const HorizonRehearsalSchema = z.object({
  version: z.literal("horizon-rehearsal.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  baseRealityFingerprint: z.string().min(1),
  forecasts: z.array(HorizonForecastSchema).min(1),
  hardContractChecks: z.array(z.string().min(1)),
  unresolvedItems: z.array(z.string().min(1)),
  readyForDetail: z.boolean(),
  digest: z.string().min(1),
});
export type HorizonRehearsal = z.infer<typeof HorizonRehearsalSchema>;

export const NarrativeDirectorCandidateSchema = z.object({
  version: z.literal("narrative-director-candidate.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  source: StoryEventSourceSchema,
  targetEmotion: z.string().min(1),
  activatedEntityIds: z.array(z.string().min(1)),
  pressure: z.string().min(1),
  opportunity: z.string().min(1).nullable(),
  readerValue: z.string().min(1),
  retainedGainTarget: z.string().min(1).nullable(),
  mustNotRewriteIntent: z.literal(true),
});
export type NarrativeDirectorCandidate = z.infer<
  typeof NarrativeDirectorCandidateSchema
>;


/**
 * Module 3 layer-2 expectation runtime.
 *
 * These contracts deliberately model evidence, shared/established cognition and
 * Reader-visible expectation gaps. They MUST NOT be collapsed into numeric
 * "scarcity" or "excitement" scores.
 */
export const ScarcityEvidenceKindSchema = z.enum([
  "rule",
  "barrier",
  "cost",
  "failure_history",
  "authority_judgment",
  "social_price",
  "comparison",
  "access",
  "historical_case",
]);
export type ScarcityEvidenceKind = z.infer<typeof ScarcityEvidenceKindSchema>;

export const ScarcityEvidenceSchema = z.object({
  id: z.string().min(1),
  kind: ScarcityEvidenceKindSchema,
  claim: z.string().min(1),
  subjectRef: z.string().min(1).nullable(),
  sourceRefs: z.array(z.string().min(1)).min(1),
});
export type ScarcityEvidence = z.infer<typeof ScarcityEvidenceSchema>;

export const EstablishedBeliefScopeSchema = z.enum([
  "world",
  "circle",
  "identity",
  "character",
]);
export type EstablishedBeliefScope = z.infer<
  typeof EstablishedBeliefScopeSchema
>;

export const EstablishedBeliefStatusSchema = z.enum([
  "emerging",
  "established",
  "hardened",
]);
export type EstablishedBeliefStatus = z.infer<
  typeof EstablishedBeliefStatusSchema
>;

export const EstablishedBeliefSchema = z.object({
  id: z.string().min(1),
  proposition: z.string().min(1),
  scope: EstablishedBeliefScopeSchema,
  holderEntityIds: z.array(z.string().min(1)),
  supportingScarcityEvidenceIds: z.array(z.string().min(1)),
  supportingEvidenceRefs: z.array(z.string().min(1)).min(1),
  actionStakeRefs: z.array(z.string().min(1)),
  status: EstablishedBeliefStatusSchema,
  breakCondition: z.string().min(1),
});
export type EstablishedBelief = z.infer<typeof EstablishedBeliefSchema>;

export const ReaderKnowledgeLevelSchema = z.enum([
  "hidden",
  "partial",
  "known",
]);
export type ReaderKnowledgeLevel = z.infer<
  typeof ReaderKnowledgeLevelSchema
>;

export const ProtagonistAdvantageSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  readerKnowledge: ReaderKnowledgeLevelSchema,
  knownByEntityIds: z.array(z.string().min(1)),
  contradictsBeliefIds: z.array(z.string().min(1)).min(1),
});
export type ProtagonistAdvantage = z.infer<
  typeof ProtagonistAdvantageSchema
>;

export const ExpectationThreadPhaseSchema = z.enum([
  "seeding",
  "charging",
  "ripe",
  "payoff",
  "settled",
]);
export type ExpectationThreadPhase = z.infer<
  typeof ExpectationThreadPhaseSchema
>;

export const ExpectationThreadSchema = z.object({
  id: z.string().min(1),
  readerNeed: z.string().min(1),
  targetEmotion: z.string().min(1),
  targetOutcome: z.string().min(1),
  scarcityEvidenceIds: z.array(z.string().min(1)),
  establishedBeliefIds: z.array(z.string().min(1)),
  protagonistAdvantageIds: z.array(z.string().min(1)),
  readerKnowledgeSummary: z.string().min(1),
  payoffCondition: z.string().min(1),
  reactionTargetEntityIds: z.array(z.string().min(1)),
  retainedGainTarget: z.string().min(1).nullable(),
  phase: ExpectationThreadPhaseSchema,
});
export type ExpectationThread = z.infer<typeof ExpectationThreadSchema>;

export const ExpectationStateSchema = z.object({
  version: z.literal("expectation-state.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  targetEmotion: z.string().min(1),
  readerNeed: z.string().min(1),
  scarcityEvidence: z.array(ScarcityEvidenceSchema),
  establishedBeliefs: z.array(EstablishedBeliefSchema),
  protagonistAdvantages: z.array(ProtagonistAdvantageSchema),
  threads: z.array(ExpectationThreadSchema),
  realityFingerprint: z.string().min(1),
  storyStateFingerprint: z.string().min(1),
  digest: z.string().min(1),
});
export type ExpectationState = z.infer<typeof ExpectationStateSchema>;
export const ExpectationStateDraftSchema = ExpectationStateSchema.omit({
  digest: true,
});
export type ExpectationStateDraft = z.infer<
  typeof ExpectationStateDraftSchema
>;

export const NarrativeCandidateSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  source: StoryEventSourceSchema,
  authority: StoryRuntimeAuthoritySchema,
  summary: z.string().min(1),
  involvedEntityIds: z.array(z.string().min(1)),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  effects: z.array(z.string().min(1)),
  originDigest: z.string().min(1).nullable(),
});
export type NarrativeCandidate = z.infer<typeof NarrativeCandidateSchema>;

export const NarrativeAllocationActionSchema = z.enum([
  "skip",
  "background",
  "seed",
  "charge",
  "payoff",
]);
export type NarrativeAllocationAction = z.infer<
  typeof NarrativeAllocationActionSchema
>;

export const ReaderTimeAllocationSchema = z.enum([
  "none",
  "mention",
  "beat",
  "scene",
  "chapter",
]);
export type ReaderTimeAllocation = z.infer<
  typeof ReaderTimeAllocationSchema
>;

export const NarrativeAllocationDecisionSchema = z.object({
  version: z.literal("narrative-allocation.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  candidateId: z.string().min(1),
  action: NarrativeAllocationActionSchema,
  readerTime: ReaderTimeAllocationSchema,
  expectationThreadIds: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1)).min(1),
  deepenScarcityEvidenceIds: z.array(z.string().min(1)),
  reinforceBeliefIds: z.array(z.string().min(1)),
  widenGapBeliefIds: z.array(z.string().min(1)),
  embodimentTargets: z.array(z.string().min(1)),
  payoffThreadIds: z.array(z.string().min(1)),
  reactionTargetEntityIds: z.array(z.string().min(1)),
  retainedGainOpportunity: z.string().min(1).nullable(),
  mustPreserveReality: z.literal(true),
  mustNotRewriteIntent: z.literal(true),
  digest: z.string().min(1),
});
export type NarrativeAllocationDecision = z.infer<
  typeof NarrativeAllocationDecisionSchema
>;
export const NarrativeAllocationDecisionDraftSchema =
  NarrativeAllocationDecisionSchema.omit({ digest: true });
export type NarrativeAllocationDecisionDraft = z.infer<
  typeof NarrativeAllocationDecisionDraftSchema
>;

export const NarrativeAllocationBatchSchema = z.object({
  version: z.literal("narrative-allocation-batch.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  expectationStateDigest: z.string().min(1),
  candidateIds: z.array(z.string().min(1)).min(1),
  decisions: z.array(NarrativeAllocationDecisionSchema).min(1),
  selectedCandidateIds: z.array(z.string().min(1)),
  digest: z.string().min(1),
});
export type NarrativeAllocationBatch = z.infer<
  typeof NarrativeAllocationBatchSchema
>;
