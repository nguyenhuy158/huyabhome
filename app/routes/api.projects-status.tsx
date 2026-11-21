import { projectsHttp } from "~/server/compose";
import type { Route } from "./+types/api.projects-status";

export async function loader({ request, context }: Route.LoaderArgs) {
  return projectsHttp(context).status(request);
}
