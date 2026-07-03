#!/usr/bin/env python3
"""Generate --update-secrets parameter for Cloud Run services.

Example:
  python scripts/env/build_update_command.py --project ${GCP_PROJECT_ID} \
      --region asia-northeast1 --service billing --env preview
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List


ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = ROOT / "configs" / "environment" / "variables.json"


def load_inventory() -> List[Dict[str, object]]:
    with INVENTORY_PATH.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Cloud Run --update-secrets arguments.")
    parser.add_argument("--project", required=True, help="GCP project ID")
    parser.add_argument("--region", required=True, help="Cloud Run region")
    parser.add_argument("--service", required=True, help="Cloud Run service name")
    parser.add_argument(
        "--env",
        choices=["preview", "production"],
        default="preview",
        help="Environment label (used for logging only; both environments share secret names).",
    )
    parser.add_argument(
        "--include-optional",
        action="store_true",
        help="Include optional variables (those marked required=false).",
    )
    parser.add_argument(
        "--print-command",
        action="store_true",
        help="Print full gcloud command instead of only the --update-secrets value.",
    )
    args = parser.parse_args()

    inventory = load_inventory()
    pairs = []
    for entry in inventory:
        required = bool(entry.get("required", False))
        if not required and not args.include_optional:
            continue
        secret_name = entry.get("secret") or entry.get("name")
        pairs.append(f"{entry['name']}=projects/{args.project}/secrets/{secret_name}/versions/latest")

    update_value = ",".join(pairs)

    if args.print_command:
        command = (
            f"gcloud run services update {args.service} --project={args.project} --region={args.region} "
            f"--update-secrets={update_value}"
        )
        print(command)
    else:
        print(update_value)


if __name__ == "__main__":
    main()
