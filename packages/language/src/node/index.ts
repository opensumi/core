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
  }

  private initLanguageWS() {
    this.languageWS = new ws.Server({
      noServer: true,
      perMessageDeflate: false,
    });

    this.languageWS.on('connection', (connection) => {
      const {language_id} = connection.routeParam;

      connection.send('init from backend', language_id);

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
    const id = this.dataRoute(wsPathName);

    if (id) {
      handleMonacoUpgrade(request, socket, head, this.languageWS);
      return true;
    }

    return false;
  }
}
