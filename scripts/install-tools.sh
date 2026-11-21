#!/usr/bin/env bash
# Installs bws (Bitwarden Secrets Manager CLI), gh (GitHub CLI, latest release),
# mise (latest release), cf (Cloudflare CLI, beta), wrangler, biome (latest, npm), cloudflared,
# browse (Browserbase CLI), gitleaks, dev utils (jq, rg, fd, shellcheck, shfmt, sqlite3), Tailscale
# and pipiops (private repo: the pipimcp MCP server and the pipicli command, cloned with the logged-in gh).
# Also sets the global git identity, pull.rebase and a global pre-commit hook that scans
# staged changes with gitleaks.
# Linux x86_64 / arm64 and macOS. Idempotent: skips tools already installed.
# gh, mise and biome are the exception: they are upgraded when a newer release exists.
#
# Auth model:
#   bws        reads its token from the BWS_ACCESS_TOKEN env var.
#   cf         uses CLOUDFLARE_API_TOKEN, read from the bws secret of that name.
#              New shells export it too: ~/.config/install-tools/env.sh (no secret stored) is
#              sourced from ~/.bashrc / ~/.zshrc and reads bws when BWS_ACCESS_TOKEN is set.
#   browse     uses BB_API_KEY, read from the bws secret of that name.
#   tailscale  logs in with the TS_AUTH_KEY env var, else the TS_AUTH_KEY bws secret.
#   pipimcp/pipicli  use PIPIMCP_PR_WORKSPACE_TOKEN: env var, else ~/.config/pipimcp/pr-workspace.token,
#              else the bws secret of that name. This script only reports which source is found.
# Without BWS_ACCESS_TOKEN (or TS_AUTH_KEY for tailscale) the tools are installed but not authenticated.
# pipiops is skipped, with a message, when gh is not logged in (gh auth login) or Node is too old.
# In containers without TUN/systemd tailscaled runs in userspace mode and ~/.ssh/config
# routes tailnet hosts through `tailscale nc`.
# Set SKIP_AUTH=1 to install only.
# Finishes by writing a README.md for this machine (README_PATH, default ~/README.md).
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
NODE_MIN_MAJOR=22
NODE_MIN_MINOR=18
GIT_USER_NAME="huy"
GIT_USER_EMAIL="huy.ntq02@gmail.com"
GIT_HOOKS_DIR="${GIT_HOOKS_DIR:-$HOME/.config/git/hooks}"
DEV_UTILS="${DEV_UTILS:-jq:jq rg:ripgrep fd:fd-find shellcheck:shellcheck shfmt:shfmt sqlite3:sqlite3}"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  BWS_TARGET="x86_64-unknown-linux-gnu"; CLOUDFLARED_ASSET="cloudflared-linux-amd64"; GH_ARCH="amd64"; MISE_ARCH="x64"; GITLEAKS_ARCH="x64" ;;
  Linux-aarch64) BWS_TARGET="aarch64-unknown-linux-gnu"; CLOUDFLARED_ASSET="cloudflared-linux-arm64"; GH_ARCH="arm64"; MISE_ARCH="arm64"; GITLEAKS_ARCH="arm64" ;;
  Darwin-arm64)  BWS_TARGET="aarch64-apple-darwin" ;;
  Darwin-x86_64) BWS_TARGET="x86_64-apple-darwin" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

SUDO=""
[ -w "$INSTALL_DIR" ] || SUDO="sudo"

CURL=(curl -fsSL --proto '=https' --tlsv1.2 --retry 3)

TMP_PATHS=()
cleanup() {
  [ "${#TMP_PATHS[@]}" -eq 0 ] || rm -rf "${TMP_PATHS[@]}"
}
trap cleanup EXIT

bws_secret() {
  bws secret list | python3 -I -c '
import json, sys
secrets = {item["key"]: item["value"] for item in json.load(sys.stdin)}
value = secrets.get(sys.argv[1])
if not value:
    sys.exit("bws secret " + sys.argv[1] + " not found")
sys.stdout.write(value)
' "$1"
}

