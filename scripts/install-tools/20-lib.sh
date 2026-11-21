require_brew() {
  command -v brew >/dev/null 2>&1 || { echo "Homebrew not found; install it first (https://brew.sh)" >&2; exit 1; }
}

step_skipped() {
  case " ${INSTALL_SKIP:-} " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

run_step() {
  if step_skipped "$1"; then
    echo "$1: skipped (INSTALL_SKIP)"
    return 0
  fi
  "$2"
}

brew_upgrade_or_install() {
  require_brew
  if command -v "$1" >/dev/null 2>&1; then brew upgrade "$1" || true; else brew install "$1"; fi
}

bws_secret() {
  bws secret list | python3 -I -c '
import json, sys
secrets = {item["key"]: item["value"] for item in json.load(sys.stdin)}
value = secrets.get(sys.argv[1])
if not value:
    sys.exit("bws secret " + sys.argv[1] + " not found")
sys.stdout.write(value)
' "$1"
}

can_authenticate() {
  [ "${SKIP_AUTH:-0}" != "1" ] && [ -n "${BWS_ACCESS_TOKEN:-}" ] && command -v bws >/dev/null 2>&1
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

RELEASE_TAG_CANDIDATES=3

latest_tag_with_asset() {
  local repo="$1" template="$2" installed="${3:-}" tag asset
  for tag in $(git ls-remote --tags --refs "https://github.com/$repo" 'v*' \
    | sed 's#.*refs/tags/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -rV | head -n "$RELEASE_TAG_CANDIDATES"); do
    if [ -n "$installed" ] && [ "${tag#v}" = "$installed" ]; then
      echo "$tag"
      return
    fi
    asset="${template//@TAG@/$tag}"
    asset="${asset//@VERSION@/${tag#v}}"
    if "${CURL[@]}" -I -o /dev/null "https://github.com/$repo/releases/download/$tag/$asset" 2>/dev/null; then
      echo "$tag"
      return
    fi
  done
}

fetch_release_asset() {
  local repo="$1" tag="$2" asset="$3" sums="$4" sums_entry="$5" workdir="$6" label="$7"
  "${CURL[@]}" -o "$workdir/$asset" "https://github.com/$repo/releases/download/$tag/$asset"
  "${CURL[@]}" -o "$workdir/$sums" "https://github.com/$repo/releases/download/$tag/$sums"
  [ "$(sha256_of "$workdir/$asset")" = "$(awk -v f="$sums_entry" '$2 == f {print $1}' "$workdir/$sums")" ] \
    || { echo "$label: checksum mismatch for $asset" >&2; exit 1; }
}
