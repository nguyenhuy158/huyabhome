import { describe, expect, it } from "vitest";
import { createD1ProjectCatalog } from "~/server/adapters/d1/d1-project-catalog";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "toolhub",
  name: "ToolHub",
  url: "https://huyab.cfd",
  tagline: "tools",
  description: "many tools",
  tech: JSON.stringify(["React", "Workers"]),
  image: null,
  shot_url: null,
  accent: "from-a to-b",
  status: "live",
  since: null,
  highlights: null,
  skip_status_check: 0,
  sort_order: 1,
  ...overrides,
});

function fakeD1(rows: unknown[]) {
  const queries: string[] = [];
  const db = {
    prepare(sql: string) {
      queries.push(sql);
      return { all: async () => ({ results: rows }) };
    },
  } as unknown as D1Database;
  return { db, queries };
}

describe("d1 project catalog", () => {
  it("reads the projects table in the hand-picked display order", async () => {
    const { db, queries } = fakeD1([]);
    expect(await createD1ProjectCatalog(db).list()).toEqual([]);
    expect(queries).toEqual(["SELECT * FROM projects ORDER BY sort_order"]);
  });

  it("maps a minimal row, leaving the optional fields undefined", async () => {
    const { db } = fakeD1([row()]);
    const [project] = await createD1ProjectCatalog(db).list();
    expect(project).toEqual({
      id: "toolhub",
      name: "ToolHub",
      url: "https://huyab.cfd",
      tagline: "tools",
      description: "many tools",
      tech: ["React", "Workers"],
      image: undefined,
      shotUrl: undefined,
      accent: "from-a to-b",
      status: "live",
      since: undefined,
      highlights: undefined,
      skipStatusCheck: false,
    });
  });

  it("maps the optional fields, the json highlights and the skip flag", async () => {
    const { db } = fakeD1([
      row({
        image: "/x.png",
        shot_url: "https://shot.test",
        since: "2026",
        highlights: JSON.stringify(["21 pages"]),
        skip_status_check: 1,
        status: "wip",
      }),
    ]);
    const [project] = await createD1ProjectCatalog(db).list();
    expect(project).toMatchObject({
      image: "/x.png",
      shotUrl: "https://shot.test",
      since: "2026",
      highlights: ["21 pages"],
      skipStatusCheck: true,
      status: "wip",
    });
  });

  it("keeps the order the database returned", async () => {
    const { db } = fakeD1([row({ id: "b" }), row({ id: "a" })]);
    const projects = await createD1ProjectCatalog(db).list();
    expect(projects.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
