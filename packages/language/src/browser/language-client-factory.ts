import { MonacoLanguageClient, createConnection, Services, LanguageClientOptions, MonacoLanguages, MonacoWorkspace } from 'monaco-languageclient';
import { Workspace, Window, Languages, ILanguageClient } from './language-client-services';
import { LanguageContribution } from '../common';
import { Injectable, Inject, Autowired } from '@ali/common-di';
import { WindowImpl } from './window-impl';

@Injectable()
export class LanguageClientFactory {

  constructor(
    @Inject(Workspace) protected workspace: MonacoWorkspace,
    @Inject(Languages) protected languages: MonacoLanguages,
    @Inject(Window) protected window: WindowImpl,
  ) {
    // TODO 需要使用更底层的 service.install方法，先研究一下里面到底是干啥的
    Services.install({
      workspace,
      languages,
      window,
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
        get: async (errorHandler, closeHandler) => {
          // TODO 连接的创建需要封装
          const connection = connectionProvider;
          return createConnection(connection, errorHandler, closeHandler);
        },
      },
    });
    return client;
  }
}