can_authenticate() {
  [ "${SKIP_AUTH:-0}" != "1" ] && [ -n "${BWS_ACCESS_TOKEN:-}" ] && command -v bws >/dev/null 2>&1
}

install_bws() {
  if command -v bws >/dev/null 2>&1; then
    echo "bws already installed: $(bws --version)"
    return
  fi
  local version workdir
  version="$("${CURL[@]}" -H 'User-Agent: install-tools' https://crates.io/api/v1/crates/bws \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["crate"]["max_stable_version"])')"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  "${CURL[@]}" -o "$workdir/bws.zip" \
    "https://github.com/bitwarden/sdk-sm/releases/download/bws-v${version}/bws-${BWS_TARGET}-${version}.zip"
  python3 -I -c 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' \
    "$workdir/bws.zip" "$workdir"
  $SUDO install -m 755 "$workdir/bws" "$INSTALL_DIR/bws"
  echo "bws installed: $(bws --version)"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

RELEASE_TAG_CANDIDATES=3

latest_tag_with_asset() {
  local repo="$1" template="$2" installed="${3:-}" tag asset
  for tag in $(git ls-remote --tags --refs "https://github.com/$repo" 'v*' \
    | sed 's#.*refs/tags/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -rV | head -n "$RELEASE_TAG_CANDIDATES"); do
    if [ -n "$installed" ] && [ "${tag#v}" = "$installed" ]; then
      echo "$tag"
      return
    fi
    asset="${template//@TAG@/$tag}"
    asset="${asset//@VERSION@/${tag#v}}"
    if "${CURL[@]}" -I -o /dev/null "https://github.com/$repo/releases/download/$tag/$asset" 2>/dev/null; then
      echo "$tag"
      return
    fi
  done
}

install_gh() {
  case "$(uname -s)" in
    Darwin)
      command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
      if command -v gh >/dev/null 2>&1; then brew upgrade gh || true; else brew install gh; fi
      echo "gh installed: $(gh --version | head -1)"
      return
      ;;
  esac
  local tag version installed workdir asset
  installed="$(command -v gh >/dev/null 2>&1 && gh --version | sed -n '1s/^gh version \([0-9.]*\).*/\1/p' || true)"
  tag="$(latest_tag_with_asset cli/cli "gh_@VERSION@_linux_${GH_ARCH}.tar.gz" "$installed")"
  [ -n "$tag" ] || { echo "gh: could not find the latest release tag" >&2; exit 1; }
  version="${tag#v}"
  if [ "$installed" = "$version" ]; then
    echo "gh already at latest: $version"
    return
  fi
  asset="gh_${version}_linux_${GH_ARCH}.tar.gz"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  "${CURL[@]}" -o "$workdir/$asset" "https://github.com/cli/cli/releases/download/${tag}/${asset}"
  "${CURL[@]}" -o "$workdir/checksums.txt" "https://github.com/cli/cli/releases/download/${tag}/gh_${version}_checksums.txt"
  [ "$(sha256_of "$workdir/$asset")" = "$(awk -v f="$asset" '$2 == f {print $1}' "$workdir/checksums.txt")" ] \
    || { echo "gh: checksum mismatch for $asset" >&2; exit 1; }
  tar -xzf "$workdir/$asset" -C "$workdir"
  $SUDO install -m 755 "$workdir/gh_${version}_linux_${GH_ARCH}/bin/gh" "$INSTALL_DIR/gh"
  echo "gh installed: $(gh --version | head -1) (was: ${installed:-none})"
}

install_mise() {
  case "$(uname -s)" in
    Darwin)
      command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
      if command -v mise >/dev/null 2>&1; then brew upgrade mise || true; else brew install mise; fi
      echo "mise installed: $(mise --version | head -1)"
      return
      ;;
  esac
  local tag version installed workdir asset
  installed="$(command -v mise >/dev/null 2>&1 && mise --version | awk '{print $1}' || true)"
  tag="$(latest_tag_with_asset jdx/mise "mise-@TAG@-linux-${MISE_ARCH}" "$installed")"
  [ -n "$tag" ] || { echo "mise: could not find the latest release tag" >&2; exit 1; }
  version="${tag#v}"
  if [ "$installed" = "$version" ]; then
    echo "mise already at latest: $version"
    return
  fi
  asset="mise-${tag}-linux-${MISE_ARCH}"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  "${CURL[@]}" -o "$workdir/$asset" "https://github.com/jdx/mise/releases/download/${tag}/${asset}"
  "${CURL[@]}" -o "$workdir/SHASUMS256.txt" "https://github.com/jdx/mise/releases/download/${tag}/SHASUMS256.txt"
  [ "$(sha256_of "$workdir/$asset")" = "$(awk -v f="./$asset" '$2 == f {print $1}' "$workdir/SHASUMS256.txt")" ] \
    || { echo "mise: checksum mismatch for $asset" >&2; exit 1; }
  $SUDO install -m 755 "$workdir/$asset" "$INSTALL_DIR/mise"
  echo "mise installed: $(mise --version | head -1) (was: ${installed:-none})"
}

