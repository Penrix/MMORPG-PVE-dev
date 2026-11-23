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
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  round: z.number().int().positive(),
  storyUnitDesignDigest: z.string().min(1),
  storyUnitEventId: z.string().min(1),
  agentId: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  targetOutlineNodeId: z.string().min(1).nullable(),
  currentGoal: z.string().min(1),
  goalEvidenceRefs: z.array(z.string().min(1)).min(1),
  pressure: z.string().min(1),
  authoredStoryFunction: z.string().min(1),
  authoredStakeIds: z.array(z.string().min(1)),
  authoredDirection: z.string().min(1),
  location: z.string().min(1).nullable(),
  locationEvidenceRefs: z.array(z.string().min(1)),
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
  storyUnitDesignDigest: z.string().min(1),
  storyUnitEventId: z.string().min(1),
  realityFingerprint: z.string().min(1),
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

export const WorldArbitrationContextSurfaceSchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  facet: z.string().min(1),
  slotKey: z.string().min(1),
  value: z.unknown(),
  sourceId: z.string().min(1),
});
export type WorldArbitrationContextSurface = z.infer<
  typeof WorldArbitrationContextSurfaceSchema
>;

export const WorldArbitrationContextSchema = z.object({
  version: z.literal("world-arbitration-context.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  storyUnitDesignDigest: z.string().min(1),
  storyUnitEventId: z.string().min(1),
  realityFingerprint: z.string().min(1),
  surfaces: z.array(WorldArbitrationContextSurfaceSchema).min(1),
  digest: z.string().min(1),
});
export type WorldArbitrationContext = z.infer<
  typeof WorldArbitrationContextSchema
>;
export const WorldArbitrationContextDraftSchema =
  WorldArbitrationContextSchema.omit({ digest: true });
export type WorldArbitrationContextDraft = z.infer<
  typeof WorldArbitrationContextDraftSchema
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
  butterflyEffects: z.array(StoryButterflyEffectSchema),
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
  storyUnitDesignDigest: z.string().min(1),
  storyUnitEventId: z.string().min(1),
  realityFingerprint: z.string().min(1),
  worldContextDigest: z.string().min(1),
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
export const ExpectationDesignEvidenceSchema = z.object({
  ref: z.string().min(1),
  kind: z.enum([
    "world",
    "rule",
    "people",
    "relationship",
    "resource",
    "history",
    "information",
    "reality",
    "story_state",
  ]),
  summary: z.string().min(1),
  entityIds: z.array(z.string().min(1)),
});
export type ExpectationDesignEvidence = z.infer<
  typeof ExpectationDesignEvidenceSchema
>;

export const ExpectationScarcityIntentSchema = z.object({
  claim: z.string().min(1),
  subjectRef: z.string().min(1).nullable(),
  existingEvidenceRefs: z.array(z.string().min(1)),
  evidenceToEstablish: z.array(z.string().min(1)),
});
export type ExpectationScarcityIntent = z.infer<
  typeof ExpectationScarcityIntentSchema
>;

export const ExpectationBeliefIntentSchema = z.object({
  proposition: z.string().min(1),
  scope: z.enum(["world", "circle", "identity", "character"]),
  holderEntityIds: z.array(z.string().min(1)),
  existingEvidenceRefs: z.array(z.string().min(1)),
  stakeToCultivate: z.array(z.string().min(1)),
  breakCondition: z.string().min(1),
});
export type ExpectationBeliefIntent = z.infer<
  typeof ExpectationBeliefIntentSchema
>;

export const ExpectationDesignSchema = z.object({
  version: z.literal("expectation-design.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  protagonistId: z.string().min(1),
  readerNeed: z.string().min(1),
  targetEmotion: z.string().min(1),
  targetOutcome: z.string().min(1),
  scarcityIntents: z.array(ExpectationScarcityIntentSchema).min(1),
  beliefIntents: z.array(ExpectationBeliefIntentSchema).min(1),
  protagonistAdvantageRefs: z.array(z.string().min(1)).min(1),
  reactionTargetEntityIds: z.array(z.string().min(1)),
  retainedGainTarget: z.string().min(1).nullable(),
  activationEntityIds: z.array(z.string().min(1)),
  worldFocusRefs: z.array(z.string().min(1)),
  designReasons: z.array(z.string().min(1)).min(1),
  realityFingerprint: z.string().min(1),
  storyStateFingerprint: z.string().min(1),
  directorMayDesignReactionPayoff: z.literal(true),
  mustGroundPerformanceInCharacterization: z.literal(true),
  digest: z.string().min(1),
});
export type ExpectationDesign = z.infer<typeof ExpectationDesignSchema>;
export const ExpectationDesignDraftSchema = ExpectationDesignSchema.omit({
  digest: true,
});
export type ExpectationDesignDraft = z.infer<
  typeof ExpectationDesignDraftSchema
>;

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
export type ReaderKnowledgeLevel = z.infer<typeof ReaderKnowledgeLevelSchema>;

export const ProtagonistAdvantageSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  readerKnowledge: ReaderKnowledgeLevelSchema,
  knownByEntityIds: z.array(z.string().min(1)),
  contradictsBeliefIds: z.array(z.string().min(1)).min(1),
});
export type ProtagonistAdvantage = z.infer<typeof ProtagonistAdvantageSchema>;

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
export type ExpectationStateDraft = z.infer<typeof ExpectationStateDraftSchema>;

