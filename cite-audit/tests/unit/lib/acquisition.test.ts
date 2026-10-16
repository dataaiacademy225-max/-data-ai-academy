import { describe, expect, it } from "vitest";
import {
  ACCESS_INTEREST_LABELS,
  countBy,
  interestLabel,
  normalizeTrackingParam,
  readTracking,
  sourceLabel,
  withTracking,
} from "@/lib/acquisition";
import { findForbiddenWording } from "@/server/scoring/wording-guard";

describe("provenance des demandes d'accès", () => {
  it("nettoie les paramètres de suivi et ignore les valeurs inattendues", () => {
    expect(normalizeTrackingParam(" LinkedIn ")).toBe("linkedin");
    expect(normalizeTrackingParam(["facebook", "x"])).toBe("facebook");
    for (const bad of ["", "<script>", "a b", "x".repeat(41), "-tiret", undefined, 3]) expect(normalizeTrackingParam(bad)).toBeNull();
  });

  it("lit utm_source / utm_campaign, ou leurs formes courtes", () => {
    expect(readTracking({ utm_source: "linkedin", utm_campaign: "post-3" })).toEqual({ source: "linkedin", campaign: "post-3" });
    expect(readTracking({ source: "instagram" })).toEqual({ source: "instagram", campaign: null });
    expect(readTracking({})).toEqual({ source: null, campaign: null });
  });

  it("transmet la provenance au lien de demande d'accès", () => {
    expect(withTracking("/demande-acces", { source: "linkedin", campaign: "post-1" })).toBe(
      "/demande-acces?utm_source=linkedin&utm_campaign=post-1",
    );
    expect(withTracking("/demande-acces", { source: null, campaign: null })).toBe("/demande-acces");
  });

  it("libellés lisibles et décompte trié", () => {
    expect(sourceLabel("linkedin")).toBe("LinkedIn");
    expect(sourceLabel("salon-abidjan")).toBe("salon-abidjan");
    expect(sourceLabel(null)).toBe("Inconnue");
    expect(interestLabel(null)).toBe("Non précisé");
    expect(countBy(["b", "a", "b"], (v) => v)).toEqual([
      { label: "b", count: 2 },
      { label: "a", count: 1 },
    ]);
    for (const label of Object.values(ACCESS_INTEREST_LABELS)) expect(findForbiddenWording(label)).toEqual([]);
  });
});
