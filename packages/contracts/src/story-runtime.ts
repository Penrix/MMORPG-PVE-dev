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