export const NarrativeCandidateSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  generationId: z.string().min(1),
  storyUnitDesignDigest: z.string().min(1),
  storyUnitEventId: z.string().min(1),
  realityFingerprint: z.string().min(1),
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
export type ReaderTimeAllocation = z.infer<typeof ReaderTimeAllocationSchema>;

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

/**
 * Author-side object-grounded story search.
 *
 * This layer projects concrete Module-2 world objects for imagination. It is
 * not a second Reality store and never promotes candidates into Canon.
 */
export const StoryAuthoringScaleSchema = z.enum(["S01", "S02", "S03", "S04"]);
export type StoryAuthoringScale = z.infer<typeof StoryAuthoringScaleSchema>;

export const StoryObjectSurfaceSchema = z.object({
  authority: z.enum(["confirmed", "reference"]),
  sourceId: z.string().min(1),
  facet: z.string().min(1),
  slotKey: z.string().min(1),
  value: z.unknown(),
});
export type StoryObjectSurface = z.infer<typeof StoryObjectSurfaceSchema>;

export const StoryObjectFieldObjectSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  surfaces: z.array(StoryObjectSurfaceSchema).min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
});
export type StoryObjectFieldObject = z.infer<
  typeof StoryObjectFieldObjectSchema
>;

export const StoryObjectFieldSchema = z.object({
  version: z.literal("story-object-field.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  scale: StoryAuthoringScaleSchema,
  storyTimeLabel: z.string().min(1).nullable(),
  realityFingerprint: z.string().min(1),
  storyStateFingerprint: z.string().min(1),
  objects: z.array(StoryObjectFieldObjectSchema).min(1),
  digest: z.string().min(1),
});
export type StoryObjectField = z.infer<typeof StoryObjectFieldSchema>;
export const StoryObjectFieldDraftSchema = StoryObjectFieldSchema.omit({
  digest: true,
});
export type StoryObjectFieldDraft = z.infer<typeof StoryObjectFieldDraftSchema>;

export const StoryWorldGapSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "missing_object",
    "missing_relation",
    "missing_state",
    "missing_rule",
    "missing_access",
    "missing_value",
    "missing_activity",
  ]),
  anchorObjectIds: z.array(z.string().min(1)),
  need: z.string().min(1),
  reason: z.string().min(1),
  productionHint: z.enum([
    "geography",
    "factions",
    "people",
    "economy",
    "power",
    "events",
    "social",
    "playability",
    "living",
  ]),
  status: z.literal("OPEN"),
});
export type StoryWorldGap = z.infer<typeof StoryWorldGapSchema>;

