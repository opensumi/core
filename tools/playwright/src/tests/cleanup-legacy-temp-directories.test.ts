import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '@playwright/test';

const {
  cleanupLegacyPlaywrightTempDirectories,
  findLegacyPlaywrightTempDirectories,
}: {
  cleanupLegacyPlaywrightTempDirectories(options: { root: string; remove?: boolean }): string[];
  findLegacyPlaywrightTempDirectories(root: string): string[];
} = require('../../scripts/cleanup-legacy-temp-directories');

test.describe('legacy Playwright temporary directory cleanup', () => {
  test('only finds directories created by the old workspace naming scheme', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opensumi-playwright-cleanup-'));
    const matches = [
      'playwright-workspace2026618-13933-1j5dlct.v2cu',
      'playwright-workspace202676-1615-1oqf4fd.k80j',
    ];

    try {
      for (const name of [...matches, 'playwright-workspace-manual', 'playwright-output']) {
        fs.mkdirSync(path.join(root, name));
      }

      expect(findLegacyPlaywrightTempDirectories(root)).toEqual(matches.map((name) => path.join(root, name)));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('previews by default and removes matched directories only when requested', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opensumi-playwright-cleanup-'));
    const legacyDirectory = path.join(root, 'playwright-workspace202676-1615-1oqf4fd.k80j');
    const preservedDirectory = path.join(root, 'playwright-workspace-manual');

    try {
      fs.mkdirSync(legacyDirectory);
      fs.mkdirSync(preservedDirectory);

      cleanupLegacyPlaywrightTempDirectories({ root });
      expect(fs.existsSync(legacyDirectory)).toBe(true);

      cleanupLegacyPlaywrightTempDirectories({ root, remove: true });
      expect(fs.existsSync(legacyDirectory)).toBe(false);
      expect(fs.existsSync(preservedDirectory)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
