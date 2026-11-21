verify_cf_token() {
  can_authenticate || { echo "cf: skipped token check (no BWS_ACCESS_TOKEN or SKIP_AUTH=1)"; return; }
  local token
  token="$(bws_secret CLOUDFLARE_API_TOKEN)"
  if CLOUDFLARE_API_TOKEN="$token" cf zones list >/dev/null 2>&1; then
    echo "cf: CLOUDFLARE_API_TOKEN from bws works"
    echo "Use it in your shell with:"
    echo "  export CLOUDFLARE_API_TOKEN=\"\$(bws secret list | python3 -I -c 'import json,sys;print({i[\"key\"]:i[\"value\"] for i in json.load(sys.stdin)}[\"CLOUDFLARE_API_TOKEN\"])')\""
  else
    echo "cf: CLOUDFLARE_API_TOKEN from bws was rejected" >&2
    return 1
  fi
}

verify_tokens() {
  local failed=0
  verify_cf_token || failed=1
  verify_browserbase_key || failed=1
  return "$failed"
}

verify_browserbase_key() {
  can_authenticate || { echo "browse: skipped key check (no BWS_ACCESS_TOKEN or SKIP_AUTH=1)"; return; }
  local key
  key="$(bws_secret BB_API_KEY)"
  if "${CURL[@]}" -o /dev/null -H "X-BB-API-Key: $key" https://api.browserbase.com/v1/projects; then
    echo "browse: BB_API_KEY from bws works"
    echo "Use it in your shell with:"
    echo "  export BB_API_KEY=\"\$(bws secret list | python3 -I -c 'import json,sys;print({i[\"key\"]:i[\"value\"] for i in json.load(sys.stdin)}[\"BB_API_KEY\"])')\""
  else
    echo "browse: BB_API_KEY from bws was rejected" >&2
    return 1
  fi
}
