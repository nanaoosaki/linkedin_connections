#!/usr/bin/env bash
# Run the full quality gate locally.
# Usage: bash scripts/check.sh
# All four steps must pass; any failure aborts.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> lint"
npm run lint

echo "==> typecheck"
npm run typecheck

echo "==> test"
npm test

echo "==> build"
npm run build

echo ""
echo "All checks passed."
