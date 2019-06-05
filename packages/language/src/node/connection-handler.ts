import {WebSocketHandler} from '@ali/ide-connection';
import * as ws from 'ws';
import * as rpc from 'vscode-ws-jsonrpc';
import * as pathMatch from 'path-match';
import { LanguageServerProvider } from './language-server-provider';
import { LanguageServerContribution } from './language-server-contribution';
import { getLogger } from '@ali/ide-core-common';

const logger = getLogger();
const route = pathMatch();

export class LanguageHandler extends WebSocketHandler {
  public handlerId = 'language';

  private dataRoute = route(`/language/:language_id`);

  // TODO channel需要简单封装，包含connection和contribution？
  private channels: Map<string, ws.Server> = new Map();
  private channelContributions: Map<string, LanguageServerContribution> = new Map();

  private languageProvider: LanguageServerProvider;

  constructor() {
    super();
    this.languageProvider = new LanguageServerProvider();
  }

  init() {
    logger.log('init Language Server Connection');
    this.setChannelListener();
  }

  private createConnection(contribution: LanguageServerContribution) {
    const wss = new ws.Server({
      noServer: true,
      perMessageDeflate: false,
    });

    // TODO 这里没有生效，需要看下底层逻辑
    // wss.on('connection', async (connection: any) => {
    //   await contribution.start(connection);

    //   connection.send('language server process started:', contribution.id);

    //   connection.on('close', () => {
    //     logger.log('exit');
    //   });
    //   connection.on('error', (e) => {
    //     logger.log('connection error');
    //     logger.log(e);
    //   });
    // });
    return wss;
  }

  handleUpgrade(wsPathName: string, request, socket, head): boolean {
    const id = this.dataRoute(wsPathName).language_id;
    logger.log('get language id', id);
    const connection = this.channels.get(id);
    if (connection) {
      connection.handleUpgrade(request, socket, head, (webSocket) => {
        const lsSocket: rpc.IWebSocket = {
          send: (content) => {
              webSocket.send(content, (error) => {
                  if (error) {
                      console.error(error);
                  }
              });
          },
          onMessage: (cb) => webSocket.on('message', cb),
          onClose: (cb) => webSocket.on('close', cb),
          onError: (cb) => webSocket.on('error', cb),
          dispose: () => webSocket.close(),
        };
        const targetContribution = this.channelContributions.get(id);
        // TODO start server here
        if (webSocket.readyState === webSocket.OPEN && targetContribution) {
          targetContribution.start(lsSocket);
        }
      });
      return true;
    }
    return false;
  }

  setChannelListener() {
    for (const contribution of this.languageProvider.contributions) {
      const languageConnection = this.createConnection(contribution);
      this.channels.set(contribution.id, languageConnection);
      this.channelContributions.set(contribution.id, contribution);
    }
  }
}
