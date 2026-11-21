install_gitleaks_macos() {
  require_brew
  brew install gitleaks
  echo "gitleaks installed: $(gitleaks version | head -1)"
}

install_gitleaks() {
  if command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks already installed: $(gitleaks version | head -1)"
    return
  fi
  [ "$(uname -s)" != "Darwin" ] || { install_gitleaks_macos; return; }
  local tag version workdir asset
  tag="$(latest_tag_with_asset gitleaks/gitleaks "gitleaks_@VERSION@_linux_${GITLEAKS_ARCH}.tar.gz")"
  [ -n "$tag" ] || { echo "gitleaks: could not find the latest release tag" >&2; exit 1; }
  version="${tag#v}"
  asset="gitleaks_${version}_linux_${GITLEAKS_ARCH}.tar.gz"
  workdir="$(mktemp -d)"
  TMP_PATHS+=("$workdir")
  fetch_release_asset gitleaks/gitleaks "$tag" "$asset" "gitleaks_${version}_checksums.txt" "$asset" "$workdir" gitleaks
  tar -xzf "$workdir/$asset" -C "$workdir" gitleaks
  $SUDO install -m 755 "$workdir/gitleaks" "$INSTALL_DIR/gitleaks"
  echo "gitleaks installed: $(gitleaks version | head -1)"
}
