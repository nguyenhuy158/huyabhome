import { describe, expect, it } from "vitest";
import { createNoteService } from "~/server/core/application/note-service";
import type { Note } from "~/server/core/domain/note";
import type { NoteStore } from "~/server/core/ports";

const OWNER_A = "owner-a";
const OWNER_B = "owner-b";

const note = (
  id: string,
  ownerId?: string,
  extra: Partial<Note> = {},
): Note => ({
  id,
  title: `note ${id}`,
  content: "<p>hi</p>",
  plainText: "hi",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...(ownerId ? { ownerId } : {}),
  ...extra,
});

function setup(seed: Note[] = [], lists: Record<string, string[]> = {}) {
  const notes = new Map(seed.map((n) => [n.id, n]));
  const owners = new Map(Object.entries(lists));
  const writes: string[] = [];
  const reads: string[] = [];
  const store: NoteStore = {
    getNote: async (id) => {
      reads.push(`get ${id}`);
      return notes.get(id) ?? null;
    },
    putNote: async (n) => {
      writes.push(`put ${n.id}`);
      notes.set(n.id, n);
    },
    deleteNote: async (id) => {
      writes.push(`delete ${id}`);
      notes.delete(id);
    },
    getOwnerNoteIds: async (ownerId) => {
      reads.push(`list ${ownerId}`);
      return owners.get(ownerId) ?? [];
    },
    putOwnerNoteIds: async (ownerId, ids) => {
      writes.push(`list ${ownerId}`);
      owners.set(ownerId, ids);
    },
  };
  let counter = 0;
  let tick = 0;
  const service = createNoteService({
    store,
    ids: { next: () => `id-${++counter}` },
    clock: { now: () => `2026-03-0${++tick}T00:00:00.000Z` },
  });
  return { service, notes, owners, writes, reads };
}

describe("list", () => {
  it("answers a first-time visitor with nothing and a new owner id, without reading the store", async () => {
    const { service, reads } = setup([note("a1", OWNER_A)], {
      [OWNER_A]: ["a1"],
    });
    expect(await service.list({ ownerId: null })).toEqual({
      notes: [],
      issuedOwnerId: "id-1",
    });
    expect(reads).toEqual([]);
  });

  it("returns only the owner's notes, newest first, as summaries", async () => {
    const { service } = setup(
      [
        note("a1", OWNER_A, { updatedAt: "2026-01-01T00:00:00.000Z" }),
        note("a2", OWNER_A, { updatedAt: "2026-02-01T00:00:00.000Z" }),
        note("b1", OWNER_B),
      ],
      { [OWNER_A]: ["a1", "a2"], [OWNER_B]: ["b1"] },
    );
    const { notes, issuedOwnerId } = await service.list({ ownerId: OWNER_A });
    expect(notes.map((n) => n.id)).toEqual(["a2", "a1"]);
    expect(notes[0]).not.toHaveProperty("content");
    expect(issuedOwnerId).toBeUndefined();
  });

  it("skips a note another owner put in this list, a legacy note and a missing one", async () => {
    const { service } = setup([note("b1", OWNER_B), note("old")], {
      [OWNER_A]: ["b1", "old", "gone"],
    });
    expect((await service.list({ ownerId: OWNER_A })).notes).toEqual([]);
  });

  it("filters by search on title and text, ignoring case", async () => {
    const { service } = setup(
      [
        note("a1", OWNER_A, { title: "Shopping", plainText: "milk" }),
        note("a2", OWNER_A, { title: "Work", plainText: "SHOP floor" }),
        note("a3", OWNER_A, { title: "Misc", plainText: "none" }),
      ],
      { [OWNER_A]: ["a1", "a2", "a3"] },
    );
    const { notes } = await service.list({ ownerId: OWNER_A, search: "shop" });
    expect(notes.map((n) => n.id).sort()).toEqual(["a1", "a2"]);
  });
});

