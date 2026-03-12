import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { detectCurrentPhase } from "../core/planner/lifecycle-phase.js";
import { makeNode } from "./helpers/factories.js";

describe("set_phase via project settings", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  it("should store phase override in project_settings", () => {
    store.setProjectSetting("lifecycle_phase_override", "HANDOFF");
    expect(store.getProjectSetting("lifecycle_phase_override")).toBe("HANDOFF");
  });

  it("should make detectCurrentPhase return override when set", () => {
    const node = makeNode({ status: "in_progress" });
    store.insertNode(node);
    const doc = store.toGraphDocument();

    // Without override → IMPLEMENT
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");

    // With override → LISTENING
    expect(detectCurrentPhase(doc, { phaseOverride: "LISTENING" })).toBe("LISTENING");
  });

  it("should clear override when set to empty string", () => {
    store.setProjectSetting("lifecycle_phase_override", "HANDOFF");
    store.setProjectSetting("lifecycle_phase_override", "");

    const value = store.getProjectSetting("lifecycle_phase_override");
    expect(value).toBe("");
  });

  it("should use auto-detection when override is empty or null", () => {
    const node = makeNode({ status: "in_progress" });
    store.insertNode(node);
    const doc = store.toGraphDocument();

    // Empty string override should be treated as no override
    expect(detectCurrentPhase(doc, { phaseOverride: null })).toBe("IMPLEMENT");
  });
});
