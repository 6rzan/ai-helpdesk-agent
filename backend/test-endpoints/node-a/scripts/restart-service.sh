#!/bin/sh
# restart-service <service> — restarts a named approved service (state-changing,
# research.md R11). Verified afterward by service-status.
set -eu
SERVICE="$1"
/etc/init.d/"$SERVICE" restart
