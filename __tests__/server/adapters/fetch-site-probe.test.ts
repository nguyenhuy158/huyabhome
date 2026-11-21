import { describe, expect, it, vi } from "vitest";
import { createFetchSiteProbe } from "~/server/adapters/web/fetch-site-probe";

const responding = (status = 200) =>
  (async () => new Response("body", { status })) as unknown as typeof fetch;

const failing = (error: Error) =>
  (async () => {
    throw error;
  }) as unknown as typeof fetch;

const ping = (fetchImpl: typeof fetch) =>
  createFetchSiteProbe({ fetchImpl }).ping("https://example.com");

describe("fetch site probe", () => {
  it("reports a reachable site with its status and a timing", async () => {
    const result = await ping(responding());
    expect(result).toMatchObject({ ok: true, httpStatus: 200 });
    expect("ms" in result && result.ms).toBeGreaterThanOrEqual(0);
  });

  it("times the request with the injected clock", async () => {
    const ticks = [1000, 1042];
    const probe = createFetchSiteProbe({
      fetchImpl: responding(),
      now: () => ticks.shift() ?? 0,
    });
    expect(await probe.ping("https://example.com")).toEqual({
      ok: true,
      httpStatus: 200,
      ms: 42,
    });
  });

  it("treats a 500 and a 404 as not ok but records the status code", async () => {
    expect(await ping(responding(500))).toMatchObject({
      ok: false,
      httpStatus: 500,
    });
    expect(await ping(responding(404))).toMatchObject({
      ok: false,
      httpStatus: 404,
    });
  });

  it("reports a thrown error without throwing itself, keeping the message", async () => {
    expect(await ping(failing(new TypeError("network down")))).toEqual({
      error: "TypeError: network down",
    });
    const tls = await ping(
      failing(new Error("TLS peer's certificate is not trusted")),
    );
    expect("error" in tls && tls.error).toContain("certificate is not trusted");
  });

  it("reports a thrown non-error", async () => {
    const throwing = (async () => {
      throw "boom";
    }) as unknown as typeof fetch;
    expect(await ping(throwing)).toEqual({ error: "fetch failed" });
  });

  it("aborts a site that never answers", async () => {
    vi.useFakeTimers();
    try {
      const hanging = ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted")),
          );
        })) as unknown as typeof fetch;

      const pending = createFetchSiteProbe({ fetchImpl: hanging }).ping(
        "https://slow.example",
      );
      await vi.advanceTimersByTimeAsync(9000);
      const result = await pending;
      expect("error" in result && result.error).toContain("aborted");
    } finally {
      vi.useRealTimers();
    }
  });

  it("identifies itself so site owners can see what the traffic is", async () => {
    let seen: RequestInit | undefined;
    const spy = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    await ping(spy);
    const headers = seen?.headers as Record<string, string>;
    expect(headers["user-agent"]).toContain("ToolHub-status-check");
    expect(seen?.signal).toBeDefined();
  });

  it("uses the global fetch when none is injected", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = responding(204);
    try {
      expect(
        await createFetchSiteProbe().ping("https://example.com"),
      ).toMatchObject({ ok: true, httpStatus: 204 });
    } finally {
      globalThis.fetch = original;
    }
  });
});
