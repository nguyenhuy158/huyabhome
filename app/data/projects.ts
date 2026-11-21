/**
 * The showcase list behind /projects.
 *
 * Rows live in the `projects` table of the shared D1 database (binding `DB`,
 * database `db`). Add, rename or retire a product by editing that table —
 * both the page and the live status check read them through the
 * ProjectCatalog port (app/server/adapters/d1).
 */

import type { Project } from "../server/core/domain/project";

export type { Project };

/**
 * Placeholder entry, shown only in docs/tests — never invented numbers or
 * fake products on the page itself. Insert a real row into the `projects`
 * table in D1 to add a product.
 */
export const PROJECT_TEMPLATE: Project = {
  id: "ten-du-an",
  name: "Tên dự án",
  url: "https://example.com",
  tagline: "Một câu nói dự án này làm gì",
  description: "Vài câu mô tả chi tiết hơn: giải quyết vấn đề gì, cho ai.",
  tech: ["Tech 1", "Tech 2"],
  accent: "from-emerald-500 to-teal-600",
  status: "live",
  since: "2026",
  highlights: [],
};
