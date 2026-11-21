import os
import subprocess
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

SCRIPT_NAME = "install-tools.sh"
BASH_NOT_FOUND = 127

try:
    __version__ = version("huyab-install-tools")
except PackageNotFoundError:
    __version__ = "0+unknown"


def script_path() -> Path:
    return Path(__file__).with_name(SCRIPT_NAME)


def run(args=(), env=None) -> int:
    merged = {**os.environ, **(env or {})}
    try:
        return subprocess.run(
            ["bash", str(script_path()), *args], env=merged, check=False
        ).returncode
    except FileNotFoundError:
        print("install-tools: bash not found", file=sys.stderr)
        return BASH_NOT_FOUND
