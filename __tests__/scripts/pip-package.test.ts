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

  it("is MIT licensed: the file, the metadata and a build that can read both", () => {
    const license = readFileSync(join(ROOT, "python/LICENSE"), "utf8");
    expect(license.startsWith("MIT License\n")).toBe(true);
    expect(license).toContain("Copyright (c) 2026 Huy Nguyen (nguyenhuy158)");
    const project = readFileSync(join(ROOT, "python/pyproject.toml"), "utf8");
    expect(project).toContain('license = "MIT"');
    expect(project).toContain('license-files = ["LICENSE"]');
    expect(project).toMatch(/requires = \["setuptools>=(7[7-9]|[89]\d)"\]/);
  });

  it("installs two commands, so pipx run, pipx install and mise all find one", () => {
    const project = readFileSync(join(ROOT, "python/pyproject.toml"), "utf8");
    expect(project).toContain('install-tools = "install_tools.cli:main"');
    expect(project).toContain('huyab-install-tools = "install_tools.cli:main"');
  });

  it("installs the short command itools, and scripts/itools.sh runs install-tools.sh", () => {
    const project = readFileSync(join(ROOT, "python/pyproject.toml"), "utf8");
    expect(project).toContain('itools = "install_tools.cli:main"');
    const shim = join(ROOT, "scripts/itools.sh");
    expect(readFileSync(shim, "utf8")).toContain(
      'huyabhome/main/scripts/install-tools.sh | bash -s -- "$@"',
    );
    expect(spawnSync("bash", ["-n", shim]).status).toBe(0);
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
