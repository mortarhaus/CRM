#!/bin/sh
set -eu

case "${1:-web}" in
  web)
    node dist/migrate.mjs
    exec node server.js
    ;;
  worker)
    node dist/migrate.mjs
    exec node dist/worker.mjs
    ;;
  migrate)
    exec node dist/migrate.mjs
    ;;
  *)
    exec "$@"
    ;;
esac
