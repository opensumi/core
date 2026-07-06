import path from 'path';

import fse from 'fs-extra';
import temp from 'temp';

import { Disposable, URI } from '@opensumi/ide-utils';

export class OpenSumiWorkspace extends Disposable {
  private workspacePath: string;
  private preferenceDirName: string;

  constructor(private filesToWorkspace: string[]) {
    super();
    const track = temp.track();
    this.disposables.push({
      dispose: () => {
        track.cleanupSync();
      },
    });
    this.workspacePath = fse.realpathSync(path.join(temp.mkdirSync('workspace')));
    this.preferenceDirName = `playwright-${path.basename(this.workspacePath)}`;
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
