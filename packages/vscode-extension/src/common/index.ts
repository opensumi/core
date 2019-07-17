import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier} from '@ali/ide-connection';
import { VSCodeExtensionService } from '../browser/types';
import { SerializedDocumentFilter } from './model.api';
import { IMainThreadDocumentsShape, ExtensionDocumentDataManager } from './doc';
import { IMainThreadCommands, IExtHostCommands } from './command';
import { IMainThreadMessage, IExtHostMessage } from './window';

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionServie: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionServie'),
  MainThreadDocuments: createExtHostContextProxyIdentifier<IMainThreadDocumentsShape>('MainThreadDocuments'),
  MainThreadMessages: createExtHostContextProxyIdentifier<IMainThreadMessage>('MainThreadMessage'),
};
export const ExtHostAPIIdentifier = {
  ExtHostLanguages: createExtHostContextProxyIdentifier<IExtHostLanguages>('ExtHostLanguages'),
  ExtHostCommands: createExtHostContextProxyIdentifier<IExtHostCommands>('ExtHostCommandsRegistry'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier<IExtensionProcessService>('ExtHostExtensionService'),
  ExtHostDocuments: createExtHostContextProxyIdentifier<ExtensionDocumentDataManager>('ExtHostDocuments'),
  ExtHostMessage: createExtHostContextProxyIdentifier<IExtHostMessage>('ExtHostMessage'),
};

export abstract class VSCodeExtensionNodeService {
  abstract async getExtHostPath(): Promise<string>;
}

export const VSCodeExtensionNodeServiceServerPath = 'VSCodeExtensionNodeServiceServerPath';

export interface IExtensionProcessService {
  $activateExtension(modulePath: string): Promise<void>;

}

export interface IMainThreadLanguages {
  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void;
}

export interface IExtHostLanguages {
  getLanguages(): Promise<string[]>;

  registerHoverProvider(selector, provider): any;
  $provideHover(handle: number, resource: any, position: any, token: any): Promise<any>;
}

export * from './doc';
export * from './command';
export * from './window';
