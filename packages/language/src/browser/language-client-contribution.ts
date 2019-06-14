import { Injectable, Autowired } from '@ali/common-di';
import { LanguageClientFactory } from './language-client-factory';
import { CommandContribution, CommandRegistry, URI } from '@ali/ide-core-common'; // TODO 很容易引到node的那个
import { LanguageClientOptions } from 'monaco-languageclient';
import { listen } from 'vscode-ws-jsonrpc';
import { ILanguageClient } from './language-client-services';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { getLogger } from '@ali/ide-core-common';
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

  @Autowired()
  private connectionFactory: ConnectionFactory;

  @Autowired()
  private languageClientFactory: LanguageClientFactory;

  @Autowired()
  private workbenchEditorService: WorkbenchEditorService;

  // TODO 统一的resource管理
  abstract matchLanguage(uri: URI): boolean;

  // TODO 启动需要与应用生命周期关联，目前在index.active调用
  waitForActivate() {
    this.workbenchEditorService.onEditorOpenChange((uri) => {
      if (this.matchLanguage(uri)) {
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
