#!/bin/sh
# print-queue-status — jobs currently queued on the endpoint's print service
# (read-only, research.md R11).
set -eu
echo "printer=test-printer"
lpstat -o test-printer 2>/dev/null || echo "queue_empty=true"
