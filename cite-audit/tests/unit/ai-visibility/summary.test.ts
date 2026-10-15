import { describe, expect, it } from "vitest";
import { summarizeAiSamples, type SampleRow } from "@/server/ai-visibility/summary";

const row = (over: Partial<SampleRow>): SampleRow => ({
  provider: "PERPLEXITY",
  isDemo: false,
  brandMentioned: false,
  brandCited: false,
  brandRecommended: false,
  ...over,
});

describe("summarizeAiSamples", () => {
  it("compte séparément mentions, citations et recommandations", () => {
    const summary = summarizeAiSamples([
      row({ brandMentioned: true, brandCited: true }),
      row({ brandMentioned: true }),
      row({ brandMentioned: true, brandRecommended: true }),
      row({ brandMentioned: null, brandCited: null, brandRecommended: null }),
    ]);
    expect(summary.scope).toBe("real");
    expect(summary.byProvider.PERPLEXITY).toEqual({
      provider: "PERPLEXITY",
      analyzed: 4,
      mentioned: 3,
      cited: 1,
      recommended: 1,
    });
  });

  it("n'additionne jamais démonstration et réel", () => {
    const summary = summarizeAiSamples([row({ isDemo: true, brandMentioned: true }), row({ brandMentioned: false })]);
    expect(summary.scope).toBe("real");
    expect(summary.byProvider.PERPLEXITY?.analyzed).toBe(1);
    expect(summary.byProvider.PERPLEXITY?.mentioned).toBe(0);
  });

  it("signale les données de démonstration quand il n'y a qu'elles", () => {
    const summary = summarizeAiSamples([row({ isDemo: true, brandCited: true })]);
    expect(summary.scope).toBe("demo");
    expect(summary.byProvider.PERPLEXITY?.cited).toBe(1);
  });

  it("ne renvoie rien sans résultat", () => {
    expect(summarizeAiSamples([])).toEqual({ scope: "none", byProvider: {} });
  });
});
