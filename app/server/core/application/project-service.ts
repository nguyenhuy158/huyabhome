import type { Project } from "../domain/project";
import {
  isSameHost,
  type ProjectStatus,
  reconcileSameZone,
  type StatusSummary,
  summarize,
  toStatus,
} from "../domain/project-status";
import type { Clock, ProjectCatalog, SiteProbe } from "../ports";

export interface ProjectServiceDeps {
  catalog: ProjectCatalog;
  probe: SiteProbe;
  clock: Clock;
}

export interface StatusReport {
  checkedAt: string;
  summary: StatusSummary;
  statuses: ProjectStatus[];
}

export function createProjectService({
  catalog,
  probe,
  clock,
}: ProjectServiceDeps) {
  async function list(): Promise<Project[]> {
    return catalog.list();
  }

  async function statusOf(
    project: Project,
    servingUrl: string,
  ): Promise<ProjectStatus> {
    if (project.skipStatusCheck) {
      return { id: project.id, online: null, ms: null };
    }
    if (isSameHost(project.url, servingUrl)) {
      return { id: project.id, online: true, ms: null, self: true };
    }
    const status = toStatus(project.id, await probe.ping(project.url));
    return reconcileSameZone(status, project.url, servingUrl);
  }

  async function checkStatuses({
    servingUrl,
  }: {
    servingUrl: string;
  }): Promise<StatusReport> {
    const projects = await catalog.list();
    const statuses = await Promise.all(
      projects.map((project) => statusOf(project, servingUrl)),
    );
    return {
      checkedAt: clock.now(),
      summary: summarize(statuses),
      statuses,
    };
  }

  return { list, checkStatuses };
}

export type ProjectService = ReturnType<typeof createProjectService>;
