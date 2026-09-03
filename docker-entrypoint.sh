#!/bin/sh
# Runs as root so it can fix ownership on whatever's actually bind-mounted at
# /config (a host directory's uid/gid has nothing to do with the image's
# baked-in chown — that only covers a fresh named volume, not a bind mount),
# then drops to the unprivileged `node` user for the real process.
set -e

mkdir -p /config
chown -R node:node /config

exec su-exec node "$@"
