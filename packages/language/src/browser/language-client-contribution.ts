import { Injectable, Autowired } from '@ali/common-di';
import { LanguageClientFactory } from './language-client-factory';
import { LanguageContribution } from '../common';
import { CommandContribution, CommandRegistry } from '@ali/ide-core-common'; // TODO 很容易引到node的那个
import { LanguageClientOptions } from 'monaco-languageclient';
import { listen } from 'vscode-ws-jsonrpc';
import { ILanguageClient } from './language-client-services';

// TODO 迁移到connection模块
@Injectable()
export class ConnectionFactory {
  baseUrl = 'ws:127.0.0.1:8000';

  get(id: string) {
    const socket = new WebSocket(`${this.baseUrl}/language/${id}`);
    socket.onerror = console.error;
    socket.onclose = ({ code, reason }) => {
      console.log(code, reason);
    };
    socket.onmessage = ({ data }) => {
      console.log(data);
    };
    return socket;
  }
}

@Injectable()
export abstract class LanguageClientContribution implements LanguageContribution, CommandContribution {
  abstract readonly id: string;
  abstract readonly name: string;

  clientOptions: LanguageClientOptions = {};

  private languageClient: ILanguageClient;

  // NOTE 连接需要使用connection模块提供的
  private connection: any;

  @Autowired()
  private connectionFactory: ConnectionFactory;

  @Autowired()
  private languageClientFactory: LanguageClientFactory;

  // TODO 等应用生命周期
  waitForActivate() {

  }

  // TODO 迁移到 waitForActivate 中
  registerCommands(commands: CommandRegistry) {
    console.log('????');
    commands.registerCommand({
      id: `language.client.${this.id}.activate`,
    }, {
      execute: () => {
        console.log('language activate: ' + this.id);
        this.activate();
      },
    });
  }

  activate() {
    this.connection = this.connectionFactory.get(this.id);
    this.doActivate();
  }

  // TODO dispose逻辑
  doActivate() {
    listen({
      webSocket: this.connection,
      onConnection: (messageConnection: any) => {
        this.languageClient = this.languageClientFactory.get(this, this.clientOptions, messageConnection);
        const disposable = this.languageClient.start();
        messageConnection.onClose(() => disposable.dispose());
      },
    });
  }

}
