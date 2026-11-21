# huyab-install-tools

Install the dev tools of a machine with one command, and check later that the machine is still fine. It is the `scripts/install-tools.sh` of [huyabhome](https://github.com/nguyenhuy158/huyabhome) as a pip package. It needs `bash` (Linux or macOS) and no Python dependencies.

```bash
pipx install huyab-install-tools
install-tools            # install the generic tools
install-tools --doctor   # read-only health check
```

## Install

| With | Command | Upgrade | Remove |
|---|---|---|---|
| pipx (recommended) | `pipx install huyab-install-tools` | `pipx upgrade huyab-install-tools` | `pipx uninstall huyab-install-tools` |
| pipx, no install | `pipx run --spec huyab-install-tools install-tools --doctor` | always the latest | nothing to remove |
| mise | `mise use -g pipx:huyab-install-tools` | `mise upgrade pipx:huyab-install-tools` | `mise unuse -g pipx:huyab-install-tools` |
| pip | `pip install huyab-install-tools` | `pip install -U huyab-install-tools` | `pip uninstall huyab-install-tools` |
| git | `pipx install "git+https://github.com/nguyenhuy158/huyabhome#subdirectory=python"` | run it again with `--force` | `pipx uninstall huyab-install-tools` |

- mise installs the package through its `pipx:` backend, which uses `uv` when it is installed and `pipx` otherwise. Pin a version with `mise use -g pipx:huyab-install-tools@1.1.0`. To use it in one project only, leave out `-g`; mise writes it to `mise.toml`.
- Version 1.1.0 and later install two commands, `install-tools` and `huyab-install-tools`, so `pipx run huyab-install-tools --doctor` also works. Older versions have only `install-tools`; use the `--spec` form above.
- With pipx and mise the commands are not on `PATH` until you run `pipx ensurepath` or `mise activate` (see their docs), once per machine.

## Doctor

`install-tools --doctor` checks the machine and installs nothing. It prints one line per check and a summary, and exits 1 when a check failed, so it works in a script or in cron.

```text
ok    git                    git version 2.43.0
ok    node >= 22             v22.23.5
FAIL  cloudflared            not installed
warn  PATH                   /usr/local/bin is not on PATH
skip  git-identity           (INSTALL_SKIP)

doctor: 20 ok, 1 warnings, 1 failed
```

| Level | Means |
|---|---|
| `ok` | The check passed. |
| `warn` | Worth a look, but it does not fail the run (an old Node, a folder not on `PATH`, a missing token source). |
| `FAIL` | A tool or a step you asked for is missing or broken. The exit code is 1. |
| `skip` | The step is not turned on. |

What it checks:

- **Always:** `git`, `curl`, `python3`, `node` (22 or newer), `npm`, whether the install folder is on `PATH`, and each tool with its version: bws, gh, mise, cf, wrangler, biome, cloudflared, browse, gitleaks, jq, rg, fd, shellcheck, shfmt, sqlite3.
- **Only for the steps you turn on** with `--with STEP`: the git identity, the git hook, Tailscale connected, the tailnet ssh block, the shell env, pipiops (clone, `pipimcp` and `pipicli` links, token source), and the bws login with the names of the secrets (never their values).

Doctor is read-only. It writes no file in your home folder and in the install folder. The tools it runs for their version, and for the bws check, run in a throwaway `HOME`, so their own caches and logs stay out of yours.

The same check is in the script: `curl -fsSL https://raw.githubusercontent.com/nguyenhuy158/huyabhome/main/scripts/install-tools.sh | bash -s doctor`. There it checks every step that is not in `INSTALL_SKIP`, which is all of them by default.

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
| `--doctor` | Check the machine instead of installing (read-only, exit 1 on a failed check). |
| `--with STEP` | Also run (or, with `--doctor`, also check) a step from the table (repeatable). |
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
install_tools.doctor()                                       # read-only check, returns 0 or 1
install_tools.STEPS                                          # the step names
```

`run()` raises `ValueError` for an unknown step, and for `git-identity` without `GIT_USER_NAME` and `GIT_USER_EMAIL`. `doctor()` does not need them: it only reads the identity.

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
