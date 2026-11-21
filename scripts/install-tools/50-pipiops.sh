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

pipiops_version() {
  [ -d "$PIPIOPS_DIR/.git" ] || { echo "not installed"; return; }
  git -C "$PIPIOPS_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

pipiops_ready() {
  gh auth status >/dev/null 2>&1 \
    || { echo "pipiops: skipped (gh is not logged in; run 'gh auth login' and run this script again)"; return 1; }
  command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1 \
    || { echo "pipiops: skipped (node and npm not found)"; return 1; }
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$node_major" -ge "$PIPIOPS_NODE_MIN_MAJOR" ] 2>/dev/null \
    || { echo "pipiops: skipped (needs Node >= $PIPIOPS_NODE_MIN_MAJOR, found $(node --version))"; return 1; }
}

pipiops_fetch_source() {
  if [ -d "$PIPIOPS_DIR/.git" ]; then
    pipiops_git -C "$PIPIOPS_DIR" pull --ff-only -q \
      || echo "pipiops: could not update $PIPIOPS_DIR, keeping the current copy" >&2
    return 0
  fi
  mkdir -p "$(dirname "$PIPIOPS_DIR")"
  pipiops_git clone --depth 1 -q "https://github.com/$PIPIOPS_REPO" "$PIPIOPS_DIR" \
    || { echo "pipiops: clone of $PIPIOPS_REPO failed" >&2; return 1; }
}

pipiops_install_deps() {
  (cd "$PIPIOPS_DIR" && npm ci --omit=dev --no-audit --no-fund --silent) \
    || { echo "pipiops: npm ci failed in $PIPIOPS_DIR" >&2; return 1; }
}

pipiops_link_commands() {
  local entry
  for entry in pipimcp:server pipicli:cli; do
    $SUDO ln -sf "$PIPIOPS_DIR/src/${entry##*:}.mjs" "$INSTALL_DIR/${entry%%:*}" \
      || { echo "pipiops: could not link ${entry%%:*} into $INSTALL_DIR" >&2; return 1; }
  done
}

pipiops_report_token() {
  local token_source
  token_source="$(pipiops_token_source)"
  if [ "$token_source" = "none" ]; then
    echo "pipiops: no PR workspace token found; set $PIPIOPS_TOKEN_NAME, or add it as a bws secret"
  else
    echo "pipiops: PR workspace token found ($token_source)"
  fi
}

install_pipiops() {
  pipiops_ready || return 0
  pipiops_fetch_source || return 1
  pipiops_install_deps || return 1
  pipiops_link_commands || return 1
  echo "pipiops installed: pipimcp and pipicli ($PIPIOPS_DIR)"
  pipiops_report_token
}
