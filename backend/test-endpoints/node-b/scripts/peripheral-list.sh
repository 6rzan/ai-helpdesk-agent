#!/bin/sh
# peripheral-list — devices visible to the endpoint (read-only, research.md R11).
# Honesty note: this is the container's own device view, not the employee's
# physical desk. The agent must describe it that way, never as a check of the
# employee's own hardware.
set -eu
echo "devices_visible_to_endpoint:"
ls -1 /dev/input 2>/dev/null | sed 's/^/  input\//' || true
ls -1 /dev | grep -E '^(tty|usb)' 2>/dev/null | sed 's/^/  /' || true
echo "end_of_list"
