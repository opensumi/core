import { Injectable, Autowired } from '@opensumi/di';
import { OnEvent, FileChangeType, IPosition } from '@opensumi/ide-core-common';

import { WithEventBus } from '..';
import { RecentStorage } from '../common/common.storage';
import { FilesChangeEvent } from '../fs';

const OPENED_FILE = 'OPENED_FILE';

const FILES_POSITION = 'OPENED_FILES_POSITION';

@Injectable()
export class RecentFilesManager extends WithEventBus {
  @Autowired(RecentStorage)
  private recentStorage: RecentStorage;

  async updateMostRecentlyOpenedFile(url: string, position: IPosition) {
    const recentStorage = await this.recentStorage.getScopeStorage();
    const openedFilesPosition = recentStorage.get<{ [prop: string]: string }>(FILES_POSITION) || {};
    openedFilesPosition[url] = `#${position.lineNumber},${position.column}`;
    recentStorage.set(FILES_POSITION, openedFilesPosition);
  }

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
    recentStorage.set(OPENED_FILE, fileList);
  }

  async getMostRecentlyOpenedFiles(includingRange?: boolean) {
    const recentStorage = await this.recentStorage.getScopeStorage();
    const fileList: string[] = recentStorage.get<string[]>(OPENED_FILE) || [];
    const openedFilesPosition = recentStorage.get<{ [prop: string]: string }>(FILES_POSITION) || {};
    if (includingRange) {
      return fileList.map((url) => {
        if (openedFilesPosition[url]) {
          return url + openedFilesPosition[url];
        }
        return url;
      });
    }
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
