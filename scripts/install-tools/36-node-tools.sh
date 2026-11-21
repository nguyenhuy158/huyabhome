install_cf() {
  if command -v cf >/dev/null 2>&1 && cf --version 2>/dev/null | grep -qi cloudflare; then
    echo "cf already installed: $(cf --version)"
    return
  fi
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  local node_major node_minor
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  node_minor="$(node -p 'process.versions.node.split(".")[1]')"
  if [ "$node_major" -lt "$NODE_MIN_MAJOR" ] || { [ "$node_major" -eq "$NODE_MIN_MAJOR" ] && [ "$node_minor" -lt "$NODE_MIN_MINOR" ]; }; then
    echo "cf needs Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}, found $(node --version)" >&2
    exit 1
  fi
  npm install --global cf
  echo "cf installed: $(cf --version)"
  echo "Tip: if another 'cf' (Cloud Foundry) is on PATH, use 'cloudflare' instead."
}

install_wrangler() {
  if command -v wrangler >/dev/null 2>&1; then
    echo "wrangler already installed: $(wrangler --version | head -1)"
    return
  fi
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  npm install --global wrangler
  echo "wrangler installed: $(wrangler --version | head -1)"
}

install_biome() {
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  local installed latest
  installed="$(command -v biome >/dev/null 2>&1 && biome --version | sed -n '1s/^Version: *//p' || true)"
  latest="$(npm view @biomejs/biome version)"
  [ -n "$latest" ] || { echo "biome: could not find the latest version" >&2; exit 1; }
  if [ "$installed" = "$latest" ]; then
    echo "biome already at latest: $latest"
    return
  fi
  npm install --global "@biomejs/biome@${latest}"
  echo "biome installed: $(biome --version | head -1) (was: ${installed:-none})"
}

install_browserbase() {
  if npm ls --global --depth=0 browse >/dev/null 2>&1; then
    echo "browse already installed: $(browse --version | head -1)"
    return
  fi
  command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}" >&2; exit 1; }
  npm install --global browse
  echo "browse installed: $(browse --version | head -1)"
}
