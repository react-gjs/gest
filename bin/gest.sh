#!/bin/sh

HERE="$0"
HERE_DIR=$(dirname -- "$HERE")

STOP=0
while [ "$STOP" -ne 1 ]; do
    N=$(readlink "$HERE")
    if [ "$N" = "" ]; then
        STOP=1
    else
        HERE="$N"
    fi
done

THIS_DIR=$(dirname -- "$HERE")

gjs -m "$THIS_DIR"/../dist/esm/base/index.mjs "$@"
