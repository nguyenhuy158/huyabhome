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
