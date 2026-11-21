import { describe, expect, it } from "vitest";
import {
  extractPlainText,
  matchesSearch,
  type Note,
  newestFirst,
  ownsNote,
  SUMMARY_TEXT_LENGTH,
  summarize,
} from "~/server/core/domain/note";

const note = (overrides: Partial<Note> = {}): Note => ({
  id: "n1",
  title: "Shopping",
  content: "<p>milk</p>",
  plainText: "milk and eggs",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ownerId: "owner-a",
  ...overrides,
});

describe("ownsNote", () => {
  it("accepts only the owner that created the note", () => {
    expect(ownsNote(note(), "owner-a")).toBe(true);
    expect(ownsNote(note(), "owner-b")).toBe(false);
    expect(ownsNote(note(), null)).toBe(false);
    expect(ownsNote(null, "owner-a")).toBe(false);
  });

  it("never hands a note without an owner to anyone", () => {
    expect(ownsNote(note({ ownerId: undefined }), "owner-a")).toBe(false);
  });
});

describe("extractPlainText", () => {
  it("strips tags, decodes the basic entities and trims", () => {
    expect(extractPlainText("  <p>a&nbsp;b &lt;c&gt; &amp; d</p> ")).toBe(
      "a b <c> & d",
    );
  });

  it("returns an empty string for empty html", () => {
    expect(extractPlainText("")).toBe("");
    expect(extractPlainText("<p></p>")).toBe("");
  });
});

describe("matchesSearch", () => {
  it("matches everything for an empty search", () => {
    expect(matchesSearch(note(), "")).toBe(true);
  });

  it("matches the title or the plain text, ignoring case", () => {
    expect(matchesSearch(note(), "SHOP")).toBe(true);
    expect(matchesSearch(note(), "Eggs")).toBe(true);
    expect(matchesSearch(note(), "bread")).toBe(false);
  });

  it("does not search the html", () => {
    expect(matchesSearch(note({ content: "<b>secret</b>" }), "secret")).toBe(
      false,
    );
  });
});

describe("newestFirst and summarize", () => {
  it("sorts by updatedAt, newest first", () => {
    const older = note({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = note({ id: "new", updatedAt: "2026-02-01T00:00:00.000Z" });
    expect([older, newer].sort(newestFirst).map((n) => n.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("keeps only the list fields and cuts the text", () => {
    const summary = summarize(
      note({ plainText: "x".repeat(SUMMARY_TEXT_LENGTH + 50) }),
    );
    expect(Object.keys(summary).sort()).toEqual([
      "id",
      "plainText",
      "title",
      "updatedAt",
    ]);
    expect(summary.plainText).toHaveLength(SUMMARY_TEXT_LENGTH);
  });
});
