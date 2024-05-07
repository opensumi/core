#! /bin/sh

SCRIPT_PATH=$(realpath "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

echo "RPC Benchmark" > $SCRIPT_DIR/../docs/benchmark.txt
tsx $SCRIPT_DIR/rpc.bench.ts >> $SCRIPT_DIR/../docs/benchmark.txt

echo "Gateway Benchmark" > $SCRIPT_DIR/../docs/benchmark-gateway.txt
tsx $SCRIPT_DIR/gateway.bench.ts >> $SCRIPT_DIR/../docs/benchmark-gateway.txt
