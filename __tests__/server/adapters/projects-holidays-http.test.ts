import { afterEach, describe, expect, it, vi } from "vitest";
import { createHolidaysHttp } from "~/server/adapters/http/holidays-http";
import { createProjectsHttp } from "~/server/adapters/http/projects-http";
import type { ProjectService } from "~/server/core/application/project-service";

afterEach(() => vi.restoreAllMocks());

describe("projects http", () => {
  it("answers with the report as json and an edge cache header", async () => {
    const report = {
      checkedAt: "2026-03-01T00:00:00.000Z",
      summary: { total: 0, checked: 0, online: 0, offline: 0, medianMs: null },
      statuses: [],
    };
    const seen: string[] = [];
    const service = {
      list: async () => [],
      checkStatuses: async ({ servingUrl }: { servingUrl: string }) => {
        seen.push(servingUrl);
        return report;
      },
    } as ProjectService;
    const res = await createProjectsHttp(service).status(
      new Request("https://huyab.cfd/api/projects-status"),
    );
    expect(await res.json()).toEqual(report);
    expect(seen).toEqual(["https://huyab.cfd/api/projects-status"]);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300",
    );
  });
});

describe("holidays http", () => {
  it("wraps the holidays in a json object", async () => {
    const holidays = [
      { date: "01/01/2026", name: "x", type: "solar" as const },
    ];
    const res = await createHolidaysHttp({ list: async () => holidays }).list();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ holidays });
  });

  it("answers 500 with an empty list when loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await createHolidaysHttp({
      list: async () => {
        throw new Error("bad csv");
      },
    }).list();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      holidays: [],
      error: "Failed to load holidays",
    });
  });
});
