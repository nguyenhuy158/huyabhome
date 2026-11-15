import type { BuildInfo } from "./build-info";
import { BUILD_INFO } from "./build-info.generated";

const VERSION_PATH = "/api/version";
const HEALTH_PATH = "/api/health";
const HEALTH_PROBE_SQL = "SELECT 1";
const HEALTH_FAILURE_HINT =
  "Database check failed: the D1 binding DB did not answer SELECT 1.";

type HealthEnv = { DB: Pick<D1Database, "prepare"> };

export async function handleDeployCheck(
  request: Request,
  env: HealthEnv,
  info: BuildInfo = BUILD_INFO,
): Promise<Response | null> {
  if (request.method !== "GET") return null;
  const { pathname } = new URL(request.url);
  if (pathname === VERSION_PATH) return Response.json(info);
  if (pathname !== HEALTH_PATH) return null;
  try {
    await env.DB.prepare(HEALTH_PROBE_SQL).first();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json(
      { ok: false, hint: HEALTH_FAILURE_HINT },
      { status: 500 },
    );
  }
}
