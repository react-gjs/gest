#!/bin/bash
DIR=$(dirname "$(dirname $(realpath "${BASH_SOURCE[0]}"))")
SCRIPT="$DIR/dist/esm/base/index.mjs"
gjs -m $SCRIPT $@
