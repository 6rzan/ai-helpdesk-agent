#!/bin/sh
# print-queue-status — jobs currently queued on the endpoint's print service
# (read-only, research.md R11).
#
# `lpstat -o <printer>` exits 0 whether or not jobs are queued -- it only
# prints a line per job. The old `... || echo queue_empty=true` fallback
# fired only when lpstat itself errored (e.g. an unconfigured destination),
# never on the ordinary success-with-no-jobs case, so a genuinely empty
# queue was never reported as such. Check the captured output instead.
set -eu
echo "printer=test-printer"
jobs=$(lpstat -o test-printer 2>/dev/null || true)
if [ -z "$jobs" ]; then
  echo "queue_empty=true"
else
  echo "$jobs"
fi
