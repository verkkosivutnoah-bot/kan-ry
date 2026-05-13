#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Start a session and send the first message
# Run setup-agent.sh first to populate .agent-ids
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDS_FILE="${SCRIPT_DIR}/.agent-ids"

if [[ ! -f "${IDS_FILE}" ]]; then
  echo "Error: .agent-ids not found. Run setup-agent.sh first."
  exit 1
fi

# shellcheck source=/dev/null
source "${IDS_FILE}"

# ── Create session ────────────────────────────────────────────
echo "Starting session..."

SESSION_ID=$(ant beta:sessions create \
  --agent "${AGENT_ID}" \
  --environment-id "${ENV_ID}" \
  --title 'Email outreach session' \
  --transform id \
  --format yaml)

echo "Session started: ${SESSION_ID}"
echo ""

# ── Send an opening message ───────────────────────────────────
# Edit the text below to change your first instruction to the agent.
FIRST_MESSAGE="${1:-Check my inbox and summarize any new messages.}"

echo "Sending: ${FIRST_MESSAGE}"
echo ""

ant beta:sessions:events send \
  --session-id "${SESSION_ID}" \
  --event "{type: user.message, content: [{type: text, text: \"${FIRST_MESSAGE}\"}]}"
