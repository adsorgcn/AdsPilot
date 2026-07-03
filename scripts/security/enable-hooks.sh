#!/usr/bin/env bash
# Point git at the versioned hooks dir. Idempotent. Run after cloning.
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "✅ git hooks enabled (core.hooksPath=.githooks). Secret scan now runs on every commit."
