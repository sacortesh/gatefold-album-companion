#!/bin/sh
# Runs as root (the default) so it can fix ownership on whatever's actually
# bind-mounted at /config (a host directory's uid/gid has nothing to do with
# the image's baked-in chown — that only covers a fresh named volume, not a
# bind mount), then drops to the unprivileged `node` user for the real
# process. When the container is already started unprivileged (`--user`,
# Kubernetes `runAsUser`/`runAsNonRoot`, Podman's default uid remap), chown
# and su-exec's setgroups() both require privileges it doesn't have and the
# container would never start — skip the privilege dance entirely in that
# case, since the caller has already picked a user for us.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /config
  # Only chown what doesn't already have the right owner — a full `chown -R`
  # on every start is O(files) of startup latency on a large bind-mounted
  # /config, and most starts after the first have nothing to fix.
  find /config \! -user node -exec chown node:node {} +
  exec su-exec node "$@"
fi

exec "$@"
