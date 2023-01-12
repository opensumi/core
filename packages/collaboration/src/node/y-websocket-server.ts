import http from 'http';

import ws from 'ws';
import utils from 'y-websocket/bin/utils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Doc as YDoc, Map as YMap, Text as YText } from 'yjs';

import { Injectable, Autowired } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';
import { FileChangeType, IFileService } from '@opensumi/ide-file-service';
import { FileService } from '@opensumi/ide-file-service/lib/node';

import { COLLABORATION_PORT, IYWebsocketServer, ROOM_NAME } from '../common';

@Injectable()
export class YWebsocketServerImpl implements IYWebsocketServer {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(IFileService)
  private fileService: FileService;

  private yDoc: YDoc;

  private yMap: YMap<YText>;

  private websocketServer: ws.Server;

  private server: http.Server;

  private rejectsOfRequestingPromises: Map<string, Set<(reason: string) => void>> = new Map();

  initialize() {
    this.logger.debug('init y-websocket server');

    this.server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('hello');
    });

    const { setupWSConnection } = utils; // todo add typing?

    this.websocketServer = new ws.Server({ noServer: true });

    this.websocketServer.on('connection', setupWSConnection);

    this.server.on('upgrade', (req, socket, head) => {
      const handleAuth = (ws) => {
        this.websocketServer.emit('connection', ws, req);
      };
      this.websocketServer.handleUpgrade(req, socket, head, handleAuth);
    });

    this.server.listen(COLLABORATION_PORT, () => {
      this.logger.log(`y-websocket server listening on port ${COLLABORATION_PORT}`);
    });

    // init
    this.yDoc = this.getYDoc(ROOM_NAME);
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
            this.logger.debug('removed YText of', e.uri);
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

    // break all still-awaiting promise
    const rejects = this.rejectsOfRequestingPromises.get(uri);
    if (rejects) {
      rejects.forEach((reject) => reject('Remove unresolved promise of this uri'));
      rejects.clear();
    }

    if (this.yMap.has(uri)) {
      this.yMap.delete(uri);
      this.logger.debug('removed', uri);
    }
  }

  private async doRequestInitContent(uri: string): Promise<void> {
    try {
      // load content from disk, not client
      const { content } = await this.fileService.resolveContent(uri);
      this.logger.debug('resolved content', content.substring(0, 20), 'from', uri);
      if (!this.yMap.has(uri)) {
        const yText = new YText(content); // create yText with initial content
        this.yMap.set(uri, yText);
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  async requestInitContent(uri: string): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.doRequestInitContent(uri).then(() => resolve());

      if (!this.rejectsOfRequestingPromises.has(uri)) {
        this.rejectsOfRequestingPromises.set(uri, new Set());
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.rejectsOfRequestingPromises.get(uri)!.add(reject);
    });
    await promise;
  }

  destroy() {
    this.websocketServer.close();
    this.server.close();
  }

  getYDoc(room: string): YDoc {
    const { getYDoc } = utils;
    return getYDoc(room);
  }
}
