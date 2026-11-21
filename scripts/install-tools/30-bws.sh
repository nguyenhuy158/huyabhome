install_bws() {
  if command -v bws >/dev/null 2>&1; then
    echo "bws already installed: $(bws --version)"
    return
  fi
  local version workdir
  version="$("${CURL[@]}" -H 'User-Agent: install-tools' https://crates.io/api/v1/crates/bws \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["crate"]["max_stable_version"])')"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  "${CURL[@]}" -o "$workdir/bws.zip" \
    "https://github.com/bitwarden/sdk-sm/releases/download/bws-v${version}/bws-${BWS_TARGET}-${version}.zip"
  python3 -I -c 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' \
    "$workdir/bws.zip" "$workdir"
  $SUDO install -m 755 "$workdir/bws" "$INSTALL_DIR/bws"
  echo "bws installed: $(bws --version)"
}