export const StoryCandidateNewObjectSchema = z.object({
  label: z.string().min(1),
  kind: z.string().min(1),
  reason: z.string().min(1),
  status: z.literal("CANDIDATE"),
});
export type StoryCandidateNewObject = z.infer<
  typeof StoryCandidateNewObjectSchema
>;

export const StoryOpportunitySeedSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  anchorObjectIds: z.array(z.string().min(1)).min(1),
  groundingSurfaceRefs: z.array(z.string().min(1)).min(1),
  observation: z.string().min(1),
  searchMove: z.string().min(1),
  idea: z.string().min(1),
  protagonistHook: z.string().min(1),
  readerValue: z.string().min(1),
  newRelationOrChange: z.string().min(1),
  candidateNewObjects: z.array(StoryCandidateNewObjectSchema),
  nextQuestion: z.string().min(1),
  status: z.literal("CANDIDATE"),
});
export type StoryOpportunitySeed = z.infer<typeof StoryOpportunitySeedSchema>;

export const StoryObjectFocusSchema = z.object({
  objectId: z.string().min(1),
  surfaceRefs: z.array(z.string().min(1)).min(1),
  whyNow: z.string().min(1),
  valuableSurface: z.string().min(1),
});
export type StoryObjectFocus = z.infer<typeof StoryObjectFocusSchema>;

export const S01StoryConceptCandidateSchema = z.object({
  id: z.string().min(1),
  concept: z.string().min(1),
  objectIds: z.array(z.string().min(1)).min(1),
  life: z.string().min(1),
  readerValue: z.string().min(1),
});
export type S01StoryConceptCandidate = z.infer<
  typeof S01StoryConceptCandidateSchema
>;

export const S01StoryEngineCandidateSchema = z.object({
  id: z.string().min(1),
  engine: z.string().min(1),
  objectIds: z.array(z.string().min(1)).min(1),
  repeatablePlay: z.string().min(1),
  supply: z.string().min(1),
});
export type S01StoryEngineCandidate = z.infer<
  typeof S01StoryEngineCandidateSchema
>;

export const S01ConceptEngineLinkSchema = z.object({
  conceptId: z.string().min(1),
  engineId: z.string().min(1),
  whySustainable: z.string().min(1),
});
export type S01ConceptEngineLink = z.infer<typeof S01ConceptEngineLinkSchema>;

export const S01StorySearchResultSchema = z.object({
  scale: z.literal("S01"),
  storyConcepts: z.array(S01StoryConceptCandidateSchema),
  storyEngines: z.array(S01StoryEngineCandidateSchema),
  conceptEngineLinks: z.array(S01ConceptEngineLinkSchema),
});
export type S01StorySearchResult = z.infer<typeof S01StorySearchResultSchema>;

export const S02StageOpportunitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objectIds: z.array(z.string().min(1)).min(1),
  whyNow: z.string().min(1),
  newLife: z.string().min(1),
  candidateS1: z.string().min(1),
  unlockedObjects: z.array(z.string().min(1)),
  status: z.literal("CANDIDATE"),
});
export type S02StageOpportunity = z.infer<typeof S02StageOpportunitySchema>;

export const S02StorySearchResultSchema = z.object({
  scale: z.literal("S02"),
  currentS0: z.string().min(1),
  stageOpportunities: z.array(S02StageOpportunitySchema),
});
export type S02StorySearchResult = z.infer<typeof S02StorySearchResultSchema>;

export const S03OpportunityFieldItemSchema = z.object({
  objectIds: z.array(z.string().min(1)).min(1),
  opportunity: z.string().min(1),
  whyAlive: z.string().min(1),
});
export type S03OpportunityFieldItem = z.infer<
  typeof S03OpportunityFieldItemSchema
