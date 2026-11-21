readme_intro() {
  cat <<README
$README_MARKER
# This machine

Set up by \`install-tools.sh\` on $(date -u +"%Y-%m-%d %H:%M UTC") (host: $(hostname), $(uname -s) $(uname -m)).

README
}

readme_tools_table() {
  cat <<README
## Installed tools

| Tool | Version | State |
|---|---|---|
| bws (Bitwarden Secrets Manager) | $(tool_version bws) | token in env: $(readme_bws_auth) |
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

README
}

readme_tokens_table() {
  cat <<README
## Where the tokens come from

| Tool | Token | Source |
|---|---|---|
| bws | \`BWS_ACCESS_TOKEN\` | environment variable (set it yourself) |
| cf, wrangler | \`CLOUDFLARE_API_TOKEN\` | bws secret with the same name; new shells export it via \`~/.config/install-tools/env.sh\` |
| browse | \`BB_API_KEY\` | bws secret with the same name |
| tailscale | \`TS_AUTH_KEY\` | environment variable, else bws secret; used by \`tailscale up\` |
| pipimcp, pipicli | \`PIPIMCP_PR_WORKSPACE_TOKEN\` | environment variable, else \`~/.config/pipimcp/pr-workspace.token\`, else bws secret |

No secret is stored in this file or in the script.

README
}

readme_commands() {
  cat <<README
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

Check the machine later, read-only, with \`... | bash -s doctor\`. It exits 1 when a check fails.

Set \`SKIP_AUTH=1\` to install only, without logging in.
README
}
