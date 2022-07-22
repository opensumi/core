import path from 'path';

import fse from 'fs-extra';
import temp from 'temp';

import { Disposable, URI } from '@opensumi/ide-utils';

export class OpenSumiWorkspace extends Disposable {
  private workspacePath: string;

  constructor(private filesToWorkspace: string[]) {
    super();
    const track = temp.track();
    this.disposables.push({
      dispose: () => {
        track.cleanupSync();
      },
    });
    this.workspacePath = path.join(temp.mkdirSync('workspace'));
  }

  get workspace() {
    return new URI(this.workspacePath);
  }

  async initWorksapce() {
    if (!fse.existsSync(this.workspacePath)) {
      await fse.ensureDir(this.workspacePath);
    }
    for (const file of this.filesToWorkspace) {
      if (fse.existsSync(file)) {
        await fse.copy(file, path.join(this.workspacePath, path.basename(file)));
      }
    }
  }
}