>;

export const S03StoryMovementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objectIds: z.array(z.string().min(1)).min(1),
  state: z.enum(["主导", "预热", "暂休", "余韵", "OPEN"]),
  currentMotion: z.string().min(1),
  nextPressure: z.string().min(1),
});
export type S03StoryMovement = z.infer<typeof S03StoryMovementSchema>;

export const S03StorySearchResultSchema = z.object({
  scale: z.literal("S03"),
  periodFocus: z.string().min(1),
  opportunityField: z.array(S03OpportunityFieldItemSchema),
  storyMovements: z.array(S03StoryMovementSchema),
});
export type S03StorySearchResult = z.infer<typeof S03StorySearchResultSchema>;

export const StoryScaleSearchResultSchema = z.discriminatedUnion("scale", [
  S01StorySearchResultSchema,
  S02StorySearchResultSchema,
  S03StorySearchResultSchema,
]);
export type StoryScaleSearchResult = z.infer<
  typeof StoryScaleSearchResultSchema
>;

export const StoryAuthoringSearchSchema = z.object({
  version: z.literal("story-authoring-search.v1"),
  authority: z.literal("speculative"),
  status: z.enum(["READY", "BLOCKED_WORLD_GAP"]),
  projectId: z.string().min(1),
  scale: z.enum(["S01", "S02", "S03"]),
  objectFieldDigest: z.string().min(1),
  creativeContextDigest: z.string().min(1),
  question: z.string().min(1),
  objectFocus: z.array(StoryObjectFocusSchema),
  seeds: z.array(StoryOpportunitySeedSchema),
  worldGaps: z.array(StoryWorldGapSchema),
  scaleResult: StoryScaleSearchResultSchema,
  digest: z.string().min(1),
});
export type StoryAuthoringSearch = z.infer<typeof StoryAuthoringSearchSchema>;
export const StoryAuthoringSearchDraftSchema = StoryAuthoringSearchSchema.omit({
  digest: true,
});
export type StoryAuthoringSearchDraft = z.infer<
  typeof StoryAuthoringSearchDraftSchema
>;

export const StoryUnitCampPositionSchema = z.enum([
  "友方",
  "敌方",
  "中立",
  "其他利益位置",
]);
export type StoryUnitCampPosition = z.infer<typeof StoryUnitCampPositionSchema>;

export const StoryUpgradeStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  targetGain: z.string().min(1),
  gate: z.string().min(1),
  targetCircle: z.string().min(1),
});
export type StoryUpgradeStep = z.infer<typeof StoryUpgradeStepSchema>;

export const StoryUpgradeLedgerSchema = z.object({
  protagonistEntityId: z.string().min(1),
  road: z.string().min(1),
  currentStepId: z.string().min(1),
  currentPosition: z.string().min(1),
  stageGoal: z.string().min(1),
  settlementTarget: z.string().min(1),
  steps: z.array(StoryUpgradeStepSchema).min(1),
});
export type StoryUpgradeLedger = z.infer<typeof StoryUpgradeLedgerSchema>;

export const StoryStakeStateSchema = z.enum([
  "seeded",
  "committed",
  "escalating",
  "ripe",
  "settled",
]);
export type StoryStakeState = z.infer<typeof StoryStakeStateSchema>;

export const StoryStakeLedgerEntrySchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  currentBelief: z.string().min(1),
  currentInterest: z.string().min(1),
  stakeAction: z.string().min(1),
  stakeAssets: z.array(z.string().min(1)).min(1),
  commitmentCost: z.string().min(1),
  escalationPlan: z.string().min(1),
  payoffReaction: z.string().min(1),
  settlementChange: z.string().min(1),
  state: StoryStakeStateSchema,
});
export type StoryStakeLedgerEntry = z.infer<typeof StoryStakeLedgerEntrySchema>;

