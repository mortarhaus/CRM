#!/bin/sh
set -eu

case "${1:-web}" in
  web)
    node dist/migrate.mjs web
    exec node server.js
    ;;
  worker)
    node dist/migrate.mjs worker
    exec node dist/worker.mjs
    ;;
  migrate)
    exec node dist/migrate.mjs
    ;;
  bootstrap)
    exec node dist/bootstrap.mjs
    ;;
  *)
    exec "$@"
    ;;
esac
