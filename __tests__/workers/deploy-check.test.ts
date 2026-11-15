import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuildInfo } from "../../workers/build-info";
import { handleDeployCheck } from "../../workers/deploy-check";

const INFO: BuildInfo = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  shortCommit: "0123456",
  branch: "main",
  builtBy: "workers-builds",
  dirty: false,
  builtAt: "2026-11-15T00:00:00.000Z",
};

const okEnv = {
  DB: { prepare: () => ({ first: async () => ({ 1: 1 }) }) },
} as never;

const brokenEnv = {
  DB: {
    prepare: () => ({
      first: async () => {
        throw new Error("secret-internal-detail");
      },
    }),
  },
} as never;

const call = (path: string, env = okEnv, method = "GET") =>
  handleDeployCheck(
    new Request(`https://huyab.cfd${path}`, { method }),
    env,
    INFO,
  );

afterEach(() => vi.restoreAllMocks());

describe("deploy check routes", () => {
  it("serves the baked build info", async () => {
    const res = await call("/api/version");
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual(INFO);
  });

  it("reports healthy when the database answers", async () => {
    const res = await call("/api/health");
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ok: true });
  });

  it("returns 500 with a hint and no error text when the database fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call("/api/health", brokenEnv);
    expect(res?.status).toBe(500);
    const text = await res!.text();
    const body = JSON.parse(text) as { ok: boolean; hint: string };
    expect(body.ok).toBe(false);
    expect(body.hint.length).toBeGreaterThan(0);
    expect(text).not.toContain("secret-internal-detail");
    expect(spy).toHaveBeenCalled();
  });

  it("ignores other methods and other paths", async () => {
    expect(await call("/api/version", okEnv, "POST")).toBeNull();
    expect(await call("/api/health", okEnv, "POST")).toBeNull();
    expect(await call("/api/holidays")).toBeNull();
    expect(await call("/")).toBeNull();
  });
});
