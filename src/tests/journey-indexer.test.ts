import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { JourneyStore } from "../core/journey/journey-store.js";
import { indexJourneyMaps } from "../core/rag/journey-indexer.js";

describe("Journey Indexer", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;
  let journeyStore: JourneyStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    const project = store.getProject()!;
    knowledgeStore = new KnowledgeStore(store.getDb());
    journeyStore = new JourneyStore(store.getDb(), project.id);
  });

  it("should return zero counts when no journey maps exist", () => {
    const result = indexJourneyMaps(knowledgeStore, journeyStore);
    expect(result).toEqual({ mapsIndexed: 0, documentsIndexed: 0 });
  });

  it("should index a journey map with screens into the knowledge store", () => {
    // Arrange: create a map with 2 screens and 1 edge
    const map = journeyStore.createMap({ name: "Test Journey", url: "https://example.com" });
    const s1 = journeyStore.addScreen(map.id, {
      title: "Homepage",
      url: "https://example.com/",
      screenType: "landing",
      ctas: ["Sign Up", "Login"],
    });
    const s2 = journeyStore.addScreen(map.id, {
      title: "Registration Form",
      url: "https://example.com/register",
      screenType: "form",
      description: "User registration with email and password",
      fields: [
        { name: "email", type: "email", required: true, label: "Email" },
        { name: "password", type: "password", required: true, label: "Password" },
      ],
      ctas: ["Create Account"],
    });
    journeyStore.addEdge(map.id, { from: s1.id, to: s2.id, label: "CTA: Sign Up", type: "navigation" });

    // Act
    const result = indexJourneyMaps(knowledgeStore, journeyStore);

    // Assert
    expect(result.mapsIndexed).toBe(1);
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(3); // 1 overview + 2 screens

    // Verify knowledge store has journey docs
    const searchResults = knowledgeStore.search("Homepage", 10);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].sourceType).toBe("journey");

    // Verify form fields are searchable
    const fieldResults = knowledgeStore.search("email password", 10);
    expect(fieldResults.length).toBeGreaterThan(0);
  });

  it("should include navigation edges in screen content", () => {
    const map = journeyStore.createMap({ name: "Flow Test" });
    const s1 = journeyStore.addScreen(map.id, { title: "Page A", screenType: "page" });
    const s2 = journeyStore.addScreen(map.id, { title: "Page B", screenType: "page" });
    journeyStore.addEdge(map.id, { from: s1.id, to: s2.id, label: "Next", type: "navigation" });

    indexJourneyMaps(knowledgeStore, journeyStore);

    // Search for navigation context
    const results = knowledgeStore.search("Navigates Page B", 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it("should include variant paths in the overview", () => {
    const map = journeyStore.createMap({ name: "AB Test" });
    const s1 = journeyStore.addScreen(map.id, { title: "Start", screenType: "landing" });
    const s2 = journeyStore.addScreen(map.id, { title: "End", screenType: "success" });
    journeyStore.addVariant(map.id, {
      name: "Direct Path",
      description: "Straight to success",
      path: [s1.id, s2.id],
    });

    indexJourneyMaps(knowledgeStore, journeyStore);

    const results = knowledgeStore.search("Direct Path", 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it("should replace previous index on re-indexing", () => {
    const map = journeyStore.createMap({ name: "Reindex Test" });
    journeyStore.addScreen(map.id, { title: "Only Screen", screenType: "page" });

    // First index
    indexJourneyMaps(knowledgeStore, journeyStore);
    const countBefore = knowledgeStore.search("Only Screen", 100).length;

    // Re-index (should not duplicate)
    indexJourneyMaps(knowledgeStore, journeyStore);
    const countAfter = knowledgeStore.search("Only Screen", 100).length;

    expect(countAfter).toBe(countBefore);
  });
});
