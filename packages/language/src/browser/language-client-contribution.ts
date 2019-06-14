import { Injectable, Autowired } from '@ali/common-di';
import { LanguageClientFactory } from './language-client-factory';
import { CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { LanguageClientOptions } from 'monaco-languageclient';
import { listen } from 'vscode-ws-jsonrpc';
import { ILanguageClient, Languages, Workspace } from './language-client-services';
import { getLogger } from '@ali/ide-core-common';
import { MonacoLanguages } from './services/monaco-languages';
import { MonacoWorkspace } from './services/monaco-workspace';
import { AppConfig } from '@ali/ide-core-browser';

const logger = getLogger();

export interface LanguageContribution {
  id: string;
  name: string;

  waitForActivate(): void;
}

export const LanguageContribution = Symbol('LanguageContribution');

// TODO 迁移到connection模块
@Injectable()
export class ConnectionFactory {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  get(id: string) {
    const socket = new WebSocket(`${this.appConfig.wsPath}/language/${id}`);
    socket.onerror = console.error;
    socket.onclose = ({ code, reason }) => {
      logger.log(code, reason);
    };
    socket.onmessage = ({ data }) => {
      logger.log(data);
    };
    return socket;
  }
}

@Injectable()
export abstract class LanguageClientContribution implements LanguageContribution, CommandContribution {
  abstract readonly id: string;
  abstract readonly name: string;

  // TODO 连接生命周期管理
  private hasActivated = false;

  clientOptions: LanguageClientOptions = {};

  private languageClient: ILanguageClient;

  // NOTE 连接需要使用connection模块提供的
  private connection: any;

  @Autowired(MonacoLanguages)
  languages: Languages;

  @Autowired(MonacoWorkspace)
  workspace: Workspace;

  @Autowired()
  private connectionFactory: ConnectionFactory;

  @Autowired()
  private languageClientFactory: LanguageClientFactory;

  waitForActivate() {
    this.workspace.onDidOpenTextDocument((doc) => {
      const documentSelector = [this.id];
      if (this.languages.match(documentSelector, doc)) {
        this.activate();
      }
    });
  }

  // TODO 外界调用管理
  registerCommands(commands: CommandRegistry) {
    commands.registerCommand({
      id: `language.client.${this.id}.activate`,
    }, {
      execute: () => {
        logger.log('language activate: ' + this.id);
        this.activate();
      },
    });
  }

  activate() {
    if (this.hasActivated) { return; }
    logger.log(this.name + '激活');
    this.connection = this.connectionFactory.get(this.id);
    this.doActivate();
  }

  // TODO dispose逻辑
  doActivate() {
    listen({
      webSocket: this.connection,
      onConnection: (messageConnection: any) => {
        this.hasActivated = true;
        this.languageClient = this.languageClientFactory.get(this, this.clientOptions, messageConnection);
        const disposable = this.languageClient.start();
        messageConnection.onClose(() => disposable.dispose());
      },
    });
  }

}
