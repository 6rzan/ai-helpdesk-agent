#!/bin/sh
# Dummy long-running process backing widget-service.init. Does nothing but
# stay alive, so status/restart have a real PID to observe.
exec /bin/sh -c 'while true; do sleep 3600; done'
