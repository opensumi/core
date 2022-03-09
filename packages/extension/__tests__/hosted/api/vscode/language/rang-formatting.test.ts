import { join } from 'path';

import { createPatch, applyPatch } from 'diff';
import { readFile } from 'fs-extra';

describe('range-formatting', () => {
  it('applyPatch', async () => {
    const PATCH_PREFIX =
      'Index: a\n===================================================================\n--- a\n+++ a\n';
    const oldText = await readFile(join(__dirname, '..', '__mock__', 'index.tsx.old.mock'), 'utf-8');
    const newText = await readFile(join(__dirname, '..', '__mock__', 'index.tsx.new.mock'), 'utf-8');
    const diff = createPatch('a', oldText, newText, undefined, undefined, { context: 0 }).slice(89);
    expect(applyPatch(oldText, PATCH_PREFIX + diff)).toBe(newText);
  });
});
