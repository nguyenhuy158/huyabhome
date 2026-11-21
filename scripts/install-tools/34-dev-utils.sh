install_dev_utils() {
  local entry missing=()
  for entry in $DEV_UTILS; do
    command -v "${entry%%:*}" >/dev/null 2>&1 || missing+=("${entry##*:}")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    case "$(uname -s)" in
      Darwin)
        require_brew
        brew install "${missing[@]/fd-find/fd}"
        ;;
      Linux)
        command -v apt-get >/dev/null 2>&1 || { echo "dev utils: apt-get not found; install ${missing[*]} yourself" >&2; exit 1; }
        local apt_sudo=""
        [ "$(id -u)" -eq 0 ] || apt_sudo="sudo"
        $apt_sudo apt-get update -qq
        $apt_sudo apt-get install -y "${missing[@]}"
        ;;
    esac
  fi
  if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
    $SUDO ln -s "$(command -v fdfind)" "$INSTALL_DIR/fd"
  fi
  echo "dev utils ready"
}
