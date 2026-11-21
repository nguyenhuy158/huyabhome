import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "../../scripts/install-tools.sh");
const MAIN_CALL = 'main "$@"';
const STUB_NAMES = [
  "bws",
  "gh",
  "cf",
  "wrangler",
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
const SYSTEM_PATH = "/usr/bin:/bin";

const stub = (dir: string, name: string, body: string) => {
  const file = join(dir, name);
  writeFileSync(file, `#!/bin/bash\n${body}\n`);
  chmodSync(file, 0o755);
};

const loggingCurlBody = (log: string) => `
echo "$*" >> "${log}"
out=""
while [ $# -gt 0 ]; do
  [ "$1" = "-o" ] && out="$2"
  shift
done
if [ -n "$out" ] && [ "$out" != "/dev/null" ]; then
  printf '#!/bin/bash\\necho "cloudflared 9.9.9"\\n' > "$out"
fi
exit 0`;

const npmBody = (log: string, onInstall = "") => `
echo "$*" >> "${log}"
case "$1" in
  view) echo "9.9.9" ;;
  install) ${onInstall || ":"} ;;
esac
exit 0`;

const MISE_ARCH = process.arch === "arm64" ? "arm64" : "x64";
const MISE_BINARY = `#!/bin/bash\necho "9.9.9 linux-${MISE_ARCH}"\n`;
const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

const miseCurlBody = (log: string, sum: string) => `
echo "$*" >> "${log}"
out=""
url=""
while [ $# -gt 0 ]; do
  [ "$1" = "-o" ] && out="$2"
  url="$1"
  shift
done
case "$url" in
  *SHASUMS256.txt) printf '%s  ./mise-v9.9.9-linux-${MISE_ARCH}\\n' '${sum}' > "$out" ;;
  *) printf '#!/bin/bash\\necho "9.9.9 linux-${MISE_ARCH}"\\n' > "$out" ;;
esac
exit 0`;

const URL_LAST = /\shttps:\/\/\S+$/;

const GH_LOGGED_OUT = `[ "$1" = auth ] && exit 1
echo "gh version 9.9.9"`;

const GH_LOGGED_IN = `case "$1" in
  auth) exit 0 ;;
  repo) echo "gh repo must not be called" >&2; exit 1 ;;
esac
echo "gh version 9.9.9"`;

const gitCloneBody = (log: string, cloneStatus = 0) => `
echo "$*" >> "${log}"
case " $* " in
  *" clone "*)
    [ ${cloneStatus} -ne 0 ] && exit ${cloneStatus}
    dir="\${@: -1}"
    mkdir -p "$dir/.git" "$dir/src"
    : > "$dir/src/server.mjs"
    : > "$dir/src/cli.mjs"
    exit 0 ;;
esac
printf "abc\\trefs/tags/v9.9.9\\n"`;

const HEAD_FLAG = " -I ";
const withoutHeads = (lines: string[]) =>
  lines.filter((line) => !line.includes(HEAD_FLAG));

const OLD_TAG = "v9.9.8";
const TWO_TAGS = `printf "abc\\trefs/tags/v9.9.9\\nabc\\trefs/tags/${OLD_TAG}\\n"`;

const fallbackCurlBody = (log: string, sum: string) => `
echo "$*" >> "${log}"
out=""
url=""
head=0
while [ $# -gt 0 ]; do
  [ "$1" = "-o" ] && out="$2"
  [ "$1" = "-I" ] && head=1
  url="$1"
  shift
done
case "$url" in
  *v9.9.9*) exit 22 ;;
esac
[ "$head" = 1 ] && exit 0
case "$url" in
  *SHASUMS256.txt) printf '%s  ./mise-${OLD_TAG}-linux-${MISE_ARCH}\\n' '${sum}' > "$out" ;;
  *) printf '#!/bin/bash\\necho "9.9.9 linux-${MISE_ARCH}"\\n' > "$out" ;;
esac
exit 0`;

const NODE_22 = `case "$1" in
  -p) echo 22 ;;
  *) echo "v22.18.0" ;;
esac`;

const versionStub = (name: string, extra = "") => `
${extra}
case "$*" in
  *version*) echo "${name} 9.9.9" ;;
esac
exit 0`;

describe("scripts/install-tools.sh", () => {
  let root: string;
  let bin: string;
  let home: string;

  const run = (env: Record<string, string> = {}, input?: string) =>
    spawnSync("bash", input === undefined ? [SCRIPT] : [], {
      input,
      encoding: "utf8",
      env: {
        PATH: `${bin}:${SYSTEM_PATH}`,
        HOME: home,
        INSTALL_DIR: bin,
        README_PATH: join(home, "README.md"),
        TS_STATE_DIR: join(root, "ts"),
        ...env,
      },
    });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "install-tools-"));
    bin = join(root, "bin");
    home = join(root, "home");
    mkdirSync(bin);
    mkdirSync(home);
    for (const name of STUB_NAMES) {
      stub(bin, name, versionStub(name === "cf" ? "cloudflare cf" : name));
    }
    stub(bin, "gh", GH_LOGGED_OUT);
    stub(bin, "biome", 'echo "Version: 9.9.9"');
    stub(bin, "mise", `echo "9.9.9 linux-${MISE_ARCH}"`);
    stub(bin, "npm", npmBody(join(root, "npm.log")));
    stub(bin, "node", 'echo "22.18.0"');
    stub(bin, "git", 'printf "abc\\trefs/tags/v9.9.9\\n"');
    stub(bin, "curl", "echo curl must not be called >&2; exit 1");
    stub(
      bin,
      "tailscale",
      `case "$*" in
  *status*) echo '{"BackendState":"Running"}' ;;
  *version*) echo "1.2.3" ;;
esac
exit 0`,
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("has valid bash syntax", () => {
    expect(spawnSync("bash", ["-n", SCRIPT]).status).toBe(0);
  });

  it("downloads only over https with retries", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toContain("--proto '=https' --tlsv1.2 --retry 3");
    expect(source).not.toMatch(/^\s+curl /m);
  });

  it("upgrades mise after verifying its checksum", () => {
    const log = join(root, "curl.log");
    stub(bin, "mise", `echo "1.0.0 linux-${MISE_ARCH}"`);
    stub(bin, "curl", miseCurlBody(log, sha256(MISE_BINARY)));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      `mise installed: 9.9.9 linux-${MISE_ARCH} (was: 1.0.0)`,
    );
    const all = readFileSync(log, "utf8").trim().split("\n");
    const calls = withoutHeads(all);
    expect(calls).toHaveLength(2);
    expect(all).toHaveLength(3);
    for (const call of all) {
      expect(call).toMatch(URL_LAST);
      expect(call).toContain("github.com/jdx/mise/releases/download/v9.9.9/");
    }
  });

  it("uses the previous mise release when the newest tag has no files", () => {
    const log = join(root, "curl.log");
    stub(bin, "mise", `echo "1.0.0 linux-${MISE_ARCH}"`);
    stub(bin, "git", TWO_TAGS);
    stub(bin, "curl", fallbackCurlBody(log, sha256(MISE_BINARY)));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("mise installed");
    const calls = readFileSync(log, "utf8").trim().split("\n");
    const downloads = withoutHeads(calls);
    expect(downloads).toHaveLength(2);
    for (const call of downloads) {
      expect(call).toContain(`/jdx/mise/releases/download/${OLD_TAG}/`);
    }
    expect(calls.filter((call) => call.includes("/v9.9.9/"))).toHaveLength(1);
  });

  it("treats the installed mise as latest when the newest tag has no files", () => {
    const log = join(root, "curl.log");
    stub(bin, "mise", `echo "9.9.8 linux-${MISE_ARCH}"`);
    stub(bin, "git", TWO_TAGS);
    stub(bin, "curl", fallbackCurlBody(log, sha256(MISE_BINARY)));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("mise already at latest: 9.9.8");
    expect(withoutHeads(readFileSync(log, "utf8").trim().split("\n"))).toEqual(
      [],
    );
  });

  it("stops with a clear message when no recent tag has files", () => {
    stub(bin, "mise", `echo "1.0.0 linux-${MISE_ARCH}"`);
    stub(bin, "curl", "exit 22");
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "mise: could not find the latest release tag",
    );
  });

  it("refuses a mise download with a wrong checksum", () => {
    stub(bin, "mise", `echo "1.0.0 linux-${MISE_ARCH}"`);
    stub(bin, "curl", miseCurlBody(join(root, "curl.log"), sha256("other")));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mise: checksum mismatch");
  });

  it("upgrades biome when a newer version exists", () => {
    stub(bin, "biome", 'echo "Version: 1.0.0"');
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("biome installed");
    expect(readFileSync(join(root, "npm.log"), "utf8")).toContain(
      "install --global @biomejs/biome@9.9.9",
    );
  });

  it("installs biome when it is missing", () => {
    rmSync(join(bin, "biome"));
    const installBiome = `printf '#!/bin/bash\\necho "Version: 9.9.9"\\n' > "${bin}/biome"; chmod +x "${bin}/biome"`;
    stub(bin, "npm", npmBody(join(root, "npm.log"), installBiome));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "biome installed: Version: 9.9.9 (was: none)",
    );
  });

  it("passes a URL to every gh download", () => {
    const log = join(root, "curl.log");
    stub(bin, "gh", 'echo "gh version 1.0.0"');
    stub(bin, "curl", loggingCurlBody(log));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("checksum mismatch");
    const all = readFileSync(log, "utf8").trim().split("\n");
    expect(withoutHeads(all)).toHaveLength(2);
    for (const call of all) expect(call).toMatch(URL_LAST);
  });

  it("installs a missing tool and cleans its temp dir without errors", () => {
    const log = join(root, "curl.log");
    rmSync(join(bin, "cloudflared"));
    stub(bin, "curl", loggingCurlBody(log));
    const tmpRoot = join(root, "tmp");
    mkdirSync(tmpRoot);
    const result = run({ SKIP_AUTH: "1", TMPDIR: tmpRoot });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain("unbound variable");
    expect(result.stdout).toContain("cloudflared installed");
    expect(readFileSync(log, "utf8")).toMatch(/cloudflared-linux-\w+$/m);
    expect(readdirSync(tmpRoot)).toEqual([]);
  });

  it("skips installed tools and writes the README without downloading", () => {
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    for (const name of [
      "bws",
      "gh",
      "cf",
      "wrangler",
      "biome",
      "mise",
      "cloudflared",
      "browse",
      "gitleaks",
    ]) {
      expect(result.stdout).toMatch(new RegExp(`${name} already`));
    }
    expect(readFileSync(join(root, "npm.log"), "utf8")).not.toContain(
      "install",
    );
    const readme = readFileSync(join(home, "README.md"), "utf8");
    expect(readme).toContain("<!-- generated by install-tools.sh -->");
    expect(readme).toContain("tailscale");
    expect(readme).toContain("| biome | Version: 9.9.9 |");
  });

  it("skips pipiops when gh is not logged in", () => {
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("pipiops: skipped (gh is not logged in");
    expect(existsSync(join(bin, "pipicli"))).toBe(false);
  });

  it("clones pipiops, installs its deps and links pipimcp and pipicli", () => {
    const gitLog = join(root, "git.log");
    stub(bin, "gh", GH_LOGGED_IN);
    stub(bin, "git", gitCloneBody(gitLog));
    stub(bin, "node", NODE_22);
    const token = "secret-token-value";
    const result = run({
      SKIP_AUTH: "1",
      PIPIMCP_PR_WORKSPACE_TOKEN: token,
    });
    expect(result.status, result.stderr).toBe(0);
    const dir = join(home, ".local/share/pipiops");
    const gitCalls = readFileSync(gitLog, "utf8");
    expect(gitCalls).toContain("credential.helper=!gh auth git-credential");
    expect(gitCalls).toContain(
      `clone --depth 1 -q https://github.com/nguyenhuy158/pipiops ${dir}`,
    );
    expect(readFileSync(join(root, "npm.log"), "utf8")).toContain(
      "ci --omit=dev",
    );
    expect(readlinkSync(join(bin, "pipimcp"))).toBe(
      join(dir, "src/server.mjs"),
    );
    expect(readlinkSync(join(bin, "pipicli"))).toBe(join(dir, "src/cli.mjs"));
    expect(result.stdout).toContain("PR workspace token found (env)");
    expect(result.stdout).not.toContain(token);
    expect(readFileSync(join(home, "README.md"), "utf8")).toContain(
      "| pipimcp, pipicli (pipiops) |",
    );
  });

  it("reports when pipiops has no token source", () => {
    stub(bin, "gh", GH_LOGGED_IN);
    stub(bin, "git", gitCloneBody(join(root, "git.log")));
    stub(bin, "node", NODE_22);
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("no PR workspace token found");
  });

  it("reads the pipiops token source from the token file", () => {
    stub(bin, "gh", GH_LOGGED_IN);
    stub(bin, "git", gitCloneBody(join(root, "git.log")));
    stub(bin, "node", NODE_22);
    const dir = join(home, ".config/pipimcp");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "pr-workspace.token"), "x\n");
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PR workspace token found (file)");
  });

  it("updates an existing pipiops clone instead of cloning again", () => {
    const gitLog = join(root, "git.log");
    stub(bin, "gh", GH_LOGGED_IN);
    stub(bin, "git", gitCloneBody(gitLog));
    stub(bin, "node", NODE_22);
    const dir = join(home, ".local/share/pipiops");
    mkdirSync(join(dir, ".git"), { recursive: true });
    mkdirSync(join(dir, "src"));
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    const gitCalls = readFileSync(gitLog, "utf8");
    expect(gitCalls).toContain(`-C ${dir} pull --ff-only -q`);
    expect(gitCalls).toContain("credential.helper=!gh auth git-credential");
    expect(gitCalls).not.toContain(" clone ");
  });

  it("fails but keeps going when the pipiops clone fails", () => {
    stub(bin, "gh", GH_LOGGED_IN);
    stub(bin, "git", gitCloneBody(join(root, "git.log"), 128));
    stub(bin, "node", NODE_22);
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "pipiops: clone of nguyenhuy158/pipiops failed",
    );
    expect(existsSync(join(home, "README.md"))).toBe(true);
  });

  it("does not overwrite a README it did not write", () => {
    writeFileSync(join(home, "README.md"), "mine\n");
    const result = run({ SKIP_AUTH: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(home, "README.md"), "utf8")).toBe("mine\n");
    expect(existsSync(join(home, "README.install-tools.md"))).toBe(true);
  });

  it("sets the git identity and a gitleaks pre-commit hook", () => {
    const cfg = join(root, "gitcfg");
    stub(
      bin,
      "git",
      `if [ "$1" = config ]; then
  shift; [ "$1" = --global ] && shift
  if [ "$1" = --get ]; then grep "^$2=" "${cfg}" | cut -d= -f2-; exit 0; fi
  echo "$1=$2" >> "${cfg}"; exit 0
fi
printf "abc\\trefs/tags/v9.9.9\\n"`,
    );
    stub(bin, "gitleaks", 'echo "args: $*"');
    writeFileSync(cfg, "");
    const hooks = join(root, "hooks");
    const result = run({ SKIP_AUTH: "1", GIT_HOOKS_DIR: hooks });
    expect(result.status, result.stderr).toBe(0);
    const config = readFileSync(cfg, "utf8");
    expect(config).toContain("user.name=huy");
    expect(config).toContain("user.email=huy.ntq02@gmail.com");
    expect(config).toContain("pull.rebase=true");
    expect(config).toContain("init.defaultBranch=main");
    expect(config).toContain(`core.hooksPath=${hooks}`);
    const hook = spawnSync("bash", [join(hooks, "pre-commit")], {
      encoding: "utf8",
      env: { PATH: `${bin}:${SYSTEM_PATH}` },
    });
    expect(hook.stdout).toContain("git --pre-commit --staged");
  });

  it("exports CLOUDFLARE_API_TOKEN from bws in new shells, once", () => {
    stub(
      bin,
      "bws",
      `case "$*" in
  *"secret list"*) echo '[{"key":"CLOUDFLARE_API_TOKEN","value":"cf-from-bws"}]' ;;
esac
exit 0`,
    );
    const envDir = join(root, "envdir");
    writeFileSync(join(home, ".bashrc"), "");
    for (let i = 0; i < 2; i++) {
      const result = run({ SKIP_AUTH: "1", ENV_DIR: envDir });
      expect(result.status, result.stderr).toBe(0);
    }
    const rc = readFileSync(join(home, ".bashrc"), "utf8");
    expect(rc.split(join(envDir, "env.sh")).length - 1).toBe(2);
    const shell = spawnSync(
      "bash",
      ["-c", `. "${join(home, ".bashrc")}"; printf %s "$CLOUDFLARE_API_TOKEN"`],
      {
        encoding: "utf8",
        env: { PATH: `${bin}:${SYSTEM_PATH}`, BWS_ACCESS_TOKEN: "t" },
      },
    );
    expect(shell.stdout).toBe("cf-from-bws");
    expect(readFileSync(join(envDir, "env.sh"), "utf8")).not.toContain(
      "cf-from-bws",
    );
  });

  it("installs missing dev utils with apt-get", () => {
    const log = join(root, "apt.log");
    stub(bin, "apt-get", `echo "$*" >> "${log}"`);
    stub(bin, "id", "echo 0");
    const result = run({ SKIP_AUTH: "1", DEV_UTILS: "nopeutil:nopepkg" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("install -y nopepkg");
    expect(result.stdout).toContain("dev utils ready");
  });

  it("keeps an existing global core.hooksPath", () => {
    stub(
      bin,
      "git",
      `if [ "$1" = config ]; then
  [ "$4" = core.hooksPath ] && echo /other/hooks
  exit 0
fi
printf "abc\\trefs/tags/v9.9.9\\n"`,
    );
    const hooks = join(root, "hooks");
    const result = run({ SKIP_AUTH: "1", GIT_HOOKS_DIR: hooks });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("skipped, global core.hooksPath");
    expect(existsSync(join(hooks, "pre-commit"))).toBe(false);
  });

  it("runs nothing when the download stops before the final call", () => {
    const lines = readFileSync(SCRIPT, "utf8").split("\n");
    const callIndex = lines.lastIndexOf(MAIN_CALL);
    expect(callIndex).toBeGreaterThan(0);
    const result = run({}, lines.slice(0, callIndex).join("\n"));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(existsSync(join(home, "README.md"))).toBe(false);
  });

  it("runs nothing when the download stops inside a function", () => {
    const lines = readFileSync(SCRIPT, "utf8").split("\n");
    const mainStart = lines.indexOf("main() {");
    const result = run({}, lines.slice(0, mainStart + 4).join("\n"));
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(existsSync(join(home, "README.md"))).toBe(false);
  });

  it("keeps going after a rejected token, then exits 1", async () => {
    stub(
      bin,
      "bws",
      `case "$*" in
  *"secret list"*) echo '[{"key":"CLOUDFLARE_API_TOKEN","value":"x"},{"key":"BB_API_KEY","value":"y"}]' ;;
  *version*) echo "bws 9.9.9" ;;
esac
exit 0`,
    );
    stub(
      bin,
      "cf",
      `case "$*" in
  *zones*) exit 1 ;;
  *version*) echo "cloudflare cf 1.0" ;;
esac
exit 0`,
    );
    const log = join(root, "curl.log");
    stub(bin, "curl", loggingCurlBody(log));
    mkdirSync(join(root, "ts"));
    const socket = join(root, "ts", "tailscaled.sock");
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(socket, resolve));
    const result = await new Promise<ReturnType<typeof spawnSync>>(
      (resolve) => {
        server.unref();
        resolve(run({ BWS_ACCESS_TOKEN: "token" }));
      },
    );
    server.close();
    expect(result.status).toBe(1);
    expect(String(result.stderr)).toContain(
      "CLOUDFLARE_API_TOKEN from bws was rejected",
    );
    expect(String(result.stdout)).toContain(
      "browse: BB_API_KEY from bws works",
    );
    expect(existsSync(join(home, "README.md"))).toBe(true);
    expect(readFileSync(log, "utf8").trim()).toMatch(
      /\shttps:\/\/api\.browserbase\.com\/v1\/projects$/,
    );
  });
});
