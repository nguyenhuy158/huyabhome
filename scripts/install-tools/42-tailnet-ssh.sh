tailnet_peer_hosts() {
  tailscale --socket="$TS_SOCKET" status --json | python3 -I -c '
import json, re, sys
status = json.load(sys.stdin)
names = []
for peer in status.get("Peer", {}).values():
    for name in (peer["HostName"], peer["DNSName"].rstrip(".")):
        if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", name) and name != "localhost":
            names.append(name)
print(" ".join(sorted(set(names))), "100.*")
'
}

write_ssh_tailnet_block() {
  local config="$1" hosts="$2" marker_begin="# BEGIN install-tools tailnet" marker_end="# END install-tools tailnet"
  python3 -I - "$config" "$marker_begin" "$marker_end" <<PY
import sys
config, begin, end = sys.argv[1:4]
text = open(config).read()
if begin in text:
    head, rest = text.split(begin, 1)
    text = head + rest.split(end, 1)[1].lstrip("\n")
block = """$marker_begin
Host $hosts
  ProxyCommand tailscale --socket=$TS_SOCKET nc %h %p
$marker_end
"""
open(config, "w").write(text.rstrip("\n") + ("\n\n" if text.strip() else "") + block)
PY
}

setup_tailnet_ssh() {
  use_userspace_tailscale || return 0
  [ -S "$TS_SOCKET" ] || return 0
  local config="$HOME/.ssh/config"
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  touch "$config"
  chmod 600 "$config"
  write_ssh_tailnet_block "$config" "$(tailnet_peer_hosts)"
  echo "ssh: tailnet hosts routed through tailscale nc ($config)"
}
