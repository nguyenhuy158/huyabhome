export interface Note {
  id: string;
  title: string;
  content: string;
  plainText: string;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  plainText: string;
  updatedAt: string;
}

export const DEFAULT_NOTE_TITLE = "Untitled Note";
export const SUMMARY_TEXT_LENGTH = 100;

export function ownsNote(
  note: Note | null,
  ownerId: string | null,
): note is Note {
  if (!note || !ownerId) return false;
  return note.ownerId === ownerId;
}

export function extractPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export function matchesSearch(note: Note, search: string): boolean {
  const needle = search.toLowerCase();
  if (needle === "") return true;
  return (
    note.title.toLowerCase().includes(needle) ||
    note.plainText.toLowerCase().includes(needle)
  );
}

export function newestFirst(left: Note, right: Note): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

export function summarize(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    plainText: note.plainText.substring(0, SUMMARY_TEXT_LENGTH),
    updatedAt: note.updatedAt,
  };
}
