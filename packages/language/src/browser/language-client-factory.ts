import { MonacoLanguageClient, createConnection, Services, LanguageClientOptions } from 'monaco-languageclient';
import { LanguageContribution } from './language-client-contribution';
import { ILanguageClient } from './language-client-services';
import { Injectable, Autowired } from '@ali/common-di';
import { WindowImpl } from './services/window-impl';
import { MonacoLanguages } from './services/monaco-languages';
import { MonacoWorkspace } from './services/monaco-workspace';

@Injectable()
export class LanguageClientFactory {

  @Autowired()
  workspace: MonacoWorkspace;
  @Autowired()
  languages: MonacoLanguages;
  @Autowired()
  window: WindowImpl;

  initServices() {
    Services.install({
      workspace: this.workspace,
      languages: this.languages,
      window: this.window,
      // commands: {
      //   registerCommand: this.commandRegistry.registerCommand
      // }
    });
  }

  get(contribution: LanguageContribution, clientOptions: LanguageClientOptions,
      connectionProvider: any): ILanguageClient {
    const initializationFailedHandler = clientOptions.initializationFailedHandler;
    clientOptions.initializationFailedHandler = (e) => !!initializationFailedHandler && initializationFailedHandler(e);
    const client = new MonacoLanguageClient({
      id: contribution.id,
      name: contribution.name,
      clientOptions,
      connectionProvider: {
        get: (errorHandler, closeHandler) => {
          // TODO 连接的创建需要封装
          const connection = connectionProvider;
          return Promise.resolve(createConnection(connection, errorHandler, closeHandler));
        },
      },
    });
    return client;
  }
}
