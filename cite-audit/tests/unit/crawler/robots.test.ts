import { describe, expect, it } from "vitest";
import { createRobotsChecker, decideFromRobotsFetch, isAllowedByRobots } from "@/server/crawler/robots";
import type { FetchedResource, Result } from "@/server/crawler/types";

const robotsUrl = "https://site.com/robots.txt";

function fetched(body: string): Result<FetchedResource> {
  return {
    ok: true,
    value: { requestedUrl: robotsUrl, finalUrl: robotsUrl, status: 200, contentType: "text/plain", xRobotsTag: null, body, bytes: body.length, redirectChain: [], durationMs: 1 },
  };
}
const httpError = (status: number): Result<FetchedResource> => ({ ok: false, error: { code: "HTTP_ERROR", message: "", httpStatus: status } });

describe("isAllowedByRobots", () => {
  const txt = "User-agent: *\nDisallow: /prive\n\nUser-agent: GriotCite\nDisallow: /prive\nDisallow: /interdit-cite\n";
  it.each([
    ["https://site.com/", true],
    ["https://site.com/offres", true],
    ["https://site.com/prive/x", false],
    ["https://site.com/interdit-cite", false],
  ])("%s → %s", (url, allowed) => expect(isAllowedByRobots(txt, robotsUrl, url)).toBe(allowed));
});

describe("decideFromRobotsFetch (RFC 9309)", () => {
  it("2xx : applique les règles", () => {
    expect(decideFromRobotsFetch(fetched("User-agent: *\nDisallow: /"), robotsUrl, "https://site.com/x")).toEqual({ allowed: false, status: "DISALLOWED" });
  });
  it("404 : pas de robots.txt, tout est autorisé", () => {
    expect(decideFromRobotsFetch(httpError(404), robotsUrl, "https://site.com/x")).toEqual({ allowed: true, status: "NO_ROBOTS_TXT" });
  });
  it.each([
    ["5xx", httpError(503)],
    ["timeout", { ok: false, error: { code: "TIMEOUT", message: "" } } as Result<FetchedResource>],
  ])("%s : abstention par prudence", (_, result) => {
    expect(decideFromRobotsFetch(result, robotsUrl, "https://site.com/x")).toMatchObject({ allowed: false, status: "UNREACHABLE" });
  });
});

describe("createRobotsChecker", () => {
  it("ne télécharge robots.txt qu'une fois par origine", async () => {
    let calls = 0;
    const check = createRobotsChecker(async () => {
      calls += 1;
      return fetched("User-agent: *\nDisallow: /prive");
    });
    await check(new URL("https://site.com/a"));
    await check(new URL("https://site.com/b"));
    expect(calls).toBe(1);
    await check(new URL("https://autre.com/a"));
    expect(calls).toBe(2);
  });
});
