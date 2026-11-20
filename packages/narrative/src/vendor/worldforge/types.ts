/** A narrow data-surface adapter for upstream WorldForge simulation algorithms.
 * Source types: Fange12306/worldforge/src/lib/simulation/types.ts (MIT).
 * A WorldForge SimulationSession here is a read-only event history projection,
 * NOT a second store of accepted NarraLume Canon.
 */
export type DimensionKind = "tech" | "value";
export type DimensionDef = {
  name: string;
  kind: DimensionKind;
  potential: number;
  weight: number;
  description?: string;
  first_tick: number;
  last_active: number;
};
export type DimensionRegistry = {
  dims: Record<string, DimensionDef>;
  history: Array<{
    tick: number;
    action: "register" | "promote" | "demote" | "retire";
    dim: string;
    reason: string;
  }>;
  frozen: string[];
};
export type WorldLaws = { physics: { metaphysics?: { mana?: number; qi?: number } } };
export type SimulationEvent = {
  id: string;
  tick: number;
  time_label: string;
  type: string;
  participants: string[];
  region: string;
  description: string;
  major?: boolean;
  changes: Array<{
    entity: string;
    metrics?: Record<string, number>;
    tech?: Record<string, number>;
    values?: Record<string, number>;
    absorbed_by?: string;
    founded?: { name: string; from: string };
    collapsed?: boolean;
  }>;
  causals?: string[];
};
export type SimulationSession = { events: SimulationEvent[] };
