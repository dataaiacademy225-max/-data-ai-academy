import { describe, expect, it } from "vitest";
import { agree, plural } from "@/lib/plural";

describe("accords au pluriel", () => {
  it("garde 0 et 1 au singulier, accorde à partir de 2", () => {
    expect(plural(0, "page")).toBe("0 page");
    expect(plural(1, "page")).toBe("1 page");
    expect(plural(12, "titre de page", "titres de page")).toBe("12 titres de page");
    expect(agree(5, "respecte", "respectent")).toBe("respectent");
  });
});
