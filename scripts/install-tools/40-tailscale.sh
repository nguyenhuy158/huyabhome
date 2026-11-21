TS_STATE_DIR="${TS_STATE_DIR:-$HOME/.local/share/tailscale}"
TS_SOCKET="$TS_STATE_DIR/tailscaled.sock"

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
      require_brew
      brew install tailscale
      ;;
  esac
  echo "tailscale installed: $(tailscale version | head -1)"
}

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
