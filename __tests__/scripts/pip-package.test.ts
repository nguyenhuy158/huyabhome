import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM build script without types
import {
  buildInstallTools,
  PIP_COPY,
} from "../../scripts/build-install-tools.mjs";

const ROOT = join(__dirname, "../..");

describe("python/ pip package huyab-install-tools", () => {
  it("bundles the built install script", () => {
    expect(readFileSync(PIP_COPY, "utf8")).toBe(buildInstallTools());
  });

  it("passes its Python tests", () => {
    const result = spawnSync(
      "python3",
      ["-m", "unittest", "discover", "-s", "python/tests"],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
