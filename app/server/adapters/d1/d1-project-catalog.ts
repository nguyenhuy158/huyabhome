import type { Project } from "../../core/domain/project";
import type { ProjectCatalog } from "../../core/ports";

interface ProjectRow {
  id: string;
  name: string;
  url: string;
  tagline: string;
  description: string;
  tech: string;
  image: string | null;
  shot_url: string | null;
  accent: string;
  status: string;
  since: string | null;
  highlights: string | null;
  skip_status_check: number;
  sort_order: number;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    tagline: row.tagline,
    description: row.description,
    tech: JSON.parse(row.tech),
    image: row.image ?? undefined,
    shotUrl: row.shot_url ?? undefined,
    accent: row.accent,
    status: row.status as Project["status"],
    since: row.since ?? undefined,
    highlights: row.highlights ? JSON.parse(row.highlights) : undefined,
    skipStatusCheck: row.skip_status_check === 1,
  };
}

export function createD1ProjectCatalog(db: D1Database): ProjectCatalog {
  return {
    async list() {
      const { results } = await db
        .prepare("SELECT * FROM projects ORDER BY sort_order")
        .all<ProjectRow>();
      return results.map(rowToProject);
    },
  };
}