install_gitleaks() {
  if command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks already installed: $(gitleaks version | head -1)"
    return
  fi
  case "$(uname -s)" in
    Darwin)
      command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
      brew install gitleaks
      echo "gitleaks installed: $(gitleaks version | head -1)"
      return
      ;;
  esac
  local tag version workdir asset
  tag="$(latest_tag_with_asset gitleaks/gitleaks "gitleaks_@VERSION@_linux_${GITLEAKS_ARCH}.tar.gz")"
  [ -n "$tag" ] || { echo "gitleaks: could not find the latest release tag" >&2; exit 1; }
  version="${tag#v}"
  asset="gitleaks_${version}_linux_${GITLEAKS_ARCH}.tar.gz"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  "${CURL[@]}" -o "$workdir/$asset" "https://github.com/gitleaks/gitleaks/releases/download/${tag}/${asset}"
  "${CURL[@]}" -o "$workdir/checksums.txt" "https://github.com/gitleaks/gitleaks/releases/download/${tag}/gitleaks_${version}_checksums.txt"
  [ "$(sha256_of "$workdir/$asset")" = "$(awk -v f="$asset" '$2 == f {print $1}' "$workdir/checksums.txt")" ] \
    || { echo "gitleaks: checksum mismatch for $asset" >&2; exit 1; }
  tar -xzf "$workdir/$asset" -C "$workdir" gitleaks
  $SUDO install -m 755 "$workdir/gitleaks" "$INSTALL_DIR/gitleaks"
  echo "gitleaks installed: $(gitleaks version | head -1)"
}

install_dev_utils() {
  local entry missing=()
  for entry in $DEV_UTILS; do
    command -v "${entry%%:*}" >/dev/null 2>&1 || missing+=("${entry##*:}")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    case "$(uname -s)" in
      Darwin)
        command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
        brew install "${missing[@]/fd-find/fd}"
        ;;
      Linux)
        command -v apt-get >/dev/null 2>&1 || { echo "dev utils: apt-get not found; install ${missing[*]} yourself" >&2; exit 1; }
        local apt_sudo=""
        [ "$(id -u)" -eq 0 ] || apt_sudo="sudo"
        $apt_sudo apt-get update -qq
        $apt_sudo apt-get install -y "${missing[@]}"
        ;;
    esac
  fi
  if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
    $SUDO ln -s "$(command -v fdfind)" "$INSTALL_DIR/fd"
  fi
  echo "dev utils ready"
}

setup_git_identity() {
  command -v git >/dev/null 2>&1 || { echo "git not found; skipped git identity" >&2; return 1; }
  git config --global user.name "$GIT_USER_NAME"
  git config --global user.email "$GIT_USER_EMAIL"
  git config --global pull.rebase true
  git config --global init.defaultBranch main
  echo "git: global identity set to $GIT_USER_NAME <$GIT_USER_EMAIL>"
}

