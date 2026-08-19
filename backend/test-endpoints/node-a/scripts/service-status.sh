#!/bin/sh
# service-status <service> — state of a named approved service (read-only,
# research.md R11). <service> is drawn from the enumeration in the policy entry.
set -eu
SERVICE="$1"
/etc/init.d/"$SERVICE" status
