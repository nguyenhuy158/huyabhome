import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createKvNoteStore,
  noteKey,
  ownerListKey,
} from "~/server/adapters/kv/kv-note-store";
import type { Note } from "~/server/core/domain/note";

const note: Note = {
  id: "n1",
  title: "t",
  content: "<p>c</p>",
  plainText: "c",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ownerId: "o1",
};

function fakeKv() {
  const data = new Map<string, string>();
  const kv = {
    get: async (key: string, type?: string) => {
      const raw = data.get(key);
      if (raw === undefined) return null;
      return type === "json" ? JSON.parse(raw) : raw;
    },
    put: async (key: string, value: string) => void data.set(key, value),
    delete: async (key: string) => void data.delete(key),
  } as unknown as KVNamespace;
  return { data, kv };
}

afterEach(() => vi.restoreAllMocks());

describe("key layout", () => {
  it("keeps the keys the production data already uses", () => {
    expect(noteKey("n1")).toBe("notes:n1");
    expect(ownerListKey("o1")).toBe("notes:list:o1");
  });
});

describe("createKvNoteStore", () => {
  it("stores a note as json under its key and reads it back", async () => {
    const { data, kv } = fakeKv();
    const store = createKvNoteStore(kv);
    await store.putNote(note);
    expect(JSON.parse(data.get("notes:n1") ?? "null")).toEqual(note);
    expect(await store.getNote("n1")).toEqual(note);
    await store.deleteNote("n1");
    expect(await store.getNote("n1")).toBeNull();
  });

  it("stores one id list per owner and returns an empty list when there is none", async () => {
    const { data, kv } = fakeKv();
    const store = createKvNoteStore(kv);
    expect(await store.getOwnerNoteIds("o1")).toEqual([]);
    await store.putOwnerNoteIds("o1", ["a", "b"]);
    expect(JSON.parse(data.get("notes:list:o1") ?? "null")).toEqual(["a", "b"]);
    expect(await store.getOwnerNoteIds("o1")).toEqual(["a", "b"]);
    expect(await store.getOwnerNoteIds("o2")).toEqual([]);
  });

  it("works as an empty store, with a warning, when the namespace is not configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createKvNoteStore(undefined);
    expect(warn).toHaveBeenCalledOnce();
    await store.putNote(note);
    expect(await store.getNote("n1")).toBeNull();
    expect(await store.getOwnerNoteIds("o1")).toEqual([]);
  });
});
