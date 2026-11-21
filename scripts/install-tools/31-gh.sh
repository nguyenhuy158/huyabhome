gh_installed_version() {
  command -v gh >/dev/null 2>&1 && gh --version | sed -n '1s/^gh version \([0-9.]*\).*/\1/p' || true
}

install_gh_macos() {
  brew_upgrade_or_install gh
  echo "gh installed: $(gh --version | head -1)"
}

install_gh() {
  [ "$(uname -s)" != "Darwin" ] || { install_gh_macos; return; }
  local installed tag version asset workdir
  installed="$(gh_installed_version)"
  tag="$(latest_tag_with_asset cli/cli "gh_@VERSION@_linux_${GH_ARCH}.tar.gz" "$installed")"
  [ -n "$tag" ] || { echo "gh: could not find the latest release tag" >&2; exit 1; }
  version="${tag#v}"
  if [ "$installed" = "$version" ]; then
    echo "gh already at latest: $version"
    return
  fi
  asset="gh_${version}_linux_${GH_ARCH}.tar.gz"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  fetch_release_asset cli/cli "$tag" "$asset" "gh_${version}_checksums.txt" "$asset" "$workdir" gh
  tar -xzf "$workdir/$asset" -C "$workdir"
  $SUDO install -m 755 "$workdir/gh_${version}_linux_${GH_ARCH}/bin/gh" "$INSTALL_DIR/gh"
  echo "gh installed: $(gh --version | head -1) (was: ${installed:-none})"
}