describe("create", () => {
  it("stamps the owner, defaults the title and puts the note first in the list", async () => {
    const { service, notes, owners } = setup([note("a0", OWNER_A)], {
      [OWNER_A]: ["a0"],
    });
    const { note: created, issuedOwnerId } = await service.create({
      ownerId: OWNER_A,
    });
    expect(created.ownerId).toBe(OWNER_A);
    expect(created.title).toBe("Untitled Note");
    expect(created.createdAt).toBe(created.updatedAt);
    expect(issuedOwnerId).toBeUndefined();
    expect(owners.get(OWNER_A)).toEqual([created.id, "a0"]);
    expect(notes.get(created.id)).toEqual(created);
  });

  it("keeps a given title but not an empty one", async () => {
    const { service } = setup();
    expect(
      (await service.create({ ownerId: OWNER_A, title: "mine" })).note.title,
    ).toBe("mine");
    expect(
      (await service.create({ ownerId: OWNER_A, title: "" })).note.title,
    ).toBe("Untitled Note");
  });

  it("mints an owner when there is none and reports it", async () => {
    const { service, owners } = setup();
    const { note: created, issuedOwnerId } = await service.create({
      ownerId: null,
    });
    expect(issuedOwnerId).toBe("id-1");
    expect(created.ownerId).toBe("id-1");
    expect(created.id).toBe("id-2");
    expect(owners.get("id-1")).toEqual(["id-2"]);
  });
});

describe("get", () => {
  const seeded = () =>
    setup([note("a1", OWNER_A), note("old")], { [OWNER_A]: ["a1"] });

  it("returns the owner's note", async () => {
    expect(
      (await seeded().service.get({ ownerId: OWNER_A, id: "a1" }))?.id,
    ).toBe("a1");
  });

  it("returns nothing for another owner, no owner, a legacy note or a missing note", async () => {
    const { service } = seeded();
    expect(await service.get({ ownerId: OWNER_B, id: "a1" })).toBeNull();
    expect(await service.get({ ownerId: null, id: "a1" })).toBeNull();
    expect(await service.get({ ownerId: OWNER_A, id: "old" })).toBeNull();
    expect(await service.get({ ownerId: OWNER_A, id: "nope" })).toBeNull();
  });
});

describe("update", () => {
  const seeded = () =>
    setup([note("a1", OWNER_A, { content: "<p>old</p>", plainText: "old" })], {
      [OWNER_A]: ["a1"],
    });

  it("sets the title, the content and the plain text, and stamps updatedAt from the clock", async () => {
    const { service, notes } = seeded();
    const updated = await service.update({
      ownerId: OWNER_A,
      id: "a1",
      title: "new",
      content: "<p>a &amp; b</p>",
    });
    expect(updated).toMatchObject({
      title: "new",
      content: "<p>a &amp; b</p>",
      plainText: "a & b",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(notes.get("a1")).toEqual(updated);
  });

  it("keeps the title when the new one is empty or missing", async () => {
    const { service } = seeded();
    expect(
      (await service.update({ ownerId: OWNER_A, id: "a1", title: "" }))?.title,
    ).toBe("note a1");
    expect((await service.update({ ownerId: OWNER_A, id: "a1" }))?.title).toBe(
      "note a1",
    );
  });

  it("clears the plain text when the content is cleared", async () => {
    const { service } = seeded();
    const updated = await service.update({
      ownerId: OWNER_A,
      id: "a1",
      content: "",
    });
    expect(updated).toMatchObject({ content: "", plainText: "" });
  });

  it("keeps the content and the plain text when no content is sent", async () => {
    const { service } = seeded();
    const updated = await service.update({
      ownerId: OWNER_A,
      id: "a1",
      title: "only title",
    });
    expect(updated).toMatchObject({ content: "<p>old</p>", plainText: "old" });
  });

  it("refuses another owner, no owner and a missing note, and writes nothing", async () => {
    const { service, writes } = seeded();
    expect(
      await service.update({ ownerId: OWNER_B, id: "a1", title: "x" }),
    ).toBeNull();
    expect(
      await service.update({ ownerId: null, id: "a1", title: "x" }),
    ).toBeNull();
    expect(
      await service.update({ ownerId: OWNER_A, id: "nope", title: "x" }),
    ).toBeNull();
    expect(writes).toEqual([]);
  });
});

describe("remove", () => {
  const seeded = () =>
    setup([note("a1", OWNER_A), note("a2", OWNER_A)], {
      [OWNER_A]: ["a1", "a2"],
    });

  it("deletes the note and takes its id out of the owner's list", async () => {
    const { service, notes, owners } = seeded();
    expect(await service.remove({ ownerId: OWNER_A, id: "a1" })).toBe(true);
    expect(notes.has("a1")).toBe(false);
    expect(owners.get(OWNER_A)).toEqual(["a2"]);
  });

  it("refuses another owner, no owner and a missing note, and writes nothing", async () => {
    const { service, writes } = seeded();
    expect(await service.remove({ ownerId: OWNER_B, id: "a1" })).toBe(false);
    expect(await service.remove({ ownerId: null, id: "a1" })).toBe(false);
    expect(await service.remove({ ownerId: OWNER_A, id: "nope" })).toBe(false);
    expect(writes).toEqual([]);
  });
});
