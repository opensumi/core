#! /bin/sh

SCRIPT_PATH=$(realpath "$0")  
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")  

echo "RPC BENCHMARK" > $SCRIPT_DIR/../docs/benchmark.txt
tsx $SCRIPT_DIR/rpc.bench.ts >> $SCRIPT_DIR/../docs/benchmark.txt

echo "ONE OF BENCHMARK" >> $SCRIPT_DIR/../docs/benchmark.txt
tsx $SCRIPT_DIR/one-of.bench.ts >> $SCRIPT_DIR/../docs/benchmark.txt
