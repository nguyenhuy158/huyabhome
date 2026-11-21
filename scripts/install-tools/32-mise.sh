install_mise_macos() {
  brew_upgrade_or_install mise
  echo "mise installed: $(mise --version | head -1)"
}

install_mise() {
  [ "$(uname -s)" != "Darwin" ] || { install_mise_macos; return; }
  local installed tag version asset workdir
  installed="$(command -v mise >/dev/null 2>&1 && mise --version | awk '{print $1}' || true)"
  tag="$(latest_tag_with_asset jdx/mise "mise-@TAG@-linux-${MISE_ARCH}" "$installed")"
  [ -n "$tag" ] || { echo "mise: could not find the latest release tag" >&2; exit 1; }
  version="${tag#v}"
  if [ "$installed" = "$version" ]; then
    echo "mise already at latest: $version"
    return
  fi
  asset="mise-${tag}-linux-${MISE_ARCH}"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  fetch_release_asset jdx/mise "$tag" "$asset" SHASUMS256.txt "./$asset" "$workdir" mise
  $SUDO install -m 755 "$workdir/$asset" "$INSTALL_DIR/mise"
  echo "mise installed: $(mise --version | head -1) (was: ${installed:-none})"
}
