import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM build script without types
import {
  buildInstallTools,
  listParts,
  OUTPUT_FILE,
  PARTS_DIR,
} from "../../scripts/build-install-tools.mjs";

const MAX_FUNCTION_LINES = 30;
const MAX_PART_LINES = 100;
const FUNCTION_START = /^([a-z0-9_]+)\(\) \{$/;

type Fn = { name: string; lines: number; part: string };

const read = (part: string): string[] =>
  readFileSync(join(PARTS_DIR, part), "utf8").trimEnd().split("\n");

const functionsOf = (part: string): Fn[] => {
  const found: Fn[] = [];
  let open: { name: string; start: number } | null = null;
  read(part).forEach((line, index) => {
    const start = FUNCTION_START.exec(line);
    if (start) open = { name: start[1], start: index };
    else if (line === "}" && open) {
      found.push({
        name: open.name,
        lines: index - open.start + 1,
        part,
      });
      open = null;
    }
  });
  return found;
};

const parts: string[] = listParts();

describe("scripts/install-tools/ parts", () => {
  it("builds the committed scripts/install-tools.sh", () => {
    expect(readFileSync(OUTPUT_FILE, "utf8")).toBe(buildInstallTools());
  });

  it("marks the built file as generated, below the shebang", () => {
    const [shebang, notice] = buildInstallTools().split("\n");
    expect(shebang).toBe("#!/usr/bin/env bash");
    expect(notice).toContain("GENERATED");
  });

  it("numbers every part once and ends with main", () => {
    const numbers = parts.map((part) => part.split("-")[0]);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(parts[0]).toBe("00-header.sh");
    expect(parts.at(-1)).toBe("99-main.sh");
    expect(buildInstallTools().trimEnd().split("\n").at(-1)).toBe('main "$@"');
  });

  it.each(parts)("%s has valid bash syntax", (part) => {
    const result = spawnSync("bash", ["-n", join(PARTS_DIR, part)], {
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it.each(parts)("%s stays small", (part) => {
    expect(read(part).length).toBeLessThanOrEqual(MAX_PART_LINES);
  });

  it("keeps every function small", () => {
    const tooLong = parts
      .flatMap(functionsOf)
      .filter((fn) => fn.lines > MAX_FUNCTION_LINES)
      .map((fn) => `${fn.part}: ${fn.name} has ${fn.lines} lines`);
    expect(tooLong).toEqual([]);
  });

  it("defines each function once", () => {
    const names = parts.flatMap(functionsOf).map((fn) => fn.name);
    const duplicated = names.filter((name, i) => names.indexOf(name) !== i);
    expect(duplicated).toEqual([]);
    expect(names.length).toBeGreaterThan(40);
  });
});
