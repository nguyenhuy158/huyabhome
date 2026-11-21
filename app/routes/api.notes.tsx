import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { notesHttp } from "~/server/compose";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return notesHttp(context).list(request);
}

export async function action({ request, context }: ActionFunctionArgs) {
  return notesHttp(context).create(request);
}
