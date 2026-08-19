#!/bin/sh
# unlock-account <username> — unlocks a locked local test account (state-changing,
# research.md R11). Verified afterward by account-status.
set -eu
usermod -U "$1"
echo "unlocked=$1"
