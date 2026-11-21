write_readme() {
  local target
  target="$(readme_path)"
  [ "$target" = "${README_PATH:-$HOME/README.md}" ] \
    || echo "readme: existing README.md is not ours; writing $target instead"
  { readme_intro; readme_tools_table; readme_tokens_table; readme_commands; } > "$target"
  echo "readme: wrote $target"
}
