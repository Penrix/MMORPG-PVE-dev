/* Actual upstream MIT-licensed source. Source: https://github.com/JeanDes-Code/sneq-narrative-system/blob/main/src/domain/observation.ts
 * Original blob: 99f450965d1c823d77dbeb5631c18818307db255. See THIRD_PARTY_NOTICES.md.
 */
import type { EntityID, SceneId } from "./ids.js";

export type ObservationSource =
  | "GM_NARRATION"
  | "PLAYER_UTTERANCE"
  | "DICE_ROLL"
  | "SYSTEM"
  /** Confirmed by the human, outside the fiction (#22) — the sanctioned
   *  reconstruction route. Warranted; counted by `doctor`, never silent. */
  | "OUT_OF_BAND";

export type ObservationMethod =
  | "DIALOGUE_DIRECT"
  | "DOCUMENT"
  | "OBSERVATION_VISUELLE"
  | "DEDUCTION_CONFIRMEE"
  | "AVEU"
  | "DEMONSTRATION";

/**
 * Reliability vocabulary. Lives on Belief (derived, §2.5) — deleted from
 * Observation itself (#18): provenance says where a claim came from, never
 * how much a holder should trust it.
 */
export type Fiabilite = "CERTAINE" | "TEMOIGNAGE" | "RUMEUR_CONFIRMEE";

/** Provenance ONLY (#18). The tool boundary rejects a stray `fiabilite` key. */
export interface Observation {
  source: ObservationSource;
  method: ObservationMethod;
  emittedBy?: EntityID;
  sceneId?: SceneId;
  excerpt?: string;
  timestamp: number;
}
