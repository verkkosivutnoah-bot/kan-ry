#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Email Operations Copilot — Anthropic Managed Agent setup
# ──────────────────────────────────────────────────────────────
# Prerequisites:
#   brew install anthropics/tap/ant
#   export ANTHROPIC_API_KEY="sk-ant-..."
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── 0. Verify prerequisites ───────────────────────────────────
if ! command -v ant &>/dev/null; then
  echo "Error: 'ant' CLI not found."
  echo "Install it with:  brew install anthropics/tap/ant"
  exit 1
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "Error: ANTHROPIC_API_KEY is not set."
  echo "Run:  export ANTHROPIC_API_KEY=\"your-key\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 1. Create the agent ───────────────────────────────────────
echo "Creating agent..."

AGENT_ID=$(ant beta:agents create \
  --name 'Email Operations Copilot' \
  --model '{id: claude-sonnet-4-6}' \
  --system "@${SCRIPT_DIR}/system-prompt.txt" \
  --tool '{type: agent_toolset_20260401}' \
  --tool '{type: mcp_toolset, name: agentmail}' \
  --mcp-server '{type: url, name: agentmail, url: https://mcp.agentmail.to}' \
  --transform id \
  --format yaml)

echo "Agent created: ${AGENT_ID}"

# ── 2. Create a cloud environment ────────────────────────────
echo "Creating environment..."

ENV_ID=$(ant beta:environments create \
  --name 'email-agent-env' \
  --config '{type: cloud, networking: {type: unrestricted}}' \
  --transform id \
  --format yaml)

echo "Environment created: ${ENV_ID}"

# ── 3. Persist IDs for later use ─────────────────────────────
cat > "${SCRIPT_DIR}/.agent-ids" <<EOF
AGENT_ID=${AGENT_ID}
ENV_ID=${ENV_ID}
EOF

echo ""
echo "Setup complete. IDs saved to .agent-ids"
echo ""
echo "Start a session with:"
echo "  ant beta:sessions create \\"
echo "    --agent ${AGENT_ID} \\"
echo "    --environment-id ${ENV_ID} \\"
echo "    --title 'Email outreach session'"
