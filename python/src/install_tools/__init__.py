import os
import subprocess
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

SCRIPT_NAME = "install-tools.sh"
BASH_NOT_FOUND = 127
STEPS = (
    "verify",
    "git-identity",
    "git-hook",
    "ssh",
    "shell-env",
    "pipiops",
    "tailscale",
    "readme",
)
IDENTITY_STEP = "git-identity"
IDENTITY_VARIABLES = ("GIT_USER_NAME", "GIT_USER_EMAIL")

try:
    __version__ = version("huyab-install-tools")
except PackageNotFoundError:
    __version__ = "0+unknown"


def script_path() -> Path:
    return Path(__file__).with_name(SCRIPT_NAME)


def skipped_steps(enable=()) -> str:
    unknown = sorted(set(enable) - set(STEPS))
    if unknown:
        raise ValueError(f"unknown step: {', '.join(unknown)}")
    return " ".join(step for step in STEPS if step not in enable)


def build_env(env=None, enable=()) -> dict:
    explicit = env or {}
    merged = {**os.environ, "INSTALL_SKIP": skipped_steps(enable), **explicit}
    if IDENTITY_STEP in enable and not all(merged.get(v) for v in IDENTITY_VARIABLES):
        raise ValueError(
            f"step {IDENTITY_STEP} needs {' and '.join(IDENTITY_VARIABLES)}"
        )
    return merged


def run(args=(), env=None, enable=()) -> int:
    merged = build_env(env, enable)
    try:
        return subprocess.run(
            ["bash", str(script_path()), *args], env=merged, check=False
        ).returncode
    except FileNotFoundError:
        print("install-tools: bash not found", file=sys.stderr)
        return BASH_NOT_FOUND
