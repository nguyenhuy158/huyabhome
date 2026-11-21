import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { notesHttp } from "~/server/compose";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  return notesHttp(context).get(request, params.id);
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  return notesHttp(context).mutate(request, params.id);
}
