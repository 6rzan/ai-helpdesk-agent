#!/bin/sh
# account-status <username>
# Reports whether a local test account is locked and whether its password is
# flagged for a forced change at next sign-in (research.md R11).
set -eu
USERNAME="$1"

STATUS_LINE="$(passwd -S "$USERNAME")"
STATUS_FIELD="$(echo "$STATUS_LINE" | awk '{print $2}')"
if [ "$STATUS_FIELD" = "L" ]; then
    LOCKED=true
else
    LOCKED=false
fi

LAST_CHANGE_DAY="$(chage -l "$USERNAME" | awk -F': ' '/Last password change/ {print $2}')"
if [ "$LAST_CHANGE_DAY" = "password must be changed" ]; then
    CHANGE_REQUIRED=true
else
    CHANGE_REQUIRED=false
fi

echo "account=$USERNAME"
echo "locked=$LOCKED"
echo "password_change_required=$CHANGE_REQUIRED"
