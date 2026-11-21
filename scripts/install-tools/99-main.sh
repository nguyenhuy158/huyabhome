main() {
  local failed=0
  install_bws
  install_gh
  install_mise
  install_cf
  install_wrangler
  install_biome
  install_cloudflared
  install_browserbase
  install_gitleaks
  install_dev_utils
  run_step tailscale install_tailscale
  run_step pipiops install_pipiops || failed=1
  run_step git-identity setup_git_identity || failed=1
  run_step git-hook setup_gitleaks_hook || failed=1
  run_step verify verify_tokens || failed=1
  run_step tailscale login_tailscale
  run_step ssh setup_tailnet_ssh
  run_step shell-env setup_shell_env
  run_step readme write_readme
  return "$failed"
}

main "$@"
