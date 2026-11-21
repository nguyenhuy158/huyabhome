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
