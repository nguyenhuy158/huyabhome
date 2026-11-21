DOCTOR_PREREQS="git curl python3 node npm"
DOCTOR_TOOLS="bws gh mise cf wrangler biome cloudflared browse gitleaks jq rg fd shellcheck shfmt sqlite3"

doctor_isolated() {
  HOME="$DOCTOR_HOME" XDG_CACHE_HOME="$DOCTOR_HOME/cache" XDG_CONFIG_HOME="$DOCTOR_HOME/config" \
    XDG_STATE_HOME="$DOCTOR_HOME/state" XDG_DATA_HOME="$DOCTOR_HOME/data" "$@"
}

doctor_version() {
  doctor_isolated tool_version "$1"
}

doctor_command() {
  local name="$1" version
  if ! command -v "$name" >/dev/null 2>&1; then
    doctor_fail "$name" "not installed"
    return 0
  fi
  version="$(doctor_version "$name" || true)"
  doctor_ok "$name" "${version:-found}"
}

doctor_node_version() {
  command -v node >/dev/null 2>&1 || return 0
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
  if [ "${major:-0}" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null; then
    doctor_ok "node >= $NODE_MIN_MAJOR" "$(node --version)"
  else
    doctor_warn "node >= $NODE_MIN_MAJOR" "found $(node --version); cf, wrangler and pipiops need it"
  fi
}

doctor_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) doctor_ok "PATH" "$INSTALL_DIR is on PATH" ;;
    *) doctor_warn "PATH" "$INSTALL_DIR is not on PATH" ;;
  esac
}

doctor_tools() {
  local name
  for name in $DOCTOR_PREREQS $DOCTOR_TOOLS; do
    doctor_command "$name"
  done
  doctor_node_version
  doctor_path
}