export const StoryUnitCampMemberSchema = z.object({
  entityId: z.string().min(1),
  camp: StoryUnitCampPositionSchema,
  currentGoal: z.string().min(1),
  storyRole: z.string().min(1),
  currentBelief: z.string().min(1),
  currentInterest: z.string().min(1),
});
export type StoryUnitCampMember = z.infer<typeof StoryUnitCampMemberSchema>;

export const StoryUnitReactionTargetSchema = z.object({
  entityId: z.string().min(1),
  before: z.string().min(1),
  during: z.string().min(1),
  after: z.string().min(1),
});
export type StoryUnitReactionTarget = z.infer<
  typeof StoryUnitReactionTargetSchema
>;

export const StoryUnitCampTransitionSchema = z.object({
  entityId: z.string().min(1),
  from: StoryUnitCampPositionSchema,
  to: StoryUnitCampPositionSchema,
  condition: z.string().min(1),
});
export type StoryUnitCampTransition = z.infer<
  typeof StoryUnitCampTransitionSchema
>;

export const StoryUnitInformationReleaseSchema = z.object({
  step: z.number().int().positive(),
  readerKnows: z.string().min(1),
  charactersKnow: z.string().min(1),
  withheld: z.string().min(1),
  purpose: z.string().min(1),
});
export type StoryUnitInformationRelease = z.infer<
  typeof StoryUnitInformationReleaseSchema
>;

export const StoryUnitActorPressureSchema = z.object({
  entityId: z.string().min(1),
  pressure: z.string().min(1),
});
export type StoryUnitActorPressure = z.infer<
  typeof StoryUnitActorPressureSchema
>;

export const StoryNodePhaseSchema = z.enum(["before", "during", "after"]);
export type StoryNodePhase = z.infer<typeof StoryNodePhaseSchema>;

export const StoryNodePhaseTargetSchema = z.object({
  phase: StoryNodePhaseSchema,
  entityIds: z.array(z.string().min(1)).min(1),
  authorIntent: z.string().min(1),
  expectationMovement: z.string().min(1),
});
export type StoryNodePhaseTarget = z.infer<typeof StoryNodePhaseTargetSchema>;

/**
 * S05 Story Node.
 *
 * The event is an authored problem-node that can expand into multiple S06
 * scenes. Character Agent + World Arbiter are a Reality rehearsal inside this
 * node; they are not the definition of S05 itself.
 */
export const StoryUnitEventDesignSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  problem: z.string().min(1),
  storyPressure: z.string().min(1),
  castPoolEntityIds: z.array(z.string().min(1)).min(1),
  activeSeedEntityIds: z.array(z.string().min(1)).min(1),
  actorPressures: z.array(StoryUnitActorPressureSchema).min(1),
  stakeEntryIds: z.array(z.string().min(1)),
  reactionTargetEntityIds: z.array(z.string().min(1)),
  informationReleaseSteps: z.array(z.number().int().positive()),
  phaseTargets: z.array(StoryNodePhaseTargetSchema).min(1),
  realityQuestion: z.string().min(1),
  observableStart: z.string().min(1),
  expectedChange: z.string().min(1),
  readerExpectation: z.string().min(1),
});
export type StoryUnitEventDesign = z.infer<typeof StoryUnitEventDesignSchema>;

export const StoryScenePlanSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  phase: StoryNodePhaseSchema,
  title: z.string().min(1),
  participantEntityIds: z.array(z.string().min(1)).min(1),
  locationObjectId: z.string().min(1).nullable(),
  localProblem: z.string().min(1),
  pressure: z.string().min(1),
  observableStart: z.string().min(1),
  interaction: z.string().min(1),
  informationMove: z.string().min(1),
  expectationMove: z.string().min(1),
  projectedRealityUse: z.string().min(1),
  endState: z.string().min(1),
  nextSceneCause: z.string().min(1).nullable(),
});
export type StoryScenePlan = z.infer<typeof StoryScenePlanSchema>;

