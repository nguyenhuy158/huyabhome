doctor_git_identity() {
  local name email
  name="$(git config --global --get user.name 2>/dev/null || true)"
  email="$(git config --global --get user.email 2>/dev/null || true)"
  if [ -n "$name" ] && [ -n "$email" ]; then
    doctor_ok "git identity" "$name <$email>"
  else
    doctor_fail "git identity" "global user.name or user.email is not set"
  fi
}

doctor_git_hook() {
  local hooks_path hook
  hooks_path="$(git config --global --get core.hooksPath 2>/dev/null || true)"
  hook="$hooks_path/pre-commit"
  if [ -z "$hooks_path" ]; then
    doctor_fail "git hook" "core.hooksPath is not set"
  elif [ -x "$hook" ] && grep -q gitleaks "$hook"; then
    doctor_ok "git hook" "gitleaks pre-commit in $hooks_path"
  else
    doctor_warn "git hook" "$hooks_path has no gitleaks pre-commit"
  fi
}

doctor_shell_env() {
  local env_file="${ENV_DIR:-$HOME/.config/install-tools}/env.sh"
  if [ ! -f "$env_file" ]; then
    doctor_fail "shell env" "$env_file is missing"
  elif grep -qsF "$env_file" "$HOME/.bashrc" "$HOME/.zshrc"; then
    doctor_ok "shell env" "sourced from your rc file"
  else
    doctor_warn "shell env" "$env_file exists but no rc file sources it"
  fi
}

doctor_ssh() {
  local config="$HOME/.ssh/config"
  if ! use_userspace_tailscale; then
    doctor_ok "tailnet ssh" "not needed (system tailscale)"
  elif grep -qsF "# BEGIN install-tools tailnet" "$config"; then
    doctor_ok "tailnet ssh" "block present in $config"
  else
    doctor_warn "tailnet ssh" "no install-tools block in $config"
  fi
}
