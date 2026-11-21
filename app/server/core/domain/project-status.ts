import type { ProbeResult } from "../ports";

export interface ProjectStatus {
  id: string;
  /** null when the check was skipped or has not run yet. */
  online: boolean | null;
  /** Round-trip time in ms, null when unknown. */
  ms: number | null;
  /** HTTP status when reached. */
  httpStatus?: number;
  /** Populated when the fetch failed outright. */
  error?: string;
  /**
   * True when this is the site serving the request, so it was reported up
   * without a fetch (a Worker cannot reach its own zone).
   */
  self?: boolean;
}

export interface StatusSummary {
  total: number;
  checked: number;
  online: number;
  offline: number;
  /** Median, not mean — one slow site should not skew the headline number. */
  medianMs: number | null;
}

/** Aggregate the per-site checks into the numbers shown in the header. */
export function summarize(statuses: ProjectStatus[]): StatusSummary {
  const checked = statuses.filter((s) => s.online !== null);
  const times = checked
    .map((s) => s.ms)
    .filter((ms): ms is number => typeof ms === "number")
    .sort((a, b) => a - b);

  return {
    total: statuses.length,
    checked: checked.length,
    online: checked.filter((s) => s.online === true).length,
    offline: checked.filter((s) => s.online === false).length,
    medianMs: median(times),
  };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * A Worker fetching its own zone loops back through Cloudflare and times out
 * with a 522, which would report this very site as down. Serving this request
 * already proves it is up, so answer for the same host without a fetch.
 */
export function isSameHost(target: string, requestUrl: string): boolean {
  try {
    return new URL(target).hostname === new URL(requestUrl).hostname;
  } catch {
    return false;
  }
}

/** Last two labels of a hostname: huyab.cfd for tc.huyab.cfd. */
function apexOf(hostname: string): string {
  return hostname.split(".").slice(-2).join(".");
}

/**
 * Same Cloudflare zone as the site serving this request. Fetching a sibling
 * hostname on the same zone can loop back and fail even while the site is
 * perfectly reachable from outside, so such a failure proves nothing.
 */
export function isSameZone(target: string, requestUrl: string): boolean {
  try {
    return (
      apexOf(new URL(target).hostname) === apexOf(new URL(requestUrl).hostname)
    );
  } catch {
    return false;
  }
}

/** Cloudflare's own origin-unreachable codes, not the site's own answer. */
const LOOPBACK_CODES = new Set([520, 521, 522, 523, 524, 525, 526, 527]);

/**
 * chat.huyab.cfd answers 200 to the outside world but 522 to a fetch from
 * this Worker. Reporting that as "Offline" would be a lie about someone's
 * site, so a Cloudflare 52x from a same-zone host is recorded as unknown.
 */
export function reconcileSameZone(
  status: ProjectStatus,
  target: string,
  requestUrl: string,
): ProjectStatus {
  if (status.online !== false) return status;
  if (!status.httpStatus || !LOOPBACK_CODES.has(status.httpStatus))
    return status;
  if (!isSameZone(target, requestUrl)) return status;
  return {
    id: status.id,
    online: null,
    ms: null,
    error: `same-zone loopback (HTTP ${status.httpStatus})`,
  };
}

const ERROR_LENGTH_LIMIT = 200;

export function toStatus(id: string, result: ProbeResult): ProjectStatus {
  if ("error" in result) {
    return {
      id,
      online: false,
      ms: null,
      error: result.error.slice(0, ERROR_LENGTH_LIMIT),
    };
  }
  return {
    id,
    online: result.ok,
    ms: result.ms,
    httpStatus: result.httpStatus,
  };
}
