tailscale_auth_available() {
  [ -n "${TS_AUTH_KEY:-}" ] || can_authenticate
}

write_tailscale_keyfile() {
  if [ -n "${TS_AUTH_KEY:-}" ]; then
    printf '%s' "$TS_AUTH_KEY" > "$1"
  else
    bws_secret TS_AUTH_KEY > "$1"
  fi
}

login_tailscale() {
  [ "${SKIP_AUTH:-0}" != "1" ] || { echo "tailscale: skipped login (SKIP_AUTH=1)"; return; }
  tailscale_auth_available || { echo "tailscale: skipped login (no TS_AUTH_KEY or BWS_ACCESS_TOKEN)"; return; }
  local ts_cmd=(tailscale) up_cmd=(sudo tailscale) keyfile
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
  [ "$(uname -s)" != "Darwin" ] || sudo brew services start tailscale
  keyfile="$(mktemp)"
  chmod 600 "$keyfile"
  TMP_PATHS+=("$keyfile")
  write_tailscale_keyfile "$keyfile"
  "${up_cmd[@]}" up --auth-key="file:$keyfile"
  echo "tailscale connected"
}
