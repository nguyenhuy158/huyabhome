import { describe, expect, it } from "vitest";
import {
  isSameHost,
  isSameZone,
  reconcileSameZone,
  toStatus,
} from "~/server/core/domain/project-status";

describe("isSameHost", () => {
  it("matches the host serving the request", () => {
    expect(isSameHost("https://huyab.cfd", "https://huyab.cfd/api/x")).toBe(
      true,
    );
  });

  it("does not match a different subdomain", () => {
    // tc.huyab.cfd is a separate origin and must still be pinged.
    expect(isSameHost("https://tc.huyab.cfd", "https://huyab.cfd/api/x")).toBe(
      false,
    );
  });

  it("ignores path differences in the request URL", () => {
    expect(isSameHost("https://huyab.cfd", "https://huyab.cfd/a/b?c=1")).toBe(
      true,
    );
  });

  it("returns false for a malformed URL instead of throwing", () => {
    expect(isSameHost("not a url", "https://huyab.cfd")).toBe(false);
  });
});

describe("isSameZone", () => {
  it("matches a sibling subdomain on the same apex", () => {
    expect(
      isSameZone("https://chat.huyab.cfd", "https://huyab.cfd/api/x"),
    ).toBe(true);
  });

  it("matches the apex itself", () => {
    expect(isSameZone("https://huyab.cfd", "https://huyab.cfd/api/x")).toBe(
      true,
    );
  });

  it("does not match another domain", () => {
    expect(isSameZone("https://example.com", "https://huyab.cfd/api/x")).toBe(
      false,
    );
  });

  it("returns false for a malformed URL", () => {
    expect(isSameZone("nope", "https://huyab.cfd")).toBe(false);
  });
});

describe("reconcileSameZone", () => {
  const req = "https://huyab.cfd/api/projects-status";

  it("turns a same-zone 522 into unknown rather than offline", () => {
    // chat.huyab.cfd answers 200 outside but 522 to a Worker on its zone.
    const out = reconcileSameZone(
      { id: "chatroom", online: false, ms: 256, httpStatus: 522 },
      "https://chat.huyab.cfd",
      req,
    );
    expect(out.online).toBe(null);
    expect(out.error).toContain("same-zone loopback");
    expect(out.error).toContain("522");
  });

  it.each([520, 521, 523, 524, 525, 526, 527])(
    "treats a same-zone %i the same way",
    (code) => {
      const out = reconcileSameZone(
        { id: "x", online: false, ms: 1, httpStatus: code },
        "https://chat.huyab.cfd",
        req,
      );
      expect(out.online).toBe(null);
    },
  );

  it("keeps a real 500 from a same-zone host as offline", () => {
    // 5xx from the site itself is the site's own answer, not a loopback.
    const out = reconcileSameZone(
      { id: "x", online: false, ms: 10, httpStatus: 500 },
      "https://chat.huyab.cfd",
      req,
    );
    expect(out.online).toBe(false);
    expect(out.httpStatus).toBe(500);
  });

  it("keeps a 522 from another domain as offline", () => {
    const out = reconcileSameZone(
      { id: "x", online: false, ms: 10, httpStatus: 522 },
      "https://example.com",
      req,
    );
    expect(out.online).toBe(false);
  });

  it("leaves a healthy status untouched", () => {
    const ok = { id: "x", online: true, ms: 100, httpStatus: 200 };
    expect(reconcileSameZone(ok, "https://chat.huyab.cfd", req)).toEqual(ok);
  });

  it("leaves a thrown-error status untouched", () => {
    const errored = { id: "x", online: false, ms: null, error: "TypeError: x" };
    expect(reconcileSameZone(errored, "https://chat.huyab.cfd", req)).toEqual(
      errored,
    );
  });
});

describe("toStatus", () => {
  it("maps a response to online by its ok flag, keeping status and timing", () => {
    expect(toStatus("a", { ok: true, httpStatus: 200, ms: 12 })).toEqual({
      id: "a",
      online: true,
      ms: 12,
      httpStatus: 200,
    });
    expect(toStatus("a", { ok: false, httpStatus: 500, ms: 7 })).toEqual({
      id: "a",
      online: false,
      ms: 7,
      httpStatus: 500,
    });
  });

  it("maps a failure to offline with no timing and the message", () => {
    expect(toStatus("a", { error: "TypeError: down" })).toEqual({
      id: "a",
      online: false,
      ms: null,
      error: "TypeError: down",
    });
  });

  it("truncates a runaway error message", () => {
    const status = toStatus("a", { error: "x".repeat(5000) });
    expect(status.error).toHaveLength(200);
  });
});