setup_gitleaks_hook() {
  local current
  current="$(git config --global --get core.hooksPath || true)"
  if [ -n "$current" ] && [ "$current" != "$GIT_HOOKS_DIR" ]; then
    echo "gitleaks hook: skipped, global core.hooksPath already points to $current" >&2
    return 0
  fi
  mkdir -p "$GIT_HOOKS_DIR"
  cat > "$GIT_HOOKS_DIR/pre-commit" <<'HOOK'
#!/usr/bin/env bash
command -v gitleaks >/dev/null 2>&1 || { echo "pre-commit: gitleaks not found, scan skipped" >&2; exit 0; }
exec gitleaks git --pre-commit --staged --redact --verbose
HOOK
  chmod 755 "$GIT_HOOKS_DIR/pre-commit"
  git config --global core.hooksPath "$GIT_HOOKS_DIR"
  echo "gitleaks hook: pre-commit scan enabled for every repo ($GIT_HOOKS_DIR)"
}

install_cf() {
  if command -v cf >/dev/null 2>&1 && cf --version 2>/dev/null | grep -qi cloudflare; then
    echo "cf already installed: $(cf --version)"
    return
  fi
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  local node_major node_minor
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  node_minor="$(node -p 'process.versions.node.split(".")[1]')"
  if [ "$node_major" -lt "$NODE_MIN_MAJOR" ] || { [ "$node_major" -eq "$NODE_MIN_MAJOR" ] && [ "$node_minor" -lt "$NODE_MIN_MINOR" ]; }; then
    echo "cf needs Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}, found $(node --version)" >&2
    exit 1
  fi
  npm install --global cf
  echo "cf installed: $(cf --version)"
  echo "Tip: if another 'cf' (Cloud Foundry) is on PATH, use 'cloudflare' instead."
}

install_wrangler() {
  if command -v wrangler >/dev/null 2>&1; then
    echo "wrangler already installed: $(wrangler --version | head -1)"
    return
  fi
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  npm install --global wrangler
  echo "wrangler installed: $(wrangler --version | head -1)"
}

install_biome() {
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  local installed latest
  installed="$(command -v biome >/dev/null 2>&1 && biome --version | sed -n '1s/^Version: *//p' || true)"
  latest="$(npm view @biomejs/biome version)"
  [ -n "$latest" ] || { echo "biome: could not find the latest version" >&2; exit 1; }
  if [ "$installed" = "$latest" ]; then
    echo "biome already at latest: $latest"
    return
  fi
  npm install --global "@biomejs/biome@${latest}"
  echo "biome installed: $(biome --version | head -1) (was: ${installed:-none})"
}

install_browserbase() {
  if npm ls --global --depth=0 browse >/dev/null 2>&1; then
    echo "browse already installed: $(browse --version | head -1)"
    return
  fi
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  npm install --global browse
  echo "browse installed: $(browse --version | head -1)"
}

install_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared already installed: $(cloudflared --version | head -1)"
    return
  fi
  case "$(uname -s)" in
    Linux)
      local workdir
      workdir="$(mktemp -d)"
      TMP_PATHS+=("$workdir")
      "${CURL[@]}" -o "$workdir/cloudflared" \
        "https://github.com/cloudflare/cloudflared/releases/latest/download/${CLOUDFLARED_ASSET}"
      $SUDO install -m 755 "$workdir/cloudflared" "$INSTALL_DIR/cloudflared"
      ;;
    Darwin)
      command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
      brew install cloudflared
      ;;
  esac
  echo "cloudflared installed: $(cloudflared --version | head -1)"
}

