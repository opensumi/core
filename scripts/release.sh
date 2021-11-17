#!/bin/sh
# 这个脚本列出了发版本的步骤
rm -rf node_modules
rm -rf packages/**/node_modules

npm install
npm run init
npm run publish
