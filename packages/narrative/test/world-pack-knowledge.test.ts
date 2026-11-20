import { createCanonEntity, type TimelineEvent } from "@narralume/domain";
import { describe, expect, it } from "vitest";

import { projectNpcWitnessedEvents } from "../src/world-pack-knowledge.js";

const projectId = "sneq-novel";
const now = "2026-11-20T00:00:00.000Z";
function character(id: string, name: string) {
  return createCanonEntity({ id, projectId, type: "character", name, description: "真实而独立的NPC", now });
}
function event(id: string, sequence: number, participants: string[], description: string): TimelineEvent {
  return {
    id, projectId, title: "已发生的交易", description,
    outlineNodeId: null, storyTimeStart: "宗门大比前",
    storyTimeEnd: null, sequence, participants, causes: [],
    visibility: "omniscient", sourceId: null,
    createdAt: now, updatedAt: now,
  };
}

describe("ported SNEQ source NPC belief projection", () => {
  it("does not hand an unseen NPC another character's private witnessed event", () => {
    const characters = [character("merchant", "掌柜"), character("master", "宗门长老")];
    const results = projectNpcWitnessedEvents({
      projectId, characters, timeline: [
        event("private-sale", 1, ["merchant"], "掌柜偷偷卖出最后一颗丹药"),
        event("temple-meeting", 2, ["master"], "长老召开宗门内门会议"),
      ],
    });
    expect(results).toHaveLength(2);
    expect(results.find((row) => row.entityId === "merchant")?.events.map((e) => e.timelineEventId))
      .toEqual(["private-sale"]);
    expect(results.find((row) => row.entityId === "master")?.events.map((e) => e.timelineEventId))
      .toEqual(["temple-meeting"]);
    expect(results[0]?.events[0]?.salience).toBeGreaterThan(0);
  });

  it("uses existing canonical participants rather than inventing gossip or a second knowledge store", () => {
    const results = projectNpcWitnessedEvents({
      projectId, characters: [character("one", "修士甲")],
      timeline: [event("unseen", 1, ["other"], "别处正在发生的秘密行动")],
    });
    expect(results).toEqual([{ entityId: "one", events: [] }]);
  });
});
