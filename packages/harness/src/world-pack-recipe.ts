import type { RunStepKind } from "@narralume/domain";
import type { RunStepSeed } from "./recipe.js";

export function buildWorldPackRecipe(runId: string): {
  name: "world-pack-production";
  version: number;
  steps: readonly RunStepSeed[];
} {
  const definitions: readonly [string, RunStepKind, number][] = [
    ["context", "world.context", 2],
    ["generate", "world.generate", 5],
    ["stage", "world.stage", 2],
  ];
  return {
    name: "world-pack-production",
    version: 1,
    steps: definitions.map(([key, kind, maxAttempts], ordinal) => ({
      id: `${runId}:${key}`,
      ordinal,
      kind,
      cycle: 0,
      idempotencyKey: `${runId}/${key}`,
      maxAttempts,
    })),
  };
}
