#!/usr/bin/env python3
"""Developer-only checks using immutable, hash-verified upstream validators."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.request

VALIDATOR_NAMES = {"ilang_grammar_validator.py", "ilang_judge_validator.py"}


def load_pin(root):
    pin = json.loads((root / "config" / "ilang-validator-pin.json").read_text(encoding="utf-8"))
    if (pin.get("schema_version") != 1
            or pin.get("repository") != "ilang-ai/ilang-spec"
            or not re.fullmatch(r"[a-f0-9]{40}", pin.get("revision", ""))
            or set(pin.get("validators", {})) != VALIDATOR_NAMES
            or any(not re.fullmatch(r"[a-f0-9]{64}", value)
                   for value in pin["validators"].values())):
        raise ValueError("Malformed approved I-Lang validator pin")
    return pin


def check_project_inputs(root, pin):
    skill = root / "skills" / "adspilot"
    manifest = json.loads((skill / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("protocol", {}).get("source_commit") != pin["revision"]:
        raise ValueError("Manifest protocol source differs from the approved, hash-pinned validators")
    profile = (skill / "references" / "ilang.md").read_text(encoding="utf-8")
    if f'`{pin["revision"]}`' not in profile or f'/blob/{pin["revision"]}/SPEC.md' not in profile:
        raise ValueError("I-Lang profile differs from the approved validator revision")
    documents = sorted(skill.rglob("*.md"))
    if not documents:
        raise ValueError("No skill documents found")
    fixture = root / "tests" / "agent-package" / "judgments.ilang"
    # Fail before downloading/running tools when a fixture is empty or loses its
    # judgment headers. The pinned judge also rejects this with a nonzero exit.
    if not any(line.strip() == "::JUDGE{v5.0}" for line in fixture.read_text(encoding="utf-8").splitlines()):
        raise ValueError("Judgment fixtures must contain at least one ::JUDGE{v5.0} block")
    return documents, fixture


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=pathlib.Path, help="Use already downloaded validators; still verify SHA256")
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent.parent
    pin = load_pin(root)
    documents, fixture = check_project_inputs(root, pin)
    with tempfile.TemporaryDirectory(prefix="adspilot-ilang-") as scratch:
        directory = pathlib.Path(scratch)
        for name, expected in pin["validators"].items():
            if args.cache:
                content = (args.cache / name).read_bytes()
            else:
                url = f'https://raw.githubusercontent.com/{pin["repository"]}/{pin["revision"]}/{name}'
                with urllib.request.urlopen(url, timeout=60) as response:
                    content = response.read()
            if hashlib.sha256(content).hexdigest() != expected:
                raise ValueError(f"Upstream validator hash mismatch: {name}")
            (directory / name).write_bytes(content)
        grammar = directory / "ilang_grammar_validator.py"
        judge = directory / "ilang_judge_validator.py"
        subprocess.run([sys.executable, str(grammar), "--lint", *map(str, documents), "--strict"], check=True)
        subprocess.run([sys.executable, str(judge), "--selftest"], check=True)
        subprocess.run([sys.executable, str(judge), "--check", str(fixture)], check=True)
        print(f'I-Lang syntax and judgment fixtures verified against {pin["revision"]}; not runtime conformance certification.')


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"I-Lang verification failed: {error}", file=sys.stderr)
        sys.exit(1)
