#!/bin/sh
# expire-password <username> — forces a password change at next sign-in for a
# local test account (state-changing, research.md R11). Verified afterward by
# account-status.
set -eu
chage -d 0 "$1"
echo "expired=$1"
