import { describe, it, expect } from "vitest";
import { boostSiebelResults } from "../../core/siebel/siebel-rag-booster.js";

const DOCS = [
  { id: "1", sourceType: "siebel_escript", title: "eScript: Test", score: 0.5, metadata: { parentType: "business_component" } },
  { id: "2", sourceType: "siebel_pattern", title: "Pattern: Naming", score: 0.5, metadata: {} },
  { id: "3", sourceType: "siebel_sif", title: "BC: Account", score: 0.5, metadata: { siebelType: "business_component" } },
  { id: "4", sourceType: "siebel_wsdl", title: "WSDL: Upsert", score: 0.5, metadata: {} },
  { id: "5", sourceType: "siebel_contract", title: "Contract: Valid", score: 0.5, metadata: {} },
];

describe("siebel-rag-booster", () => {
  it("should boost eScript in IMPLEMENT phase", () => {
    const result = boostSiebelResults(DOCS, "IMPLEMENT");
    const escript = result.find((r) => r.id === "1");
    expect(escript!.boostedScore).toBeGreaterThan(0.5);
  });

  it("should boost patterns in DESIGN phase", () => {
    const result = boostSiebelResults(DOCS, "DESIGN");
    const pattern = result.find((r) => r.id === "2");
    expect(pattern!.boostedScore).toBeGreaterThan(0.5);
  });

  it("should boost contracts in VALIDATE phase", () => {
    const result = boostSiebelResults(DOCS, "VALIDATE");
    const contract = result.find((r) => r.id === "5");
    expect(contract!.boostedScore).toBeGreaterThan(0.5);
  });

  it("should re-rank by boosted score", () => {
    const result = boostSiebelResults(DOCS, "IMPLEMENT");
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].boostedScore).toBeGreaterThanOrEqual(result[i].boostedScore);
    }
  });

  it("should handle unknown phase gracefully", () => {
    const result = boostSiebelResults(DOCS, "UNKNOWN");
    expect(result.length).toBe(DOCS.length);
  });
});