install_tailscale() {
  if command -v tailscale >/dev/null 2>&1; then
    echo "tailscale already installed: $(tailscale version | head -1)"
    return
  fi
  case "$(uname -s)" in
    Linux)
      "${CURL[@]}" https://tailscale.com/install.sh | sh
      ;;
    Darwin)
      command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
      brew install tailscale
      ;;
  esac
  echo "tailscale installed: $(tailscale version | head -1)"
}

PIPIOPS_REPO="${PIPIOPS_REPO:-nguyenhuy158/pipiops}"
PIPIOPS_DIR="${PIPIOPS_DIR:-$HOME/.local/share/pipiops}"
PIPIOPS_TOKEN_NAME="PIPIMCP_PR_WORKSPACE_TOKEN"
PIPIOPS_TOKEN_FILE="$HOME/.config/pipimcp/pr-workspace.token"
PIPIOPS_NODE_MIN_MAJOR=22

pipiops_git() {
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' "$@"
}

pipiops_token_source() {
  if [ -n "${PIPIMCP_PR_WORKSPACE_TOKEN:-}" ]; then
    echo "env"
  elif [ -s "$PIPIOPS_TOKEN_FILE" ]; then
    echo "file"
  elif can_authenticate && bws_secret "$PIPIOPS_TOKEN_NAME" >/dev/null 2>&1; then
    echo "bws"
  else
    echo "none"
  fi
}

install_pipiops() {
  gh auth status >/dev/null 2>&1 \
    || { echo "pipiops: skipped (gh is not logged in; run 'gh auth login' and run this script again)"; return 0; }
  command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1 \
    || { echo "pipiops: skipped (node and npm not found)"; return 0; }
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$node_major" -ge "$PIPIOPS_NODE_MIN_MAJOR" ] 2>/dev/null \
    || { echo "pipiops: skipped (needs Node >= $PIPIOPS_NODE_MIN_MAJOR, found $(node --version))"; return 0; }
  if [ -d "$PIPIOPS_DIR/.git" ]; then
    pipiops_git -C "$PIPIOPS_DIR" pull --ff-only -q \
      || echo "pipiops: could not update $PIPIOPS_DIR, keeping the current copy" >&2
  else
    mkdir -p "$(dirname "$PIPIOPS_DIR")"
    pipiops_git clone --depth 1 -q "https://github.com/$PIPIOPS_REPO" "$PIPIOPS_DIR" \
      || { echo "pipiops: clone of $PIPIOPS_REPO failed" >&2; return 1; }
  fi
  (cd "$PIPIOPS_DIR" && npm ci --omit=dev --no-audit --no-fund --silent) \
    || { echo "pipiops: npm ci failed in $PIPIOPS_DIR" >&2; return 1; }
  local entry
  for entry in pipimcp:server pipicli:cli; do
    $SUDO ln -sf "$PIPIOPS_DIR/src/${entry##*:}.mjs" "$INSTALL_DIR/${entry%%:*}" \
      || { echo "pipiops: could not link ${entry%%:*} into $INSTALL_DIR" >&2; return 1; }
  done
  echo "pipiops installed: pipimcp and pipicli ($PIPIOPS_DIR)"
  local token_source
  token_source="$(pipiops_token_source)"
  if [ "$token_source" = "none" ]; then
    echo "pipiops: no PR workspace token found; set $PIPIOPS_TOKEN_NAME, or add it as a bws secret"
  else
    echo "pipiops: PR workspace token found ($token_source)"
  fi
}

