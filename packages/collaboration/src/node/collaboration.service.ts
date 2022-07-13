import * as Y from 'yjs';

import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { ICollaborationServiceForClient, IYWebsocketServer, ROOM_NAME } from '../common';

@Injectable()
export class CollaborationServiceForClient implements ICollaborationServiceForClient {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(IYWebsocketServer)
  private server: IYWebsocketServer;

  private yDoc: Y.Doc;

  private yMap: Y.Map<Y.Text>;

  // todo record ref count?
  private openedUriSet: Set<string> = new Set();

  constructor() {
    // init
    this.yDoc = this.server.getYDoc(ROOM_NAME);
    this.yMap = this.yDoc.getMap();

    this.yMap.observe((e) => {
      e.changes.keys.forEach((change, key) => {
        this.logger.debug(`[Collaboration] operation ${change.action} occurs on key ${key}`);
      });
    });
  }

  // todo make action on move, rename, and deletion of file

  // todo maybe we can directly pass uri to read from file service?
  setInitContent(uri: string, initContent: string): void {
    this.logger.debug('pong', uri, 'with', initContent.slice(0, 20));
    if (!this.yMap.has(uri)) {
      const yText = new Y.Text(initContent); // create yText with initial content
      this.yMap.set(uri, yText);
    }
  }
}
