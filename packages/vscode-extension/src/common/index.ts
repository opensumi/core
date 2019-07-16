import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier} from '@ali/ide-connection';
import { VSCodeExtensionService } from '../browser/types';
import { SerializedDocumentFilter } from './model.api';

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionServie: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionServie'),
};
export const ExtHostAPIIdentifier = {
  ExtHostCommands: createExtHostContextProxyIdentifier<IExtHostCommands>('ExtHostCommands'),
  ExtHostLanguages: createExtHostContextProxyIdentifier<IExtHostLanguages>('ExtHostLanguages'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier<IExtensionProcessService>('ExtHostExtensionService'),
};

export abstract class VSCodeExtensionNodeService {
  abstract async getExtHostPath(): Promise<string>;
}

export const VSCodeExtensionNodeServiceServerPath = 'VSCodeExtensionNodeServiceServerPath';

export interface IExtensionProcessService {
  $activateExtension(modulePath: string): Promise<void>;

}

export interface IMainThreadCommands {
  $registerCommand(id: string): void;
  $unregisterCommand(id: string): void;
}

export interface IMainThreadLanguages {
  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void;
}

export interface IExtHostCommands {
  registerCommand(global: boolean, id: string, callback: <T>(...args: any[]) => T | Promise<T>, thisArg?: any, description?: string);
  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T>;
}

export interface IExtHostLanguages {
  registerHoverProvider(selector, provider): any;
  $provideHover(handle: number, resource: any, position: any, token: any): Promise<any>;
}

export * from './doc';
