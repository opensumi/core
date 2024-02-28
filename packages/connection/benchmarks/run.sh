#! /bin/sh

SCRIPT_PATH=$(realpath "$0")  
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")  

tsx $SCRIPT_DIR/rpc.bench.ts > $SCRIPT_DIR/../docs/benchmark.txt
