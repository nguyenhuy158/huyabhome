import type { ProjectService } from "../../core/application/project-service";

/** Edge cache lifetime. Shorter than this and the check adds no value. */
const CACHE_SECONDS = 300;

export function createProjectsHttp(service: ProjectService) {
  async function status(request: Request): Promise<Response> {
    const report = await service.checkStatuses({ servingUrl: request.url });
    return new Response(JSON.stringify(report), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
      },
    });
  }

  return { status };
}

export type ProjectsHttp = ReturnType<typeof createProjectsHttp>;
