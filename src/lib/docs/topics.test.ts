import { describe, it, expect } from "vitest";
import {
  TOPICS,
  topicSlugs,
  getTopic,
  getRelatedTopics,
} from "./topics";

describe("topics registry", () => {
  it("has exactly 8 topic pages", () => {
    expect(TOPICS).toHaveLength(8);
  });

  it("every slug is unique", () => {
    const slugs = TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every related[] slug exists in the registry", () => {
    const slugs = new Set(TOPICS.map((t) => t.slug));
    for (const topic of TOPICS) {
      for (const related of topic.related) {
        expect(slugs.has(related), `${topic.slug} references missing ${related}`).toBe(true);
      }
    }
  });

  it("topicSlugs returns all slugs in order", () => {
    expect(topicSlugs()).toEqual(TOPICS.map((t) => t.slug));
  });

  it("getTopic returns the matching topic", () => {
    expect(getTopic("cennik")?.slug).toBe("cennik");
  });

  it("getTopic returns undefined for unknown slug", () => {
    expect(getTopic("nieistnieje")).toBeUndefined();
  });

  it("getRelatedTopics returns the topic objects for the related slugs", () => {
    const cennik = getTopic("cennik")!;
    const related = getRelatedTopics(cennik.slug);
    expect(related.map((t) => t.slug)).toEqual(cennik.related);
  });

  it("getRelatedTopics returns [] for unknown slug", () => {
    expect(getRelatedTopics("nieistnieje")).toEqual([]);
  });
});
