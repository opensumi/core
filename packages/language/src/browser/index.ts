import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { MonacoLanguageClient, createConnection, MonacoServices } from 'monaco-languageclient';
import { listen } from 'vscode-ws-jsonrpc';

@Injectable()
export class LanguageModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map();
}

export class LanguageClient {

  connection: WebSocket;

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    console.log('editor get');
    MonacoServices.install(editor);
    this.initConnection();
    this.listenConnection();
  }

  initConnection() {
    this.connection = new WebSocket(`${'ws:127.0.0.1:8000'}/language/${1}`);

    this.connection.addEventListener('open', (e) => {
      console.log('open', e);
    });

    this.connection.addEventListener('message', (e) => {
      console.log('message', e);
    });
  }

  listenConnection() {
    listen({
      webSocket: this.connection,
      onConnection: (connection: any) => {
        const client = new MonacoLanguageClient({
          name: 'typescript',
          clientOptions: {
            documentSelector: ['json', 'javascript', 'javascriptreact', 'typescriptreact', 'typescript'],
          },
          connectionProvider: {
            get: (errorHandler, closeHandler) => {
              return Promise.resolve(createConnection(connection, errorHandler, closeHandler));
            },
          },
        });
        const disposable = client.start();
        connection.onClose(() => disposable.dispose());
      },
    });
  }
}
