import argparse
import sys

from . import __version__, run, script_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="install-tools",
        description="Install the dev tools of a huyab machine.",
    )
    parser.add_argument(
        "--skip-auth", action="store_true", help="install only, no login (SKIP_AUTH=1)"
    )
    parser.add_argument("--path", action="store_true", help="print the script path")
    parser.add_argument("--print", action="store_true", help="print the script")
    parser.add_argument("--version", action="version", version=__version__)
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    if args.path:
        print(script_path())
        return 0
    if args.print:
        sys.stdout.write(script_path().read_text())
        return 0
    return run(env={"SKIP_AUTH": "1"} if args.skip_auth else None)
