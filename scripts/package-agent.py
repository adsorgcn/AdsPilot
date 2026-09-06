#!/usr/bin/env python3
"""Build a dated, versioned instruction-only ZIP; developer tool only."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys
import zipfile


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    subprocess.run(["node", str(root / "scripts" / "verify-agent-package.mjs")], check=True)
    skill = root / "skills" / "adspilot"
    manifest = json.loads((skill / "manifest.json").read_text(encoding="utf-8"))
    day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    output = root / "dist" / f"adspilot-agent-v{manifest['version']}-{day}.zip"
    output.parent.mkdir(exist_ok=True)
    # Exclusive creation prevents silently replacing an existing delivery.
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in manifest["files"]:
            archive.write(skill / name, f"adspilot/{name}")
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
        if sorted(archive.namelist()) != sorted(f"adspilot/{f}" for f in manifest["files"]):
            raise ValueError("ZIP inventory differs from manifest")
    print(json.dumps({"path": str(output), "files": len(manifest["files"]),
                      "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
        sys.exit(1)