pipiops_version() {
  [ -d "$PIPIOPS_DIR/.git" ] || { echo "not installed"; return; }
  git -C "$PIPIOPS_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

verify_cf_token() {
  can_authenticate || { echo "cf: skipped token check (no BWS_ACCESS_TOKEN or SKIP_AUTH=1)"; return; }
  local token
  token="$(bws_secret CLOUDFLARE_API_TOKEN)"
  if CLOUDFLARE_API_TOKEN="$token" cf zones list >/dev/null 2>&1; then
    echo "cf: CLOUDFLARE_API_TOKEN from bws works"
    echo "Use it in your shell with:"
    echo "  export CLOUDFLARE_API_TOKEN=\"\$(bws secret list | python3 -I -c 'import json,sys;print({i[\"key\"]:i[\"value\"] for i in json.load(sys.stdin)}[\"CLOUDFLARE_API_TOKEN\"])')\""
  else
    echo "cf: CLOUDFLARE_API_TOKEN from bws was rejected" >&2
    return 1
  fi
}

verify_browserbase_key() {
  can_authenticate || { echo "browse: skipped key check (no BWS_ACCESS_TOKEN or SKIP_AUTH=1)"; return; }
  local key
  key="$(bws_secret BB_API_KEY)"
  if "${CURL[@]}" -o /dev/null -H "X-BB-API-Key: $key" https://api.browserbase.com/v1/projects; then
    echo "browse: BB_API_KEY from bws works"
    echo "Use it in your shell with:"
    echo "  export BB_API_KEY=\"\$(bws secret list | python3 -I -c 'import json,sys;print({i[\"key\"]:i[\"value\"] for i in json.load(sys.stdin)}[\"BB_API_KEY\"])')\""
  else
    echo "browse: BB_API_KEY from bws was rejected" >&2
    return 1
  fi
}

TS_STATE_DIR="${TS_STATE_DIR:-$HOME/.local/share/tailscale}"
TS_SOCKET="$TS_STATE_DIR/tailscaled.sock"

use_userspace_tailscale() {
  [ "$(uname -s)" = "Linux" ] || return 1
  [ -e /dev/net/tun ] && [ -d /run/systemd/system ] && return 1
  return 0
}

start_userspace_tailscaled() {
  mkdir -p "$TS_STATE_DIR"
  if [ -S "$TS_SOCKET" ] && tailscale --socket="$TS_SOCKET" version >/dev/null 2>&1; then
    return
  fi
  nohup tailscaled --tun=userspace-networking \
    --state="$TS_STATE_DIR/tailscaled.state" --socket="$TS_SOCKET" \
    >"$TS_STATE_DIR/tailscaled.log" 2>&1 &
  local waited=0
  until [ -S "$TS_SOCKET" ] || [ "$waited" -ge 10 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  [ -S "$TS_SOCKET" ] || { echo "tailscaled did not start; see $TS_STATE_DIR/tailscaled.log" >&2; return 1; }
}

tailscale_running() {
  "$@" status --json 2>/dev/null | python3 -I -c '
import json, sys
sys.exit(0 if json.load(sys.stdin).get("BackendState") == "Running" else 1)
' 2>/dev/null
}

login_tailscale() {
  [ "${SKIP_AUTH:-0}" != "1" ] || { echo "tailscale: skipped login (SKIP_AUTH=1)"; return; }
  if [ -z "${TS_AUTH_KEY:-}" ] && ! can_authenticate; then
    echo "tailscale: skipped login (no TS_AUTH_KEY or BWS_ACCESS_TOKEN)"
    return
  fi
  local ts_cmd=(tailscale) up_cmd=(sudo tailscale)
  if use_userspace_tailscale; then
    start_userspace_tailscaled
    ts_cmd=(tailscale --socket="$TS_SOCKET")
    up_cmd=("${ts_cmd[@]}")
    echo "tailscale: userspace mode (no TUN or systemd); socket $TS_SOCKET"
  fi
  if tailscale_running "${ts_cmd[@]}"; then
    echo "tailscale already connected"
    return
  fi
  if [ "$(uname -s)" = "Darwin" ]; then
    sudo brew services start tailscale
  fi
  local keyfile
  keyfile="$(mktemp)"
  chmod 600 "$keyfile"
  TMP_PATHS+=("$keyfile")
  if [ -n "${TS_AUTH_KEY:-}" ]; then
    printf '%s' "$TS_AUTH_KEY" > "$keyfile"
  else
    bws_secret TS_AUTH_KEY > "$keyfile"
  fi
  "${up_cmd[@]}" up --auth-key="file:$keyfile"
  echo "tailscale connected"
}

setup_tailnet_ssh() {
  use_userspace_tailscale || return 0
  [ -S "$TS_SOCKET" ] || return 0
  local hosts
  hosts="$(tailscale --socket="$TS_SOCKET" status --json | python3 -I -c '
import json, re, sys
status = json.load(sys.stdin)
names = []
for peer in status.get("Peer", {}).values():
    for name in (peer["HostName"], peer["DNSName"].rstrip(".")):
        if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", name) and name != "localhost":
            names.append(name)
print(" ".join(sorted(set(names))), "100.*")
')"
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  local config="$HOME/.ssh/config" marker_begin="# BEGIN install-tools tailnet" marker_end="# END install-tools tailnet"
  touch "$config"
  chmod 600 "$config"
  python3 -I - "$config" "$marker_begin" "$marker_end" <<PY
import sys
config, begin, end = sys.argv[1:4]
text = open(config).read()
if begin in text:
    head, rest = text.split(begin, 1)
    text = head + rest.split(end, 1)[1].lstrip("\n")
block = """$marker_begin
Host $hosts
  ProxyCommand tailscale --socket=$TS_SOCKET nc %h %p
$marker_end
"""
open(config, "w").write(text.rstrip("\n") + ("\n\n" if text.strip() else "") + block)
PY
  echo "ssh: tailnet hosts routed through tailscale nc ($config)"
}

setup_shell_env() {
  local env_dir="${ENV_DIR:-$HOME/.config/install-tools}"
  local env_file="$env_dir/env.sh"
  mkdir -p "$env_dir"
  cat > "$env_file" <<'ENVSH'
if [ -n "${BWS_ACCESS_TOKEN:-}" ] && [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && command -v bws >/dev/null 2>&1; then
  _cf_token="$(bws secret list 2>/dev/null | python3 -I -c '
import json, sys
secrets = {item["key"]: item["value"] for item in json.load(sys.stdin)}
sys.stdout.write(secrets.get("CLOUDFLARE_API_TOKEN", ""))
' 2>/dev/null)"
  [ -z "$_cf_token" ] || export CLOUDFLARE_API_TOKEN="$_cf_token"
  unset _cf_token
fi
ENVSH
  chmod 600 "$env_file"
  local default_rc=".bashrc" rc source_line="[ -f \"$env_file\" ] && . \"$env_file\""
  [ "$(uname -s)" != "Darwin" ] || default_rc=".zshrc"
  [ -e "$HOME/$default_rc" ] || touch "$HOME/$default_rc"
  for rc in .bashrc .zshrc; do
    [ -e "$HOME/$rc" ] || continue
    grep -qF "$env_file" "$HOME/$rc" || printf '\n# install-tools: CLOUDFLARE_API_TOKEN from bws\n%s\n' "$source_line" >> "$HOME/$rc"
  done
  echo "shell: new shells export CLOUDFLARE_API_TOKEN from bws via $env_file"
}

tool_version() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || { echo "not installed"; return; }
  case "$name" in
    tailscale) tailscale version 2>/dev/null | head -1 ;;
    gitleaks)  gitleaks version 2>/dev/null | head -1 ;;
    *)         "$name" --version 2>/dev/null | head -1 ;;
  esac
}

