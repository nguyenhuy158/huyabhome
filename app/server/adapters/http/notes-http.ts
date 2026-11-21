import type { NoteService } from "../../core/application/note-service";
import { json } from "./json";
import { ownerCookieHeader, readOwnerId } from "./owner-cookie";

const NOT_FOUND = { error: "Note not found" };

const textOf = (value: FormDataEntryValue | null): string | undefined =>
  typeof value === "string" ? value : undefined;

const ownerOf = (request: Request): string | null =>
  readOwnerId(request.headers.get("cookie"));

const cookieFor = (ownerId: string | undefined) =>
  ownerId ? { "Set-Cookie": ownerCookieHeader(ownerId) } : undefined;

export function createNotesHttp(service: NoteService) {
  async function list(request: Request): Promise<Response> {
    try {
      const search = new URL(request.url).searchParams.get("search") ?? "";
      const { notes, issuedOwnerId } = await service.list({
        ownerId: ownerOf(request),
        search,
      });
      return json(notes, { headers: cookieFor(issuedOwnerId) });
    } catch (error) {
      console.error("Error listing notes:", error);
      return json({ error: "Failed to list notes" }, { status: 500 });
    }
  }

  async function create(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }
    try {
      const form = await request.formData();
      const { note, issuedOwnerId } = await service.create({
        ownerId: ownerOf(request),
        title: textOf(form.get("title")),
      });
      return json(note, { status: 201, headers: cookieFor(issuedOwnerId) });
    } catch (error) {
      console.error("Error creating note:", error);
      return json({ error: "Failed to create note" }, { status: 500 });
    }
  }

  async function get(request: Request, id: string | undefined) {
    try {
      if (!id) return json({ error: "Note ID required" }, { status: 400 });
      const note = await service.get({ ownerId: ownerOf(request), id });
      return note ? json(note) : json(NOT_FOUND, { status: 404 });
    } catch (error) {
      console.error("Error fetching note:", error);
      return json({ error: "Failed to fetch note" }, { status: 500 });
    }
  }

  async function mutate(request: Request, id: string | undefined) {
    try {
      if (!id) return json({ error: "Note ID required" }, { status: 400 });
      const ownerId = ownerOf(request);
      const method = request.method.toUpperCase();

      if (method === "PUT") {
        const form = await request.formData();
        const updated = await service.update({
          ownerId,
          id,
          title: textOf(form.get("title")),
          content: textOf(form.get("content")),
        });
        return updated ? json(updated) : json(NOT_FOUND, { status: 404 });
      }
      if (method === "DELETE") {
        const removed = await service.remove({ ownerId, id });
        return removed
          ? json({ success: true })
          : json(NOT_FOUND, { status: 404 });
      }
      return json({ error: "Method not allowed" }, { status: 405 });
    } catch (error) {
      console.error("Error in note action:", error);
      return json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return { list, create, get, mutate };
}

export type NotesHttp = ReturnType<typeof createNotesHttp>;
