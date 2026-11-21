/**
 * Pure helpers behind the /projects page, kept out of the route so they can be
 * tested without rendering or network access.
 */
import type { Project } from "../data/projects";

export type {
  ProjectStatus,
  StatusSummary,
} from "../server/core/domain/project-status";
export { summarize } from "../server/core/domain/project-status";

/** Hostname without the www. prefix, for display under the project name. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Up to two letters for the generated preview tile. */
export function initials(name: string): string {
  const words = name
    .split(/[\s\-_]+/u)
    .map((w) => Array.from(w)[0])
    .filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length === 1 ? words[0] : words[0] + words[1]).toUpperCase();
}

/** Live first, then work-in-progress, then archived; newest first within each. */
export function sortForDisplay(projects: Project[]): Project[] {
  const rank = { live: 0, wip: 1, archived: 2 } as const;
  return [...projects].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (b.since ?? "").localeCompare(a.since ?? "") ||
      a.name.localeCompare(b.name),
  );
}

/** Coarse buckets so the UI can colour a latency without magic numbers. */
export function latencyBand(ms: number | null): "fast" | "ok" | "slow" | null {
  if (ms === null) return null;
  if (ms < 300) return "fast";
  if (ms < 1000) return "ok";
  return "slow";
}
