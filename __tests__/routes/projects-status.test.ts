import { describe, expect, it } from "vitest";
import { loader } from "~/routes/api.projects-status";
import { createD1ProjectCatalog } from "~/server/adapters/d1/d1-project-catalog";
import { remoteD1 } from "../utils/d1-fixture";

const context = { cloudflare: { env: { DB: remoteD1("db") } } };

describe("loader", () => {
  const stubFetch = (calls: string[]) =>
    (async (url: string) => {
      calls.push(String(url));
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

  it("reports the serving host as up without fetching it", async () => {
    // A Worker fetching its own zone gets a 522, so this must not be a fetch.
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = stubFetch(calls);
    try {
      const res = await loader({
        request: new Request("https://huyab.cfd/api/projects-status"),
        context,
      });
      const data = (await res.json()) as {
        statuses: { id: string; online: boolean | null; self?: boolean }[];
      };

      const self = data.statuses.find((s) => s.id === "toolhub")!;
      expect(self.online).toBe(true);
      expect(self.self).toBe(true);
      expect(calls.some((u) => u.includes("//huyab.cfd"))).toBe(false);

      const projects = await createD1ProjectCatalog(
        context.cloudflare.env.DB,
      ).list();
      const others = projects.filter(
        (p) => p.id !== "toolhub" && !p.skipStatusCheck,
      );
      expect(calls.length).toBe(others.length);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("still pings other subdomains", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = stubFetch(calls);
    try {
      await loader({
        request: new Request("https://huyab.cfd/api/projects-status"),
        context,
      });
      expect(calls.some((u) => u.includes("tc.huyab.cfd"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("sends an edge cache header", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = stubFetch([]);
    try {
      const res = await loader({
        request: new Request("https://huyab.cfd/api/projects-status"),
        context,
      });
      expect(res.headers.get("cache-control")).toContain("s-maxage=");
      expect(res.headers.get("content-type")).toContain("application/json");
    } finally {
      globalThis.fetch = original;
    }
  });
});
