import type { Note } from "./domain/note";

export interface NoteStore {
  getNote(id: string): Promise<Note | null>;
  putNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  getOwnerNoteIds(ownerId: string): Promise<string[]>;
  putOwnerNoteIds(ownerId: string, ids: string[]): Promise<void>;
}

export interface IdGenerator {
  next(): string;
}

export interface Clock {
  now(): string;
}
