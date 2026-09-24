#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const LEGACY_PLAYWRIGHT_TEMP_DIRECTORY = /^playwright-workspace\d{6,8}-\d+-[a-z0-9]+(?:\.[a-z0-9]+)*$/;

function writeOutput(message) {
  process.stdout.write(`${message}\n`);
}

function findLegacyPlaywrightTempDirectories(root = os.homedir()) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && LEGACY_PLAYWRIGHT_TEMP_DIRECTORY.test(entry.name))
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function cleanupLegacyPlaywrightTempDirectories({ root = os.homedir(), remove = false, verbose = false } = {}) {
  const directories = findLegacyPlaywrightTempDirectories(root);

  if (verbose) {
    for (const directory of directories) {
      writeOutput(`${remove ? 'Removing' : 'Would remove'} ${directory}`);
    }
  }

  if (remove) {
    for (const directory of directories) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  writeOutput(
    `${remove ? 'Removed' : 'Found'} ${directories.length} legacy Playwright temporary director${
      directories.length === 1 ? 'y' : 'ies'
    } under ${root}${remove ? '.' : '. Re-run with --delete to remove them.'}`,
  );

  return directories;
}

function printHelp() {
  writeOutput(`Usage: yarn cleanup:legacy-temp [options]

Options:
  --delete   Remove matched directories. Without this flag the script only previews.
  --verbose  Print every matched directory.
  --help     Show this help message.`);
}

function main(args = process.argv.slice(2)) {
  const supportedArgs = new Set(['--delete', '--verbose', '--help']);
  const unknownArg = args.find((arg) => !supportedArgs.has(arg));
  if (unknownArg) {
    throw new Error(`Unknown argument: ${unknownArg}`);
  }
  if (args.includes('--help')) {
    printHelp();
    return;
  }

  cleanupLegacyPlaywrightTempDirectories({
    remove: args.includes('--delete'),
    verbose: args.includes('--verbose'),
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  LEGACY_PLAYWRIGHT_TEMP_DIRECTORY,
  cleanupLegacyPlaywrightTempDirectories,
  findLegacyPlaywrightTempDirectories,
  main,
};
