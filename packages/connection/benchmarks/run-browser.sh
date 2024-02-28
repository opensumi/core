#! /bin/sh

	  
# 获取脚本的绝对路径  
SCRIPT_PATH=$(realpath "$0")  
  
# 获取脚本所在的目录  
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")  

esbuild $SCRIPT_DIR/rpc-browser.bench.ts --bundle --platform=browser --outfile=$SCRIPT_DIR/browser/rpc-browser.bench.js
