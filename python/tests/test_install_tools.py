import io
import os
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import install_tools  # noqa: E402
from install_tools import cli  # noqa: E402

ALL_STEPS = " ".join(install_tools.STEPS)
CLEAN_ENV = {"PATH": os.environ.get("PATH", "")}


def completed(code=0):
    return subprocess.CompletedProcess(args=[], returncode=code)


class BundledScript(unittest.TestCase):
    def test_is_the_built_bash_script(self):
        lines = install_tools.script_path().read_text().splitlines()
        self.assertEqual(lines[0], "#!/usr/bin/env bash")
        self.assertIn("GENERATED", lines[1])
        self.assertEqual(lines[-1], 'main "$@"')

    def test_has_valid_bash_syntax(self):
        result = subprocess.run(
            ["bash", "-n", str(install_tools.script_path())],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_every_step_name_is_known_to_the_script(self):
        script = install_tools.script_path().read_text()
        for step in install_tools.STEPS:
            self.assertIn(f"run_step {step} ", script)


class SafeByDefault(unittest.TestCase):
    def test_skips_every_step_unless_enabled(self):
        self.assertEqual(install_tools.skipped_steps(), ALL_STEPS)

    def test_enabling_a_step_removes_only_that_step(self):
        skipped = install_tools.skipped_steps(["pipiops", "readme"]).split()
        self.assertNotIn("pipiops", skipped)
        self.assertNotIn("readme", skipped)
        self.assertIn("tailscale", skipped)
        self.assertEqual(len(skipped), len(install_tools.STEPS) - 2)

    def test_rejects_an_unknown_step(self):
        with self.assertRaises(ValueError):
            install_tools.skipped_steps(["nope"])

    def test_git_identity_needs_a_name_and_an_email(self):
        with mock.patch.dict(os.environ, CLEAN_ENV, clear=True):
            with self.assertRaises(ValueError):
                install_tools.build_env({}, ["git-identity"])
            with self.assertRaises(ValueError):
                install_tools.build_env({"GIT_USER_NAME": "a"}, ["git-identity"])
            env = install_tools.build_env(
                {"GIT_USER_NAME": "a", "GIT_USER_EMAIL": "a@example.com"},
                ["git-identity"],
            )
        self.assertNotIn("git-identity", env["INSTALL_SKIP"].split())

    def test_the_environment_cannot_unskip_steps_by_accident(self):
        with mock.patch.dict(os.environ, {"INSTALL_SKIP": ""}):
            self.assertEqual(install_tools.build_env()["INSTALL_SKIP"], ALL_STEPS)

    def test_an_explicit_install_skip_wins(self):
        env = install_tools.build_env({"INSTALL_SKIP": "readme"})
        self.assertEqual(env["INSTALL_SKIP"], "readme")


class Run(unittest.TestCase):
    def test_runs_the_script_with_bash_and_the_safe_skip_list(self):
        with mock.patch("subprocess.run", return_value=completed(3)) as run:
            code = install_tools.run(["x"], env={"SKIP_AUTH": "1"})
        self.assertEqual(code, 3)
        self.assertEqual(
            run.call_args.args[0], ["bash", str(install_tools.script_path()), "x"]
        )
        env = run.call_args.kwargs["env"]
        self.assertEqual(env["SKIP_AUTH"], "1")
        self.assertEqual(env["INSTALL_SKIP"], ALL_STEPS)
        self.assertIn("PATH", env)

    def test_reports_a_missing_bash(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError):
            with redirect_stderr(io.StringIO()):
                self.assertEqual(install_tools.run(), install_tools.BASH_NOT_FOUND)


class Cli(unittest.TestCase):
    def output_of(self, argv):
        out = io.StringIO()
        with redirect_stdout(out):
            code = cli.main(argv)
        return code, out.getvalue()

    def test_path_prints_the_script_path(self):
        code, out = self.output_of(["--path"])
        self.assertEqual(code, 0)
        self.assertEqual(out.strip(), str(install_tools.script_path()))

    def test_print_prints_the_script(self):
        code, out = self.output_of(["--print"])
        self.assertEqual(code, 0)
        self.assertEqual(out, install_tools.script_path().read_text())

    def test_list_steps_prints_every_step(self):
        code, out = self.output_of(["--list-steps"])
        self.assertEqual(code, 0)
        self.assertEqual(out.split(), list(install_tools.STEPS))

    def test_no_option_runs_with_every_personal_step_skipped(self):
        with mock.patch.object(cli, "run", return_value=5) as run:
            self.assertEqual(cli.main([]), 5)
        run.assert_called_once_with(env={}, enable=[])

    def test_with_enables_a_step_and_skip_auth_sets_the_flag(self):
        with mock.patch.object(cli, "run", return_value=0) as run:
            cli.main(["--with", "pipiops", "--with", "readme", "--skip-auth"])
        run.assert_called_once_with(
            env={"SKIP_AUTH": "1"}, enable=["pipiops", "readme"]
        )

    def test_git_name_and_email_turn_on_the_git_identity_step(self):
        with mock.patch.object(cli, "run", return_value=0) as run:
            cli.main(["--git-name", "Ann", "--git-email", "ann@example.com"])
        run.assert_called_once_with(
            env={"GIT_USER_NAME": "Ann", "GIT_USER_EMAIL": "ann@example.com"},
            enable=["git-identity"],
        )

    def test_a_git_name_without_an_email_is_an_error_and_runs_nothing(self):
        with mock.patch.dict(os.environ, CLEAN_ENV, clear=True):
            with mock.patch.object(cli, "run") as run:
                with self.assertRaises(SystemExit) as stop, redirect_stderr(
                    io.StringIO()
                ):
                    cli.main(["--git-name", "Ann"])
        self.assertEqual(stop.exception.code, 2)
        run.assert_not_called()

    def test_an_unknown_step_is_an_error(self):
        with self.assertRaises(SystemExit) as stop, redirect_stderr(io.StringIO()):
            cli.main(["--with", "nope"])
        self.assertEqual(stop.exception.code, 2)

    def test_version_comes_from_the_package(self):
        with self.assertRaises(SystemExit) as stop, redirect_stdout(io.StringIO()):
            cli.main(["--version"])
        self.assertEqual(stop.exception.code, 0)


class Doctor(unittest.TestCase):
    def test_the_library_runs_the_doctor_with_the_safe_skip_list(self):
        with mock.patch("subprocess.run", return_value=completed(0)) as run:
            self.assertEqual(install_tools.doctor(), 0)
        self.assertEqual(
            run.call_args.args[0],
            ["bash", str(install_tools.script_path()), "doctor"],
        )
        self.assertEqual(run.call_args.kwargs["env"]["INSTALL_SKIP"], ALL_STEPS)

    def test_the_doctor_returns_the_exit_code_of_the_script(self):
        with mock.patch("subprocess.run", return_value=completed(1)):
            self.assertEqual(install_tools.doctor(), 1)

    def test_checking_the_git_identity_does_not_need_a_name_and_an_email(self):
        with mock.patch.dict(os.environ, CLEAN_ENV, clear=True):
            with mock.patch("subprocess.run", return_value=completed(0)) as run:
                install_tools.doctor(enable=["git-identity"])
        self.assertNotIn("git-identity", run.call_args.kwargs["env"]["INSTALL_SKIP"].split())

    def test_installing_the_git_identity_still_needs_them(self):
        with mock.patch.dict(os.environ, CLEAN_ENV, clear=True):
            with self.assertRaises(ValueError):
                install_tools.run(enable=["git-identity"])

    def test_the_doctor_flag_runs_the_doctor_and_nothing_else(self):
        with mock.patch.object(cli, "run", return_value=1) as run:
            self.assertEqual(cli.main(["--doctor"]), 1)
        run.assert_called_once_with(args=["doctor"], env={}, enable=[])

    def test_the_doctor_flag_checks_the_steps_asked_with(self):
        with mock.patch.object(cli, "run", return_value=0) as run:
            cli.main(["--doctor", "--with", "pipiops", "--skip-auth"])
        run.assert_called_once_with(
            args=["doctor"], env={"SKIP_AUTH": "1"}, enable=["pipiops"]
        )

    def test_the_doctor_flag_accepts_the_git_identity_step_without_a_name(self):
        with mock.patch.dict(os.environ, CLEAN_ENV, clear=True):
            with mock.patch.object(cli, "run", return_value=0) as run:
                cli.main(["--doctor", "--with", "git-identity"])
        run.assert_called_once_with(args=["doctor"], env={}, enable=["git-identity"])

    def test_the_script_has_a_doctor_command(self):
        script = install_tools.script_path().read_text()
        self.assertIn("doctor) doctor ;;", script)
        self.assertIn("doctor_summary", script)


if __name__ == "__main__":
    unittest.main()
