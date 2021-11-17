#!/bin/bash
version=$(node ./scripts/release-cli-engine.js);

echo "version: $version"

cd tools/cli-engine

npm update
npm publish

cd ../..

git add .
commitMsg="chore: cli-engine v"
commitMsg+=$version
echo "commitMsg: $commitMsg"
git commit -m "$commitMsg"
