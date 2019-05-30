import {WebSocketHandler} from '@ali/ide-connection';
import {handleMonacoUpgrade} from './language';
import * as ws from 'ws';
import * as pathMatch from 'path-match';
const route = pathMatch();

export class LanguageModule {

}

export class LanguageHandler extends WebSocketHandler {
  public handlerId = 'language';

  private languageWS;
  private dataRoute = route(`/language/:language_id`);

  constructor() {
    super();
  }

  init() {
    console.log('init Language Server');
    this.initServer();
  }

  private initServer() {
    this.initLanguageWS();
    this.pingClients();
  }

  private pingClients() {
    function noop() {}
    setInterval(() => {
      this.languageWS.clients.forEach(function each(ws) {
        ws.ping(noop);
      });
    }, 5000);
  }

  private initLanguageWS() {
    this.languageWS = new ws.Server({
      noServer: true,
      perMessageDeflate: false,
    });

    this.languageWS.on('connection', (connection) => {
      const {language_id} = connection.routeParam;

      connection.send('init from backend', language_id);

      connection.on('pong', () => {
        console.log('dataWS pong');
      });

      connection.on('close', () => {
        console.log('exit');
      });
      connection.on('error', (e) => {
        console.log('connection error');
        console.log(e);
      });
    });
  }

  handleUpgrade(wsPathName: string, request, socket, head): boolean {
    const languageId = this.dataRoute(wsPathName);

    if (languageId) {
      handleMonacoUpgrade(request, socket, head, this.languageWS);
      return true;
    }

    return false;
  }
}
