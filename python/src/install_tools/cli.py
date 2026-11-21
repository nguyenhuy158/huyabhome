import argparse
import sys

from . import STEPS, __version__, build_env, run, script_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="install-tools",
        description=(
            "Install the generic dev tools (bws, gh, mise, cf, wrangler, biome, "
            "cloudflared, browse, gitleaks, jq, rg, fd, shellcheck, shfmt, sqlite3). "
            "Steps that change your git, ssh or shell config, or log in to a "
            "service, run only when you ask with --with."
        ),
    )
    parser.add_argument(
        "--with",
        dest="steps",
        action="append",
        default=[],
        choices=STEPS,
        metavar="STEP",
        help="also run this step (repeatable): " + ", ".join(STEPS),
    )
    parser.add_argument("--git-name", help="git user.name, for --with git-identity")
    parser.add_argument("--git-email", help="git user.email, for --with git-identity")
    parser.add_argument(
        "--skip-auth", action="store_true", help="install only, no login (SKIP_AUTH=1)"
    )
    parser.add_argument("--list-steps", action="store_true", help="list the steps")
    parser.add_argument("--path", action="store_true", help="print the script path")
    parser.add_argument("--print", action="store_true", help="print the script")
    parser.add_argument("--version", action="version", version=__version__)
    return parser


def env_from(args) -> dict:
    env = {}
    if args.skip_auth:
        env["SKIP_AUTH"] = "1"
    if args.git_name:
        env["GIT_USER_NAME"] = args.git_name
    if args.git_email:
        env["GIT_USER_EMAIL"] = args.git_email
    return env


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.path:
        print(script_path())
        return 0
    if args.print:
        sys.stdout.write(script_path().read_text())
        return 0
    if args.list_steps:
        print("\n".join(STEPS))
        return 0
    steps = list(args.steps)
    if args.git_name or args.git_email:
        steps.append("git-identity")
    env = env_from(args)
    try:
        build_env(env, steps)
    except ValueError as error:
        parser.error(str(error))
    return run(env=env, enable=steps)
