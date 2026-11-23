import type { RunSnapshot, NarrativeRunStep } from "@narralume/domain";
import type { WorkerRegistry, StepExecutionResult } from "@narralume/harness";
import type { NarrativeDatabase } from "@narralume/persistence";
import type { NarrativeModelClient } from "./model-client.js";
import {
  StoryDirectorPipeline,
  type StoryDirectorAdoptionInput,
  type StoryDirectorFrameRequest,
  type StoryDirectorRehearsalRequest,
} from "./story-director-pipeline.js";

/** Speculative runs never write Canon or outline. Only author adoption stages a handoff. */
export class StoryDirectorWorkerSuite {
  private readonly pipeline: StoryDirectorPipeline;
  constructor(database: NarrativeDatabase, model: NarrativeModelClient) {
    this.pipeline = new StoryDirectorPipeline(database, model);
  }
  registry(): WorkerRegistry {
    return {
      "story.director.design": {
        execute: (snapshot, step, signal) => this.design(snapshot, step, signal),
      },
      "story.director.rehearse": {
        execute: (snapshot, step, signal) => this.rehearse(snapshot, step, signal),
      },
    };
  }
  private async design(snapshot: RunSnapshot, step: NarrativeRunStep, signal: AbortSignal): Promise<StepExecutionResult> {
    const request = snapshot.run.policy.storyDirectorDesignRequest as StoryDirectorFrameRequest | undefined;
    if (!request || request.projectId !== snapshot.run.projectId)
      throw new Error("story_director.invalid_design_request");
    const result = await this.pipeline.designStoryUnitForFrame(snapshot.run, step, request, signal);
    return { output: { ...result }, artifactKind: "story-director-design", usage: result.usage };
  }
  private async rehearse(snapshot: RunSnapshot, step: NarrativeRunStep, signal: AbortSignal): Promise<StepExecutionResult> {
    const request = snapshot.run.policy.storyDirectorRehearsalRequest as StoryDirectorRehearsalRequest | undefined;
    if (!request || request.field?.projectId !== snapshot.run.projectId)
      throw new Error("story_director.invalid_rehearsal_request");
    const result = await this.pipeline.rehearseAndBuildHandoff(snapshot.run, step, request, signal);
    return { output: { ...result }, artifactKind: "story-director-rehearsal", usage: result.usage };
  }
  adoptNodeHandoff(input: StoryDirectorAdoptionInput) {
    return this.pipeline.adoptNodeHandoff(input);
  }
}