tailscale_state() {
  command -v tailscale >/dev/null 2>&1 || { echo "not installed"; return; }
  if tailscale_running tailscale || tailscale_running tailscale --socket="$TS_SOCKET"; then echo "connected"; else echo "not connected"; fi
}

write_readme() {
  local marker="<!-- generated by install-tools.sh -->"
  local target="${README_PATH:-$HOME/README.md}"
  if [ -e "$target" ] && ! grep -qF "$marker" "$target"; then
    target="${target%.md}.install-tools.md"
    echo "readme: existing README.md is not ours; writing $target instead"
  fi
  local bws_auth="no (BWS_ACCESS_TOKEN not set)"
  [ -n "${BWS_ACCESS_TOKEN:-}" ] && bws_auth="yes (BWS_ACCESS_TOKEN is set)"
  cat > "$target" <<README
$marker
# This machine

Set up by \`install-tools.sh\` on $(date -u +"%Y-%m-%d %H:%M UTC") (host: $(hostname), $(uname -s) $(uname -m)).

## Installed tools

| Tool | Version | State |
|---|---|---|
| bws (Bitwarden Secrets Manager) | $(tool_version bws) | token in env: $bws_auth |
| gh (GitHub CLI) | $(tool_version gh) | latest release; \`gh auth login\` or \`GH_TOKEN\` needed |
| cf (Cloudflare CLI, beta) | $(tool_version cf) | uses \`CLOUDFLARE_API_TOKEN\` from bws |
| wrangler | $(tool_version wrangler) | uses \`CLOUDFLARE_API_TOKEN\` from bws |
| biome | $(tool_version biome) | latest release; upgraded on every run |
| mise | $(tool_version mise) | latest release, checksum verified; upgraded on every run |
| cloudflared | $(tool_version cloudflared) | tunnels; login or token needed to run one |
| browse (Browserbase CLI) | $(tool_version browse) | uses \`BB_API_KEY\` from bws |
| gitleaks | $(tool_version gitleaks) | secret scanner; pre-commit hook in \`$GIT_HOOKS_DIR\` |
| jq, rg, fd, shellcheck, shfmt | $(tool_version jq) / $(tool_version rg) | dev utils; installed only when missing |
| tailscale | $(tool_version tailscale) | $(tailscale_state) |
| pipimcp, pipicli (pipiops) | $(pipiops_version) | PR workspace token source: $(pipiops_token_source) |

## Where the tokens come from

| Tool | Token | Source |
|---|---|---|
| bws | \`BWS_ACCESS_TOKEN\` | environment variable (set it yourself) |
| cf, wrangler | \`CLOUDFLARE_API_TOKEN\` | bws secret with the same name; new shells export it via \`~/.config/install-tools/env.sh\` |
| browse | \`BB_API_KEY\` | bws secret with the same name |
| tailscale | \`TS_AUTH_KEY\` | environment variable, else bws secret; used by \`tailscale up\` |
| pipimcp, pipicli | \`PIPIMCP_PR_WORKSPACE_TOKEN\` | environment variable, else \`~/.config/pipimcp/pr-workspace.token\`, else bws secret |

No secret is stored in this file or in the script.

## Common commands

\`\`\`bash
# bws: list secret names only (no values)
bws secret list | python3 -I -c 'import json,sys;[print(i["key"]) for i in json.load(sys.stdin)]'

# cf: use the Cloudflare token from bws for this shell
export CLOUDFLARE_API_TOKEN="\$(bws secret list | python3 -I -c 'import json,sys;print({i["key"]:i["value"] for i in json.load(sys.stdin)}["CLOUDFLARE_API_TOKEN"])')"
cf zones list

# tailscale
tailscale status
sudo tailscale up --auth-key=file:/path/to/keyfile
\`\`\`

## Run it again

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/nguyenhuy158/huyabhome/main/scripts/install-tools.sh | bash
\`\`\`

Set \`SKIP_AUTH=1\` to install only, without logging in.
README
  echo "readme: wrote $target"
}

main() {
  local failed=0
  install_bws
  install_gh
  install_mise
  install_cf
  install_wrangler
  install_biome
  install_cloudflared
  install_browserbase
  install_gitleaks
  install_dev_utils
  install_tailscale
  install_pipiops || failed=1
  setup_git_identity || failed=1
  setup_gitleaks_hook || failed=1
  verify_cf_token || failed=1
  verify_browserbase_key || failed=1
  login_tailscale
  setup_tailnet_ssh
  setup_shell_env
  write_readme
  return "$failed"
}

main "$@"
