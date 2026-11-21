# huyab-install-tools

Install the dev tools of a machine with one command. It is the `scripts/install-tools.sh` of [huyabhome](https://github.com/nguyenhuy158/huyabhome) as a pip package. It needs `bash` (Linux or macOS) and no Python dependencies.

```bash
pip install huyab-install-tools
install-tools
```

## Safe by default

A plain `install-tools` installs only the generic CLI tools: bws, gh, mise, cf, wrangler, biome, cloudflared, browse, gitleaks, jq, rg, fd, shellcheck, shfmt, sqlite3.

It does **not** change your git config, your ssh config or your shell rc files, does not log in to any service, and does not write a README. Those are separate steps that run only when you ask:

| Step | What it does when you turn it on |
|---|---|
| `git-identity` | Sets the global git `user.name` and `user.email`. Needs `--git-name` and `--git-email`. |
| `git-hook` | Sets a global pre-commit hook that scans staged changes with gitleaks (changes `core.hooksPath`). |
| `ssh` | Adds tailnet hosts to `~/.ssh/config` (userspace Tailscale only). |
| `shell-env` | Makes new shells export `CLOUDFLARE_API_TOKEN` from bws (edits `~/.bashrc` / `~/.zshrc`). |
| `tailscale` | Installs Tailscale and logs in with `TS_AUTH_KEY`. Uses `sudo`. |
| `pipiops` | Clones the author's private `pipiops` repo with your logged-in `gh`. Useless without access to it. |
| `verify` | Checks the Cloudflare and Browserbase keys stored in your bws. |
| `readme` | Writes `~/README.md` for the machine. |

The tools themselves are installed with `sudo` when the install directory (`/usr/local/bin`) is not writable. Set `INSTALL_DIR` to install somewhere else.

## Command

| Option | Does |
|---|---|
| (none) | Install the generic tools. |
| `--with STEP` | Also run a step from the table (repeatable). |
| `--git-name NAME --git-email EMAIL` | Turn on `git-identity` with your own name and email. |
| `--skip-auth` | Set `SKIP_AUTH=1`: install only, no login, no key checks. |
| `--list-steps` | List the steps. |
| `--path` / `--print` | Print the bundled script path / the script itself. |
| `--version` | Print the package version. |

Environment variables pass through (`BWS_ACCESS_TOKEN`, `TS_AUTH_KEY`, `INSTALL_DIR`, ...).

## Library

```python
import install_tools

install_tools.script_path()                                  # pathlib.Path of the bundled script
install_tools.run()                                          # generic tools only, returns the exit code
install_tools.run(enable=["git-hook"], env={"SKIP_AUTH": "1"})
install_tools.STEPS                                          # the step names
```

`run()` raises `ValueError` for an unknown step, and for `git-identity` without `GIT_USER_NAME` and `GIT_USER_EMAIL`.

The bundled script is the same file as `scripts/install-tools.sh` in the repo, where `curl ... | bash` runs every step. The pip command sets `INSTALL_SKIP` for you; to run the script yourself, use the same variable, for example `INSTALL_SKIP="git-identity ssh" bash script.sh`.

## License

MIT. See [LICENSE](https://github.com/nguyenhuy158/huyabhome/blob/main/python/LICENSE). The tools this package installs keep their own licenses.

## Release (maintainers)

The script is copied here by `pnpm build:install-tools`. Do not edit it by hand.

```bash
python -m build python/
twine check python/dist/*
```

Upload with an API token that is read from a secret store into the environment of the `twine` process only (`TWINE_USERNAME=__token__`, `TWINE_PASSWORD`). Never put the token on a command line or in a file. After the first upload, replace the account-wide token with one limited to this project, or switch to PyPI Trusted Publishing.
