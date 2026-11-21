import type { AppLoadContext } from "react-router";
import { createNotesHttp, type NotesHttp } from "./adapters/http/notes-http";
import { createKvNoteStore } from "./adapters/kv/kv-note-store";
import { systemClock } from "./adapters/system/system-clock";
import { uuidIds } from "./adapters/system/uuid-ids";
import { createNoteService } from "./core/application/note-service";

export function notesHttp(context: AppLoadContext | undefined): NotesHttp {
  const store = createKvNoteStore(context?.cloudflare?.env?.NOTES);
  return createNotesHttp(
    createNoteService({ store, ids: uuidIds, clock: systemClock }),
  );
}
