INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
NODE_MIN_MAJOR=22
NODE_MIN_MINOR=18
GIT_USER_NAME="huy"
GIT_USER_EMAIL="huy.ntq02@gmail.com"
GIT_HOOKS_DIR="${GIT_HOOKS_DIR:-$HOME/.config/git/hooks}"
DEV_UTILS="${DEV_UTILS:-jq:jq rg:ripgrep fd:fd-find shellcheck:shellcheck shfmt:shfmt sqlite3:sqlite3}"

detect_platform() {
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64)  BWS_TARGET="x86_64-unknown-linux-gnu"; CLOUDFLARED_ASSET="cloudflared-linux-amd64"; GH_ARCH="amd64"; MISE_ARCH="x64"; GITLEAKS_ARCH="x64" ;;
    Linux-aarch64) BWS_TARGET="aarch64-unknown-linux-gnu"; CLOUDFLARED_ASSET="cloudflared-linux-arm64"; GH_ARCH="arm64"; MISE_ARCH="arm64"; GITLEAKS_ARCH="arm64" ;;
    Darwin-arm64)  BWS_TARGET="aarch64-apple-darwin" ;;
    Darwin-x86_64) BWS_TARGET="x86_64-apple-darwin" ;;
    *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
  esac
}

detect_platform

SUDO=""
[ -w "$INSTALL_DIR" ] || SUDO="sudo"

CURL=(curl -fsSL --proto '=https' --tlsv1.2 --retry 3)

TMP_PATHS=()

cleanup() {
  [ "${#TMP_PATHS[@]}" -eq 0 ] || rm -rf "${TMP_PATHS[@]}"
}
trap cleanup EXIT
