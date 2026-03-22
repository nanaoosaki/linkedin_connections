#!/usr/bin/env bash
# Install git pre-commit hook that runs the full quality gate.
# Usage: bash scripts/install-hooks.sh

set -euo pipefail

HOOKS_DIR="$(git -C "$(dirname "$0")/.." rev-parse --git-path hooks)"
HOOK_FILE="$HOOKS_DIR/pre-commit"

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
# Pre-commit: block commit if lint, typecheck, test, or build fails.
set -euo pipefail
echo "[pre-commit] Running quality gate..."
bash "$(git rev-parse --show-toplevel)/scripts/check.sh"
EOF

chmod +x "$HOOK_FILE"
echo "Pre-commit hook installed at: $HOOK_FILE"
