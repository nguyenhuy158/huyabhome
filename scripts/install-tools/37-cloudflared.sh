install_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared already installed: $(cloudflared --version | head -1)"
    return
  fi
  case "$(uname -s)" in
    Linux)
      local workdir
      workdir="$(mktemp -d)"
      TMP_PATHS+=("$workdir")
      "${CURL[@]}" -o "$workdir/cloudflared" \
        "https://github.com/cloudflare/cloudflared/releases/latest/download/${CLOUDFLARED_ASSET}"
      $SUDO install -m 755 "$workdir/cloudflared" "$INSTALL_DIR/cloudflared"
      ;;
    Darwin)
      require_brew
      brew install cloudflared
      ;;
  esac
  echo "cloudflared installed: $(cloudflared --version | head -1)"
}
