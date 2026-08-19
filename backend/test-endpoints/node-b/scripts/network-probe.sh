#!/bin/sh
# network-probe <target> — reachability and DNS resolution as seen from the
# endpoint (read-only, research.md R11). <target> is one of a fixed enum
# declared in the policy entry, never free text.
set -eu
TARGET="$1"

RESOLVED="$(getent hosts "$TARGET" 2>/dev/null | awk '{print $1}' | head -n1 || true)"
if [ -z "$RESOLVED" ]; then
    RESOLVED="unresolved"
fi

if ping -c 1 -W 2 "$TARGET" >/dev/null 2>&1; then
    REACHABLE=true
else
    REACHABLE=false
fi

echo "target=$TARGET"
echo "resolved=$RESOLVED"
echo "reachable=$REACHABLE"
