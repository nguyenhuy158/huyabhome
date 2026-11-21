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
  install_tailscale
  install_pipiops || failed=1
  setup_git_identity || failed=1
  setup_gitleaks_hook || failed=1
  verify_cf_token || failed=1
  verify_browserbase_key || failed=1
  login_tailscale
  setup_tailnet_ssh
  setup_shell_env
  write_readme
  return "$failed"
}

main "$@"
