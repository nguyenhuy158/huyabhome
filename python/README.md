# huyab-install-tools

The `scripts/install-tools.sh` of [huyabhome](https://github.com/nguyenhuy158/huyabhome) as a pip package. It needs `bash` (Linux or macOS), no Python dependencies.

```bash
pip install huyab_install_tools-1.0.0-py3-none-any.whl
install-tools --skip-auth
```

Not published to PyPI in v1. Build the wheel with `python -m build python/`, or install from git:
`pip install "git+https://github.com/nguyenhuy158/huyabhome#subdirectory=python"`.

## Command

| Option | Does |
|---|---|
| (none) | Run the install script. Environment variables pass through (`BWS_ACCESS_TOKEN`, `TS_AUTH_KEY`, `INSTALL_DIR`, ...). |
| `--skip-auth` | Set `SKIP_AUTH=1`: install only, no login. |
| `--path` | Print the path of the bundled script. |
| `--print` | Print the script, for `install-tools --print \| bash`. |
| `--version` | Print the package version. |

## Library

```python
import install_tools

install_tools.script_path()                   # pathlib.Path of the bundled script
install_tools.run(env={"SKIP_AUTH": "1"})     # runs it with bash, returns the exit code
```

The script is copied here by `pnpm build:install-tools`. Do not edit it by hand.
