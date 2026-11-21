import io
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import install_tools  # noqa: E402
from install_tools import cli  # noqa: E402


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


class Run(unittest.TestCase):
    def test_runs_the_script_with_bash_and_merges_the_environment(self):
        with mock.patch("subprocess.run", return_value=completed(3)) as run:
            code = install_tools.run(["x"], env={"SKIP_AUTH": "1"})
        self.assertEqual(code, 3)
        command = run.call_args.args[0]
        self.assertEqual(command, ["bash", str(install_tools.script_path()), "x"])
        env = run.call_args.kwargs["env"]
        self.assertEqual(env["SKIP_AUTH"], "1")
        self.assertIn("PATH", env)

    def test_reports_a_missing_bash(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError):
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

    def test_skip_auth_sets_the_flag_for_the_script(self):
        with mock.patch.object(cli, "run", return_value=0) as run:
            self.assertEqual(cli.main(["--skip-auth"]), 0)
        run.assert_called_once_with(env={"SKIP_AUTH": "1"})

    def test_no_option_runs_the_script_unchanged(self):
        with mock.patch.object(cli, "run", return_value=5) as run:
            self.assertEqual(cli.main([]), 5)
        run.assert_called_once_with(env=None)

    def test_version_comes_from_the_package(self):
        with self.assertRaises(SystemExit) as stop, redirect_stdout(io.StringIO()):
            cli.main(["--version"])
        self.assertEqual(stop.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
