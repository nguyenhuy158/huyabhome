import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "../../scripts/install-tools.sh");
const SYSTEM_PATH = "/usr/bin:/bin";
const CHECKED_TOOLS = [
  "git",
  "curl",
  "npm",
  "bws",
  "gh",
  "mise",
  "cf",
  "wrangler",
  "biome",
  "cloudflared",
  "browse",
  "gitleaks",
  "jq",
  "rg",
  "fd",
  "shellcheck",
  "shfmt",
  "sqlite3",
];
const PERSONAL_STEPS = [
  "verify",
  "git-identity",
  "git-hook",
  "ssh",
  "shell-env",
  "pipiops",
  "tailscale",
  "readme",
];
const NODE_22 = `case "$1" in
  -p) echo 22 ;;
  *) echo "v22.18.0" ;;
esac`;
const TAILSCALE_RUNNING = `case "$*" in
  *status*) echo '{"BackendState":"Running"}' ;;
  *version*) echo "1.2.3" ;;
esac`;

const stub = (dir: string, name: string, body: string) => {
  const file = join(dir, name);
  writeFileSync(file, `#!/bin/bash\n${body}\n`);
  chmodSync(file, 0o755);
};

const snapshot = (dir: string) =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .sort()
    .map((rel) => {
      const info = statSync(join(dir, rel));
      return `${rel} ${info.isFile() ? info.size : "dir"} ${info.mtimeMs}`;
    });