export const StorySceneExpansionSchema = z.object({
  version: z.literal("story-scene-expansion.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  storyUnitDesignDigest: z.string().min(1),
  storyUnitEventId: z.string().min(1),
  arbitrationDigest: z.string().min(1),
  realityFingerprint: z.string().min(1),
  eventProblem: z.string().min(1),
  scenes: z.array(StoryScenePlanSchema).min(1),
  digest: z.string().min(1),
});
export type StorySceneExpansion = z.infer<typeof StorySceneExpansionSchema>;
export const StorySceneExpansionDraftSchema = StorySceneExpansionSchema.omit({
  digest: true,
});
export type StorySceneExpansionDraft = z.infer<
  typeof StorySceneExpansionDraftSchema
>;

export const StoryReaderTimeSceneDecisionSchema = z.object({
  sceneId: z.string().min(1),
  readerOrder: z.number().int().positive(),
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
  informationReleased: z.string().min(1),
  informationWithheld: z.string().min(1),
  focusShiftThreadIds: z.array(z.string().min(1)),
  nextExpectationSeed: z.string().min(1).nullable(),
  terminalExpectationReason: z.string().min(1).nullable(),
  chapterBoundary: z.enum(["continue", "soft_cut", "chapter_end"]),
});
export type StoryReaderTimeSceneDecision = z.infer<
  typeof StoryReaderTimeSceneDecisionSchema
>;

export const StoryReaderTimePlanSchema = z.object({
  version: z.literal("story-reader-time-plan.v1"),
  authority: z.literal("speculative"),
  projectId: z.string().min(1),
  expectationStateDigest: z.string().min(1),
  storySceneExpansionDigest: z.string().min(1),
  realityFingerprint: z.string().min(1),
  sceneIds: z.array(z.string().min(1)).min(1),
  decisions: z.array(StoryReaderTimeSceneDecisionSchema).min(1),
  digest: z.string().min(1),
});
export type StoryReaderTimePlan = z.infer<typeof StoryReaderTimePlanSchema>;
export const StoryReaderTimePlanDraftSchema = StoryReaderTimePlanSchema.omit({
  digest: true,
});
export type StoryReaderTimePlanDraft = z.infer<
  typeof StoryReaderTimePlanDraftSchema
>;

export const StoryUnitDesignSchema = z.object({
  version: z.literal("story-unit-design.v1"),
  authority: z.literal("speculative"),
  status: z.enum(["READY", "BLOCKED_WORLD_GAP"]),
  projectId: z.string().min(1),
  objectFieldDigest: z.string().min(1),
  creativeContextDigest: z.string().min(1),
  sourceSeedIds: z.array(z.string().min(1)),
  expectationDesignDigest: z.string().min(1),
  objectAnchorIds: z.array(z.string().min(1)),
  groundingSurfaceRefs: z.array(z.string().min(1)),
  storyProblem: z.string().min(1),
  worldGaps: z.array(StoryWorldGapSchema),
  upgradeLedger: StoryUpgradeLedgerSchema,
  campNetwork: z.array(StoryUnitCampMemberSchema),
  stakeLedger: z.array(StoryStakeLedgerEntrySchema),
  reactionTargets: z.array(StoryUnitReactionTargetSchema),
  campTransitions: z.array(StoryUnitCampTransitionSchema),
  appearanceOrderEntityIds: z.array(z.string().min(1)),
  informationRelease: z.array(StoryUnitInformationReleaseSchema),
  events: z.array(StoryUnitEventDesignSchema),
  directorAuthority: z.literal("author-defined-story-line"),
  characterExecutionRule: z.literal("characterization-constrained-performance"),
  digest: z.string().min(1),
});
export type StoryUnitDesign = z.infer<typeof StoryUnitDesignSchema>;
export const StoryUnitDesignDraftSchema = StoryUnitDesignSchema.omit({
  digest: true,
});
export type StoryUnitDesignDraft = z.infer<typeof StoryUnitDesignDraftSchema>;
