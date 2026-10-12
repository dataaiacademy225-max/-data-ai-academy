import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/client-ip";

const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

describe("adresse IP du visiteur", () => {
  it("un proxy de confiance : l'entrée la plus à droite, celle que le proxy a ajoutée", () => {
    expect(clientIp(h("203.0.113.7"), 1)).toBe("203.0.113.7");
  });

  it("ignore une adresse falsifiée par le visiteur à gauche", () => {
    // Le visiteur envoie « 1.2.3.4 » ; le proxy ajoute sa vraie adresse à droite.
    expect(clientIp(h("1.2.3.4, 203.0.113.7"), 1)).toBe("203.0.113.7");
  });

  it("deux proxys (ex. CDN devant l'hébergeur) : la deuxième en partant de la droite", () => {
    expect(clientIp(h("1.2.3.4, 203.0.113.7, 10.0.0.1"), 2)).toBe("203.0.113.7");
  });

  it("sans en-tête, ou chaîne trop courte : adresse inconnue", () => {
    expect(clientIp(h(), 1)).toBe("inconnue");
    expect(clientIp(h("203.0.113.7"), 2)).toBe("inconnue");
    expect(clientIp(h("203.0.113.7"), 0)).toBe("inconnue");
  });
});
