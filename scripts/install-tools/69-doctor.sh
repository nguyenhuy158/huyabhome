doctor() {
  echo "install-tools doctor (read-only)"
  DOCTOR_HOME="$(mktemp -d)"
  TMP_PATHS+=("$DOCTOR_HOME")
  doctor_tools
  doctor_step verify doctor_verify
  doctor_step git-identity doctor_git_identity
  doctor_step git-hook doctor_git_hook
  doctor_step tailscale doctor_tailscale
  doctor_step ssh doctor_ssh
  doctor_step shell-env doctor_shell_env
  doctor_step pipiops doctor_pipiops
  doctor_summary
}
