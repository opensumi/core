#! /bin/sh

SCRIPT_PATH=$(realpath "$0")  
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")  

esbuild $SCRIPT_DIR/rpc-browser.bench.ts --bundle --platform=browser --outfile=$SCRIPT_DIR/browser/rpc-browser.bench.js

live-server $SCRIPT_DIR/browser
