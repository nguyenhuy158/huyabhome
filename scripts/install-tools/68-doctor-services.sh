DOCTOR_SECRETS="CLOUDFLARE_API_TOKEN BB_API_KEY"

doctor_tailscale() {
  local state
  state="$(tailscale_state)"
  if [ "$state" = "connected" ]; then
    doctor_ok "tailscale" "connected"
  else
    doctor_fail "tailscale" "$state"
  fi
}

doctor_secret() {
  if doctor_isolated bws_secret "$1" >/dev/null 2>&1; then
    doctor_ok "bws $1" "found"
  else
    doctor_warn "bws $1" "not found"
  fi
}

doctor_verify() {
  local name
  if ! can_authenticate; then
    doctor_warn "bws login" "skipped (no BWS_ACCESS_TOKEN, no bws, or SKIP_AUTH=1)"
    return 0
  fi
  if ! doctor_isolated bws secret list >/dev/null 2>&1; then
    doctor_fail "bws login" "bws secret list failed"
    return 0
  fi
  doctor_ok "bws login" "bws secret list works"
  for name in $DOCTOR_SECRETS; do
    doctor_secret "$name"
  done
}

doctor_link() {
  local name="$1"
  if [ -x "$INSTALL_DIR/$name" ]; then
    doctor_ok "$name" "$(readlink "$INSTALL_DIR/$name" 2>/dev/null || echo "$INSTALL_DIR/$name")"
  else
    doctor_fail "$name" "no executable $INSTALL_DIR/$name"
  fi
}

doctor_pipiops_token() {
  local token_source
  token_source="$(doctor_isolated pipiops_token_source)"
  if [ "$token_source" = "none" ]; then
    doctor_warn "pipiops token" "none: set $PIPIOPS_TOKEN_NAME, a token file or a bws secret"
  else
    doctor_ok "pipiops token" "found ($token_source)"
  fi
}

doctor_pipiops() {
  if [ -d "$PIPIOPS_DIR/.git" ]; then
    doctor_ok "pipiops" "$(pipiops_version) in $PIPIOPS_DIR"
  else
    doctor_fail "pipiops" "not cloned in $PIPIOPS_DIR"
  fi
  doctor_link pipimcp
  doctor_link pipicli
  doctor_pipiops_token
}