describe("install-tools.sh doctor", () => {
  let root: string;
  let bin: string;
  let home: string;
  let tmp: string;

  const doctor = (env: Record<string, string> = {}, args = ["doctor"]) =>
    spawnSync("bash", [SCRIPT, ...args], {
      encoding: "utf8",
      env: {
        PATH: `${bin}:${SYSTEM_PATH}`,
        HOME: home,
        INSTALL_DIR: bin,
        TMPDIR: tmp,
        TS_STATE_DIR: join(root, "ts"),
        ...env,
      },
    });

  const skipPersonal = (except: string[] = []) => ({
    INSTALL_SKIP: PERSONAL_STEPS.filter((s) => !except.includes(s)).join(" "),
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "install-doctor-"));
    bin = join(root, "bin");
    home = join(root, "home");
    tmp = join(root, "tmp");
    for (const dir of [bin, home, tmp]) mkdirSync(dir);
    for (const name of CHECKED_TOOLS) stub(bin, name, `echo "${name} 9.9.9"`);
    stub(bin, "node", NODE_22);
    stub(bin, "tailscale", TAILSCALE_RUNNING);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("reports every tool and exits 0, with the personal steps skipped", () => {
    const result = doctor(skipPersonal());
    expect(result.status, result.stdout + result.stderr).toBe(0);
    for (const name of [...CHECKED_TOOLS, "node", "npm"]) {
      expect(result.stdout).toMatch(new RegExp(`^ok +${name} +`, "m"));
    }
    expect(result.stdout).toMatch(/^ok +node >= 22 +v22\.18\.0$/m);
    expect(result.stdout).toMatch(/^ok +PATH +/m);
    for (const step of PERSONAL_STEPS.filter((s) => s !== "readme")) {
      expect(result.stdout).toContain(`skip  ${step}`);
    }
    expect(result.stdout).toContain("doctor: ");
    expect(result.stdout).toContain(" 0 warnings, 0 failed");
  });

  it("installs nothing and changes nothing: home and install folders are identical afterwards", () => {
    const before = [snapshot(home), snapshot(bin), snapshot(tmp)];
    const result = doctor({ ...skipPersonal(), BWS_ACCESS_TOKEN: "token" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect([snapshot(home), snapshot(bin), snapshot(tmp)]).toEqual(before);
    expect(existsSync(join(home, "README.md"))).toBe(false);
  });

  it("names a missing tool and exits 1", () => {
    rmSync(join(bin, "cloudflared"));
    const result = doctor(skipPersonal());
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^FAIL +cloudflared +not installed$/m);
    expect(result.stdout).toContain(" 1 failed");
  });

  it("warns, without failing, when node is older than 22 or the install folder is not on PATH", () => {
    stub(bin, "node", `case "$1" in -p) echo 20 ;; *) echo "v20.1.0" ;; esac`);
    const result = doctor({
      ...skipPersonal(),
      PATH: `${join(root, "elsewhere")}:${bin}:${SYSTEM_PATH}`,
      INSTALL_DIR: join(root, "not-on-path"),
    });
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toMatch(/^warn +node >= 22 +found v20\.1\.0/m);
    expect(result.stdout).toMatch(/^warn +PATH +.*is not on PATH$/m);
  });

  it("runs every tool in a throwaway HOME so their caches and logs stay out of yours", () => {
    const log = join(root, "gh-home.log");
    stub(
      bin,
      "gh",
      `echo "$HOME" >> "${log}"
echo touched > "$HOME/gh-cache"
echo "gh version 9.9.9"`,
    );
    const result = doctor(skipPersonal());
    expect(result.status, result.stdout).toBe(0);
    const seen = readFileSync(log, "utf8").trim();
    expect(seen).not.toBe(home);
    expect(existsSync(join(home, "gh-cache"))).toBe(false);
    expect(existsSync(seen)).toBe(false);
    expect(readdirSync(tmp)).toEqual([]);
  });

  it("checks the steps that are on and reports each result", () => {
    stub(
      bin,
      "git",
      `case "$*" in
  *user.name*) echo "Ann" ;;
  *user.email*) echo "ann@example.com" ;;
  *core.hooksPath*) exit 1 ;;
  *) echo "git version 9.9.9" ;;
esac`,
    );
    const result = doctor({
      INSTALL_SKIP: "verify ssh readme",
      PIPIOPS_DIR: join(home, "pipiops"),
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(
      /^ok +git identity +Ann <ann@example\.com>$/m,
    );
    expect(result.stdout).toMatch(
      /^FAIL +git hook +core\.hooksPath is not set$/m,
    );
    expect(result.stdout).toMatch(/^ok +tailscale +connected$/m);
    expect(result.stdout).toMatch(/^FAIL +shell env +/m);
    expect(result.stdout).toMatch(/^FAIL +pipiops +not cloned/m);
    expect(result.stdout).toMatch(/^FAIL +pipimcp +no executable/m);
    expect(result.stdout).toMatch(/^FAIL +pipicli +no executable/m);
    expect(result.stdout).toMatch(/^warn +pipiops token +none/m);
  });

  it("recognises a working setup", () => {
    const hooks = join(home, "hooks");
    mkdirSync(hooks);
    stub(hooks, "pre-commit", "exec gitleaks git --pre-commit");
    const envDir = join(home, ".config/install-tools");
    mkdirSync(envDir, { recursive: true });
    writeFileSync(join(envDir, "env.sh"), "");
    writeFileSync(join(home, ".bashrc"), `. "${join(envDir, "env.sh")}"\n`);
    const clone = join(home, "pipiops");
    mkdirSync(join(clone, ".git"), { recursive: true });
    for (const name of ["pipimcp", "pipicli"]) stub(bin, name, "exit 0");
    stub(
      bin,
      "git",
      `case "$*" in
  *user.name*) echo "Ann" ;;
  *user.email*) echo "ann@example.com" ;;
  *core.hooksPath*) echo "${hooks}" ;;
  *rev-parse*) echo "abc1234" ;;
  *) echo "git version 9.9.9" ;;
esac`,
    );
    const result = doctor({
      INSTALL_SKIP: "verify ssh readme",
      ENV_DIR: envDir,
      PIPIOPS_DIR: clone,
      PIPIMCP_PR_WORKSPACE_TOKEN: "t".repeat(20),
    });
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toMatch(/^ok +git hook +gitleaks pre-commit in /m);
    expect(result.stdout).toMatch(
      /^ok +shell env +sourced from your rc file$/m,
    );
    expect(result.stdout).toMatch(/^ok +pipiops +abc1234 in /m);
    expect(result.stdout).toMatch(/^ok +pipiops token +found \(env\)$/m);
    expect(result.stdout).not.toContain("t".repeat(20));
  });

  it("checks the bws login and the secret names, never the values", () => {
    stub(
      bin,
      "bws",
      `case "$*" in
  *"secret list"*) echo '[{"key":"CLOUDFLARE_API_TOKEN","value":"secretvalue"}]' ;;
  *) echo "bws 9.9.9" ;;
esac`,
    );
    const result = doctor({
      ...skipPersonal(["verify"]),
      BWS_ACCESS_TOKEN: "token",
    });
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toMatch(/^ok +bws login +bws secret list works$/m);
    expect(result.stdout).toMatch(/^ok +bws CLOUDFLARE_API_TOKEN +found$/m);
    expect(result.stdout).toMatch(/^warn +bws BB_API_KEY +not found$/m);
    expect(result.stdout + result.stderr).not.toContain("secretvalue");
  });

  it("warns that the bws login was not checked when there is no token", () => {
    const result = doctor(skipPersonal(["verify"]));
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toMatch(/^warn +bws login +skipped/m);
  });

  it("fails the bws login when bws cannot list the secrets", () => {
    stub(
      bin,
      "bws",
      `case "$*" in *"secret list"*) exit 1 ;; *) echo "bws 9.9.9" ;; esac`,
    );
    const result = doctor({
      ...skipPersonal(["verify"]),
      BWS_ACCESS_TOKEN: "token",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^FAIL +bws login +bws secret list failed$/m);
  });

  it("rejects an unknown argument with a usage line and exit 2", () => {
    const result = doctor({}, ["nonsense"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: install-tools.sh [doctor]");
    expect(result.stdout).toBe("");
  });
});
