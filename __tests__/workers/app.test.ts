import { describe, expect, it, vi } from "vitest";

const handler = vi.hoisted(() => vi.fn(async () => new Response("app")));

vi.mock("react-router", () => ({ createRequestHandler: () => handler }));
vi.mock("../../workers/online-counter", () => ({ OnlineCounter: class {} }));

import worker from "../../workers/app";

const CURL = { "user-agent": "curl/8.5.0" };
const env = {
  DB: { prepare: () => ({ first: async () => ({ 1: 1 }) }) },
} as never;
const ctx = {} as never;

const fetchPath = (path: string, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`https://huyab.cfd${path}`, { headers }) as never,
    env,
    ctx,
  );

describe("worker entry", () => {
  it("answers the deploy-check routes before everything else", async () => {
    const version = await fetchPath("/api/version", CURL);
    expect(version.status).toBe(200);
    expect(
      ((await version.json()) as { commit: string }).commit.length,
    ).toBeGreaterThan(0);

    const health = await fetchPath("/api/health", CURL);
    expect(await health.json()).toEqual({ ok: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("still redirects /games to the games app", async () => {
    const res = await fetchPath("/games/loto");
    expect(res.status).toBe(301);
  });

  it("still answers terminal clients with plain text", async () => {
    const res = await fetchPath("/upper/abc", CURL);
    expect(await res.text()).toBe("ABC\n");
  });

  it("still sends other requests to React Router", async () => {
    const res = await fetchPath("/about");
    expect(await res.text()).toBe("app");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
