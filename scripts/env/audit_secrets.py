#!/usr/bin/env python3
"""
Audit and export environment variables defined in configs/environment/variables.json.

Usage:
  python scripts/env/audit_secrets.py --project PROJECT_ID [--export OUTPUT_FILE] [--warn-extra]

The script verifies that every secret listed in the inventory exists in Google
Cloud Secret Manager. When --export is provided, the script writes an .env style
file with `KEY=value` pairs using the latest secret versions. When --warn-extra
is set, the script will list secrets that exist in Secret Manager but are not
referenced in the inventory (helpful for manual cleanup).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set


ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = ROOT / "configs" / "environment" / "variables.json"


def load_inventory() -> List[Dict[str, object]]:
    try:
        with INVENTORY_PATH.open("r", encoding="utf-8") as fp:
            return json.load(fp)
    except FileNotFoundError:
        sys.stderr.write(f"[error] inventory file not found: {INVENTORY_PATH}\n")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"[error] failed to parse inventory: {exc}\n")
        sys.exit(1)


def gcloud(args: List[str], capture_output: bool = False) -> subprocess.CompletedProcess:
    cmd = ["gcloud", *args]
    return subprocess.run(
        cmd,
        check=False,
        text=True,
        capture_output=capture_output,
    )


def check_secret(project: str, secret: str) -> bool:
    result = gcloud(
        ["secrets", "describe", secret, f"--project={project}"],
        capture_output=True,
    )
    return result.returncode == 0


def access_secret(project: str, secret: str, version: str = "latest") -> str:
    result = gcloud(
        ["secrets", "versions", "access", version, f"--secret={secret}", f"--project={project}"],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"failed to access secret {secret}")

    return result.stdout.rstrip("\n")


def list_all_secrets(project: str) -> Set[str]:
    result = gcloud(
        ["secrets", "list", f"--project={project}", "--format=value(name)"],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "failed to list secrets")

    secrets: Set[str] = set()
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        # list output can be fully qualified (projects/<id>/secrets/<name>)
        if "/" in line:
            secrets.add(line.rsplit("/", 1)[-1])
        else:
            secrets.add(line)
    return secrets


def audit(project: str, export_path: Optional[Path], warn_extra: bool) -> int:
    inventory = load_inventory()
    missing: List[Dict[str, object]] = []
    exported: List[str] = []

    inventory_secret_names: Set[str] = {
        str(entry.get("secret") or entry.get("name")) for entry in inventory
    }

    for entry in inventory:
        secret = str(entry.get("secret") or entry.get("name"))
        present = check_secret(project, secret)

        if not present:
            missing.append(entry)
            continue

        if export_path is not None:
            try:
                value = access_secret(project, secret)
            except RuntimeError as exc:
                sys.stderr.write(f"[error] {exc}\n")
                continue

            exported.append(f"{entry['name']}={value}")

    if export_path is not None:
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text("\n".join(exported) + ("\n" if exported else ""), encoding="utf-8")
        print(f"[info] wrote {len(exported)} entries to {export_path}")

    exit_code = 0
    if missing:
        sys.stderr.write("[warn] missing secrets:\n")
        for entry in missing:
            required = "required" if entry.get("required", False) else "optional"
            sys.stderr.write(
                f"  - {entry['secret']} ({entry['name']}, {required}) - {entry.get('description', '')}\n"
            )
        exit_code = 1

    if warn_extra and exit_code == 0:
        try:
            existing = list_all_secrets(project)
        except RuntimeError as exc:
            sys.stderr.write(f"[error] {exc}\n")
        else:
            extra = sorted(existing - inventory_secret_names)
            if extra:
                sys.stderr.write("[info] unmanaged secrets (consider cleanup or documenting):\n")
                for name in extra:
                    sys.stderr.write(f"  - {name}\n")

    if exit_code == 0:
        print("[info] all secrets present")

    return exit_code


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit required secrets defined in the inventory.")
    parser.add_argument("--project", required=True, help="Google Cloud project ID")
    parser.add_argument(
        "--export",
        help="Optional path to write environment variables (KEY=value) retrieved from Secret Manager.",
    )
    parser.add_argument(
        "--warn-extra",
        action="store_true",
        help="List secrets that exist in Secret Manager but are not referenced in the inventory.",
    )
    args = parser.parse_args()

    export_path = Path(args.export) if args.export else None
    exit_code = audit(args.project, export_path, args.warn_extra)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
