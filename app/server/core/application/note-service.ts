import {
  DEFAULT_NOTE_TITLE,
  extractPlainText,
  matchesSearch,
  type Note,
  type NoteSummary,
  newestFirst,
  ownsNote,
  summarize,
} from "../domain/note";
import type { Clock, IdGenerator, NoteStore } from "../ports";

export interface NoteServiceDeps {
  store: NoteStore;
  ids: IdGenerator;
  clock: Clock;
}

export interface ListNotesInput {
  ownerId: string | null;
  search?: string;
}

export interface CreateNoteInput {
  ownerId: string | null;
  title?: string;
}

export interface NoteRef {
  ownerId: string | null;
  id: string;
}

export interface UpdateNoteInput extends NoteRef {
  title?: string;
  content?: string;
}

export function createNoteService({ store, ids, clock }: NoteServiceDeps) {
  async function findOwned({ ownerId, id }: NoteRef): Promise<Note | null> {
    const note = await store.getNote(id);
    return ownsNote(note, ownerId) ? note : null;
  }

  async function list({ ownerId, search = "" }: ListNotesInput): Promise<{
    notes: NoteSummary[];
    issuedOwnerId?: string;
  }> {
    if (!ownerId) return { notes: [], issuedOwnerId: ids.next() };

    const noteIds = await store.getOwnerNoteIds(ownerId);
    const stored = await Promise.all(noteIds.map((id) => store.getNote(id)));
    const notes = stored
      .filter((note): note is Note => ownsNote(note, ownerId))
      .filter((note) => matchesSearch(note, search))
      .sort(newestFirst)
      .map(summarize);
    return { notes };
  }

  async function create({
    ownerId,
    title,
  }: CreateNoteInput): Promise<{ note: Note; issuedOwnerId?: string }> {
    const owner = ownerId ?? ids.next();
    const now = clock.now();
    const note: Note = {
      id: ids.next(),
      title: title || DEFAULT_NOTE_TITLE,
      content: "",
      plainText: "",
      createdAt: now,
      updatedAt: now,
      ownerId: owner,
    };

    await store.putNote(note);
    const noteIds = await store.getOwnerNoteIds(owner);
    if (!noteIds.includes(note.id)) {
      await store.putOwnerNoteIds(owner, [note.id, ...noteIds]);
    }
    return ownerId ? { note } : { note, issuedOwnerId: owner };
  }

  async function get(ref: NoteRef): Promise<Note | null> {
    return findOwned(ref);
  }

  async function update({
    title,
    content,
    ...ref
  }: UpdateNoteInput): Promise<Note | null> {
    const existing = await findOwned(ref);
    if (!existing) return null;

    const updated: Note = {
      ...existing,
      title: title || existing.title,
      content: content === undefined ? existing.content : content,
      plainText:
        content === undefined ? existing.plainText : extractPlainText(content),
      updatedAt: clock.now(),
    };
    await store.putNote(updated);
    return updated;
  }

  async function remove(ref: NoteRef): Promise<boolean> {
    const existing = await findOwned(ref);
    if (!existing || !ref.ownerId) return false;

    await store.deleteNote(ref.id);
    const noteIds = await store.getOwnerNoteIds(ref.ownerId);
    await store.putOwnerNoteIds(
      ref.ownerId,
      noteIds.filter((noteId) => noteId !== ref.id),
    );
    return true;
  }

  return { list, create, get, update, remove };
}

export type NoteService = ReturnType<typeof createNoteService>;
