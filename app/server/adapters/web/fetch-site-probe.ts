import type { ProbeResult, SiteProbe } from "../../core/ports";

/** Give up on a site after this long; a slow site is reported, not fatal. */
const TIMEOUT_MS = 8000;

const USER_AGENT = "ToolHub-status-check (+https://huyab.cfd/projects)";

export interface FetchSiteProbeOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export function createFetchSiteProbe({
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  timeoutMs = TIMEOUT_MS,
}: FetchSiteProbeOptions = {}): SiteProbe {
  return {
    async ping(url): Promise<ProbeResult> {
      const started = now();
      // AbortController rather than AbortSignal.timeout: the latter is missing in
      // some JS runtimes, and this way the timer can be cleared once settled.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            // Identify the pinger so site owners can see what this traffic is.
            "user-agent": USER_AGENT,
          },
        });
        // The body is never read — status and timing are all that is needed.
        return { ok: res.ok, httpStatus: res.status, ms: now() - started };
      } catch (error) {
        // Keep the message, not just the name: a bare "Error" says nothing when
        // diagnosing why a site looks down (TLS, DNS, timeout all land here).
        return {
          error:
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : "fetch failed",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
