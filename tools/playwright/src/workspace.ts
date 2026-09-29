import os from 'os';
import path from 'path';

import fse from 'fs-extra';

import { Disposable, URI } from '@opensumi/ide-utils';

export const PLAYWRIGHT_TMP_DIR = path.resolve(__dirname, '../tmp');

export class OpenSumiWorkspace extends Disposable {
  private workspacePath: string;
  private preferencePath: string;
  private preferenceDirName: string;

  constructor(private filesToWorkspace: string[]) {
    super();
    fse.ensureDirSync(PLAYWRIGHT_TMP_DIR);
    this.workspacePath = fse.realpathSync(fse.mkdtempSync(path.join(PLAYWRIGHT_TMP_DIR, 'workspace-')));
    this.preferencePath = path.join(PLAYWRIGHT_TMP_DIR, `playwright-${path.basename(this.workspacePath)}`);
    fse.ensureDirSync(this.preferencePath);
    this.preferenceDirName = path.relative(os.homedir(), this.preferencePath).split(path.sep).join('/');

    this.disposables.push({
      dispose: () => {
        fse.removeSync(this.workspacePath);
        fse.removeSync(this.preferencePath);
      },
    });
  }

  get workspace() {
    return new URI(this.workspacePath);
  }

  get userPreferenceDirName() {
    return this.preferenceDirName;
  }

  async initWorksapce() {
    if (!fse.existsSync(this.workspacePath)) {
      await fse.ensureDir(this.workspacePath);
    }
    for (const file of this.filesToWorkspace) {
      if (fse.existsSync(file)) {
        await fse.copy(file, this.workspacePath);
      }
    }
  }
}
