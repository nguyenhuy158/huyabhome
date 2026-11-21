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
  local default_rc=".bashrc" rc shell_name source_line="[ -f \"$env_file\" ] && . \"$env_file\""
  [ "$(uname -s)" != "Darwin" ] || default_rc=".zshrc"
  [ -e "$HOME/$default_rc" ] || touch "$HOME/$default_rc"
  for rc in .bashrc .zshrc; do
    [ -e "$HOME/$rc" ] || continue
    grep -qF "$env_file" "$HOME/$rc" || printf '\n# install-tools: CLOUDFLARE_API_TOKEN from bws\n%s\n' "$source_line" >> "$HOME/$rc"
    shell_name="${rc#.}"
    shell_name="${shell_name%rc}"
    grep -q "mise activate" "$HOME/$rc" || printf '\n# install-tools: mise tools on PATH\ncommand -v mise >/dev/null 2>&1 && eval "$(mise activate %s)"\n' "$shell_name" >> "$HOME/$rc"
  done
  echo "shell: new shells export CLOUDFLARE_API_TOKEN from bws via $env_file and activate mise"
}
