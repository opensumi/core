import { Injectable, Autowired } from '@ali/common-di';
import { RecentStorage } from '../common/common.storage';
import { WithEventBus } from '..';
import { OnEvent, FileChangeType } from '@ali/ide-core-common';
import { FilesChangeEvent } from '../fs';

@Injectable()
export class RecentFilesManager extends WithEventBus {
  @Autowired(RecentStorage)
  private recentStorage: RecentStorage;

  async setMostRecentlyOpenedFile(uriString: string, isDelete?: boolean) {
    const recentStorage = await this.recentStorage.getScopeStorage();

    let fileList = await this.getMostRecentlyOpenedFiles();
    const existIdx = fileList.findIndex((file) => file === uriString);
    if (existIdx > -1) {
      fileList.splice(existIdx, 1);
    }
    if (!isDelete) {
      fileList.unshift(uriString);
    }

    // 仅存储50个最近文件
    if (fileList.length > 50) {
      fileList = fileList.slice(0, 50);
    }
    recentStorage.set('OPENED_FILE', fileList);
  }

  async getMostRecentlyOpenedFiles() {
    const recentStorage = await this.recentStorage.getScopeStorage();
    const fileList: string[] = recentStorage.get<string[]>('OPENED_FILE') || [];
    return fileList;
  }

  @OnEvent(FilesChangeEvent)
  protected handleFilesDelete(event: FilesChangeEvent) {
    event.payload.forEach((change) => {
      if (change.type === FileChangeType.DELETED) {
        if (change.uri) {
          this.setMostRecentlyOpenedFile(change.uri, true);
        }
      }
    });
  }

}
