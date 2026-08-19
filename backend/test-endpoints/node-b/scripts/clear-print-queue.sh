#!/bin/sh
# clear-print-queue — clears the endpoint's print queue (state-changing,
# research.md R11). Verified afterward by print-queue-status.
set -eu
cancel -a test-printer 2>/dev/null || true
echo "cleared=test-printer"
