import type { Note } from "../../core/domain/note";
import type { NoteStore } from "../../core/ports";

export const noteKey = (id: string): string => `notes:${id}`;
export const ownerListKey = (ownerId: string): string =>
  `notes:list:${ownerId}`;

const MISSING_KV_WARNING =
  "NOTES KV namespace not configured. Please add to wrangler.jsonc";

const unconfiguredStore: NoteStore = {
  getNote: async () => null,
  putNote: async () => {},
  deleteNote: async () => {},
  getOwnerNoteIds: async () => [],
  putOwnerNoteIds: async () => {},
};

export function createKvNoteStore(kv: KVNamespace | undefined): NoteStore {
  if (!kv) {
    console.warn(MISSING_KV_WARNING);
    return unconfiguredStore;
  }

  return {
    async getNote(id) {
      return (await kv.get(noteKey(id), "json")) as Note | null;
    },
    async putNote(note) {
      await kv.put(noteKey(note.id), JSON.stringify(note));
    },
    async deleteNote(id) {
      await kv.delete(noteKey(id));
    },
    async getOwnerNoteIds(ownerId) {
      return ((await kv.get(ownerListKey(ownerId), "json")) as string[]) || [];
    },
    async putOwnerNoteIds(ownerId, ids) {
      await kv.put(ownerListKey(ownerId), JSON.stringify(ids));
    },
  };
}
