"""Offline regression checks for the developer I-Lang verification gate."""
import importlib.util
import json
import pathlib
import shutil
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("verify_ilang", ROOT / "scripts" / "verify-ilang.py")
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)


class ILangVerificationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="adspilot-ilang-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = pathlib.Path(self.directory.name)
        shutil.copytree(ROOT / "skills" / "adspilot", self.root / "skills" / "adspilot")
        (self.root / "tests" / "agent-package").mkdir(parents=True)
        shutil.copyfile(ROOT / "tests" / "agent-package" / "judgments.ilang",
                        self.root / "tests" / "agent-package" / "judgments.ilang")
        self.pin = VERIFY.load_pin(ROOT)

    def test_current_inputs_bind_the_approved_validator(self):
        documents, fixture = VERIFY.check_project_inputs(self.root, self.pin)
        self.assertGreater(len(documents), 0)
        self.assertTrue(fixture.is_file())

    def test_manifest_cannot_change_normative_revision_silently(self):
        path = self.root / "skills" / "adspilot" / "manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest["protocol"]["source_commit"] = "a" * 40
        path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Manifest protocol source differs"):
            VERIFY.check_project_inputs(self.root, self.pin)

    def test_empty_or_headerless_fixtures_fail_before_external_execution(self):
        path = self.root / "tests" / "agent-package" / "judgments.ilang"
        for text in ("", "# fixtures accidentally removed\n", "::JUDGE{v4.0}\n"):
            with self.subTest(text=text):
                path.write_text(text, encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "at least one ::JUDGE"):
                    VERIFY.check_project_inputs(self.root, self.pin)

    def test_profile_cannot_change_revision_while_manifest_stays_current(self):
        path = self.root / "skills" / "adspilot" / "references" / "ilang.md"
        path.write_text(path.read_text(encoding="utf-8").replace(self.pin["revision"], "a" * 40), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "profile differs"):
            VERIFY.check_project_inputs(self.root, self.pin)


if __name__ == "__main__":
    unittest.main()
