import type { RunStepKind } from "@narralume/domain";
import type { RunStepSeed } from "./recipe.js";

function recipe(runId: string, name: "story-director-design" | "story-director-rehearse", kind: RunStepKind) {
  return {
    name, version: 1,
    steps: [{
      id: `${runId}:execute`, ordinal: 0, kind, cycle: 0,
      idempotencyKey: `${runId}/execute`, maxAttempts: 5,
    }] satisfies readonly RunStepSeed[],
  };
}
export function buildStoryDirectorDesignRecipe(runId: string) {
  return recipe(runId, "story-director-design", "story.director.design");
}
export function buildStoryDirectorRehearseRecipe(runId: string) {
  return recipe(runId, "story-director-rehearse", "story.director.rehearse");
}
