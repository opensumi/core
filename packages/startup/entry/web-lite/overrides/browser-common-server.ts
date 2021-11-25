import { Injectable } from '@opensumi/di';
import { ICommonServer, OS, isWindows, isLinux } from '@opensumi/ide-core-common';
import {  } from '@opensumi/ide-core-common';

@Injectable()
export class BrowserCommonServer implements ICommonServer {
  async getBackendOS(): Promise<OS.Type> {
    // 这里按照 ua 去判断 backend os 没问题
    // 因为纯前端版本，目前写入时在用户浏览器中，因此按照用户浏览器 ua 对应的操作系统是 ok 的
    return isWindows ? OS.Type.Windows : (isLinux ? OS.Type.Linux : OS.Type.Windows);
  }
}
