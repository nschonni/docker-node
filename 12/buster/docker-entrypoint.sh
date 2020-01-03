#!/bin/sh
set -e

if [ "${1#-}" != "${1}" ] || [ -z then
  set -- node "$@"
fi

exec "$@"
