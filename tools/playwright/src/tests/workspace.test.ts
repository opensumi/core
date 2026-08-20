import os from 'os';
import path from 'path';

import { expect, test } from '@playwright/test';
import fse from 'fs-extra';

import { OpenSumiWorkspace, PLAYWRIGHT_TMP_DIR } from '../workspace';

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

test.describe('OpenSumiWorkspace temporary directories', () => {
  test('stores workspace and preferences under the Playwright tmp directory', () => {
    const workspace = new OpenSumiWorkspace([]);
    const workspacePath = workspace.workspace.codeUri.fsPath;
    const preferencePath = path.resolve(os.homedir(), workspace.userPreferenceDirName);

    try {
      expect(isPathInside(PLAYWRIGHT_TMP_DIR, workspacePath)).toBe(true);
      expect(isPathInside(PLAYWRIGHT_TMP_DIR, preferencePath)).toBe(true);
    } finally {
      workspace.dispose();
      fse.removeSync(preferencePath);
    }
  });

  test('removes its workspace and preference directories when disposed', () => {
    const workspace = new OpenSumiWorkspace([]);
    const workspacePath = workspace.workspace.codeUri.fsPath;
    const preferencePath = path.resolve(os.homedir(), workspace.userPreferenceDirName);

    fse.ensureDirSync(preferencePath);
    fse.writeFileSync(path.join(preferencePath, 'settings.json'), '{}');
    workspace.dispose();

    try {
      expect(fse.existsSync(workspacePath)).toBe(false);
      expect(fse.existsSync(preferencePath)).toBe(false);
    } finally {
      fse.removeSync(workspacePath);
      fse.removeSync(preferencePath);
    }
  });
});
