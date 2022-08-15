import * as Y from 'yjs';

import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';
import { FileChangeType, IFileService } from '@opensumi/ide-file-service';
import { FileService } from '@opensumi/ide-file-service/lib/node';

import { ICollaborationServiceForClient, IYWebsocketServer, ROOM_NAME } from '../common';

@Injectable()
export class CollaborationServiceForClient implements ICollaborationServiceForClient {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(IYWebsocketServer)
  private server: IYWebsocketServer;

  @Autowired(IFileService)
  private fileService: FileService;

  private yDoc: Y.Doc;

  private yMap: Y.Map<Y.Text>;

  constructor() {
    // init
    this.yDoc = this.server.getYDoc(ROOM_NAME);
    this.yMap = this.yDoc.getMap();

    this.yMap.observe((e) => {
      e.changes.keys.forEach((change, key) => {
        this.logger.debug(`[Collaboration] operation ${change.action} occurs on key ${key}`);
      });
    });

    this.fileService.onFilesChanged((e) => {
      e.changes
        .filter((e) => e.type === FileChangeType.DELETED)
        .forEach((e) => {
          if (e.type === FileChangeType.DELETED) {
            this.logger.debug('on file event deleted', e);
            this.removeYText(e.uri);
            this.logger.debug('removed Y.Text of', e.uri);
          }
        });

      e.changes
        .filter((e) => e.type === FileChangeType.ADDED)
        .forEach((e) => {
          this.logger.debug('on file event added', e);
          this.requestInitContent(e.uri);
        });
    });
  }

  removeYText(uri: string) {
    this.logger.debug('trying to remove uri', uri);
    if (this.yMap.has(uri)) {
      this.yMap.delete(uri);
      this.logger.debug('removed', uri);
    }
  }

  async requestInitContent(uri: string): Promise<void> {
    try {
      // load content from disk, not client
      const { content } = await this.fileService.resolveContent(uri);
      this.logger.debug('resolved content', content.substring(0, 20), 'from', uri);
      if (!this.yMap.has(uri)) {
        const yText = new Y.Text(content); // create yText with initial content
        this.yMap.set(uri, yText);
      }
    } catch (e) {
      this.logger.error(e);
    }
  }
}
