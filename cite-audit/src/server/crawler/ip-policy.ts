import { BlockList, isIP } from "node:net";

/**
 * Plages d'adresses jamais joignables par le crawler : privées, locales, réservées,
 * documentation, multicast, métadonnées cloud (169.254.169.254)…
 */
const blocked = new BlockList();

const IPV4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], // « ce réseau »
  ["10.0.0.0", 8], // privé
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, métadonnées cloud
  ["172.16.0.0", 12], // privé
  ["192.0.0.0", 24], // IETF
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // relais 6to4
  ["192.168.0.0", 16], // privé
  ["198.18.0.0", 15], // tests de performance
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // réservé + broadcast
];

const IPV6_BLOCKED: [string, number][] = [
  ["::", 128], // non spécifiée
  ["::1", 128], // loopback
  ["64:ff9b:1::", 48], // traduction locale
  ["100::", 64], // à jeter
  ["2001::", 23], // IETF (Teredo, ORCHID…)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (peut encapsuler une IPv4 privée)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (obsolète)
  ["ff00::", 8], // multicast
];

for (const [net, prefix] of IPV4_BLOCKED) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of IPV6_BLOCKED) blocked.addSubnet(net, prefix, "ipv6");

/** Extrait l'IPv4 d'une IPv6 « mappée » (::ffff:a.b.c.d) ou NAT64 (64:ff9b::a.b.c.d). */
function embeddedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  const match = /^(?:::ffff:(?:0:)?|64:ff9b::)(.+)$/.exec(lower);
  if (!match) return null;
  const rest = match[1];
  if (isIP(rest) === 4) return rest;
  // Forme hexadécimale : ::ffff:7f00:1
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
  if (!hex) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

/** true si l'adresse est une IP publique joignable ; false pour toute adresse privée, réservée ou invalide. */
export function isPublicAddress(address: string): boolean {
  const clean = address.replace(/^\[|\]$/g, "").split("%")[0]; // retire crochets et zone IPv6
  const family = isIP(clean);
  if (family === 0) return false;
  if (family === 4) return !blocked.check(clean, "ipv4");
  const v4 = embeddedIpv4(clean);
  if (v4) return isPublicAddress(v4);
  return !blocked.check(clean, "ipv6");
}
