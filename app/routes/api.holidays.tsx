import { holidaysHttp } from "~/server/compose";

export async function loader() {
  return holidaysHttp().list();
}
