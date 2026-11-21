import { describe, expect, it } from "vitest";
import { createProjectService } from "~/server/core/application/project-service";
import type { Project } from "~/server/core/domain/project";
import type { ProbeResult } from "~/server/core/ports";

const project = (
  id: string,
  url: string,
  extra: Partial<Project> = {},
): Project => ({
  id,
  name: id,
  url,
  tagline: "",
  description: "",
  tech: [],
  accent: "",
  status: "live",
  ...extra,
});

function setup(projects: Project[], answers: Record<string, ProbeResult> = {}) {
  const pinged: string[] = [];
  const service = createProjectService({
    catalog: { list: async () => projects },
    probe: {
      ping: async (url) => {
        pinged.push(url);
        return answers[url] ?? { ok: true, httpStatus: 200, ms: 10 };
      },
    },
    clock: { now: () => "2026-03-01T00:00:00.000Z" },
  });
  return { service, pinged };
}

const SERVING = "https://huyab.cfd/api/projects-status";

describe("list", () => {
  it("returns what the catalog has, in its order", async () => {
    const projects = [
      project("b", "https://b.test"),
      project("a", "https://a.test"),
    ];
    expect((await setup(projects).service.list()).map((p) => p.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("checkStatuses", () => {
  it("answers for the serving host without pinging it", async () => {
    const { service, pinged } = setup([project("self", "https://huyab.cfd")]);
    const { statuses } = await service.checkStatuses({ servingUrl: SERVING });
    expect(statuses).toEqual([
      { id: "self", online: true, ms: null, self: true },
    ]);
    expect(pinged).toEqual([]);
  });

  it("skips a project that opted out, without pinging it", async () => {
    const { service, pinged } = setup([
      project("quiet", "https://quiet.test", { skipStatusCheck: true }),
    ]);
    const { statuses } = await service.checkStatuses({ servingUrl: SERVING });
    expect(statuses).toEqual([{ id: "quiet", online: null, ms: null }]);
    expect(pinged).toEqual([]);
  });

  it("pings every other project, including sibling subdomains", async () => {
    const { service, pinged } = setup([
      project("tc", "https://tc.huyab.cfd"),
      project("ext", "https://example.com"),
    ]);
    const { statuses } = await service.checkStatuses({ servingUrl: SERVING });
    expect(pinged.sort()).toEqual([
      "https://example.com",
      "https://tc.huyab.cfd",
    ]);
    expect(statuses.map((s) => s.online)).toEqual([true, true]);
  });

  it("turns a same-zone Cloudflare 522 into unknown, but keeps another domain's 522 offline", async () => {
    const { service } = setup(
      [
        project("chat", "https://chat.huyab.cfd"),
        project("ext", "https://example.com"),
      ],
      {
        "https://chat.huyab.cfd": { ok: false, httpStatus: 522, ms: 256 },
        "https://example.com": { ok: false, httpStatus: 522, ms: 256 },
      },
    );
    const { statuses } = await service.checkStatuses({ servingUrl: SERVING });
    expect(statuses[0].online).toBeNull();
    expect(statuses[0].error).toContain("same-zone loopback");
    expect(statuses[1].online).toBe(false);
  });

  it("records a failed ping as offline with its message", async () => {
    const { service } = setup([project("x", "https://x.test")], {
      "https://x.test": { error: "TypeError: down" },
    });
    const { statuses } = await service.checkStatuses({ servingUrl: SERVING });
    expect(statuses[0]).toEqual({
      id: "x",
      online: false,
      ms: null,
      error: "TypeError: down",
    });
  });

  it("adds the clock time and a summary of the checked sites", async () => {
    const { service } = setup(
      [
        project("a", "https://a.test"),
        project("b", "https://b.test"),
        project("q", "https://q.test", { skipStatusCheck: true }),
      ],
      { "https://b.test": { ok: false, httpStatus: 500, ms: 30 } },
    );
    const report = await service.checkStatuses({ servingUrl: SERVING });
    expect(report.checkedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(report.summary).toMatchObject({
      total: 3,
      checked: 2,
      online: 1,
      offline: 1,
    });
  });
});
