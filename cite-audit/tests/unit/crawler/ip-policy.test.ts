import { describe, expect, it } from "vitest";
import { isPublicAddress } from "@/server/crawler/ip-policy";

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4007:80e::200e"])(
    "autorise l'adresse publique %s",
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  );

  it.each([
    ["127.0.0.1", "loopback"],
    ["127.255.0.9", "loopback"],
    ["10.1.2.3", "privée"],
    ["172.16.0.1", "privée"],
    ["172.31.255.255", "privée"],
    ["192.168.1.1", "privée"],
    ["169.254.169.254", "métadonnées cloud"],
    ["100.64.0.1", "CGNAT"],
    ["0.0.0.0", "non spécifiée"],
    ["192.0.2.10", "documentation"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "broadcast"],
    ["::1", "loopback IPv6"],
    ["::", "non spécifiée IPv6"],
    ["fe80::1", "link-local IPv6"],
    ["fd12:3456::1", "unique local IPv6"],
    ["::ffff:127.0.0.1", "IPv4 mappée"],
    ["::ffff:7f00:1", "IPv4 mappée (hexa)"],
    ["::ffff:10.0.0.1", "IPv4 privée mappée"],
    ["64:ff9b::a9fe:a9fe", "NAT64 vers 169.254.169.254"],
    ["2002:c0a8:101::1", "6to4"],
    ["[::1]", "entre crochets"],
    ["pas-une-ip", "invalide"],
  ])("bloque %s (%s)", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it("ne bloque pas 172.32.0.1 (hors de la plage privée 172.16/12)", () => {
    expect(isPublicAddress("172.32.0.1")).toBe(true);
  });
});
