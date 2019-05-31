import { MonacoLanguageClient, createConnection, MonacoServices, LanguageClientOptions } from 'monaco-languageclient';
import { LanguageContribution } from '../common';
import { Injectable } from '@ali/common-di';

/* tslint:disable-next-line: no-empty-interface */
export interface ILanguageClient extends MonacoLanguageClient {}

@Injectable()
export class LanguageClientFactory {
  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    // TODO 需要使用更底层的 service.install方法
    MonacoServices.install(editor);
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
