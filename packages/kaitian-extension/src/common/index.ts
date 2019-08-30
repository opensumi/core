import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-common';
import * as cp from 'child_process';
import {createExtHostContextProxyIdentifier, ProxyIdentifier} from '@ali/ide-connection';
import { ExtHostStorage } from '../hosted/api/vscode/ext.host.storage';
import { VSCExtension } from '../hosted/vscode.extension';
import { ExtensionsActivator } from '../hosted/ext.host.activator';
import { Emitter } from '@ali/ide-core-common';

export interface IExtensionMetaData {
  path: string;
  packageJSON: {[key: string]: any};
  extraMetadata: JSONType;
  realPath: string; // 真实路径，用于去除symbolicLink
  extendConfig: JSONType;
}

export interface IExtraMetaData {
  [key: string]: any;
}

export const ExtensionNodeServiceServerPath = 'ExtensionNodeServiceServerPath';

export const IExtensionNodeService = Symbol('IExtensionNodeService');

// @Injectable()
// export abstract class IExtensionNodeService {
//   abstract async getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any});
//   abstract async createProcess();
//   abstract async getElectronMainThreadListenPath(clientId: string);
//   abstract async resolveConnection();
//   abstract async resolveProcessInit();
// }

export interface ExtraMetaData {
  [key: string]: any;
}

export interface IExtensionNodeService {
  getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: ExtraMetaData);
  createProcess();
  getElectronMainThreadListenPath(clientId: string);
  resolveConnection();
  resolveProcessInit();
}

export abstract class ExtensionService {
  abstract async activate(): Promise<void>;
  abstract async activeExtension(extension: IExtension): Promise<void>;
  abstract async getProxy<T>(identifier: ProxyIdentifier<T>): Promise<T>;
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
}

export abstract class ExtensionCapabilityRegistry {
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
}

export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export interface JSONType { [key: string]: any; }

export interface IExtension {
  readonly id: string;
  readonly name: string;
  readonly activated: boolean;
  readonly enabled: boolean;
  readonly packageJSON: JSONType;
  readonly path: string;
  readonly realPath: string;
  readonly extraMetadata: JSONType;
  readonly extendConfig: JSONType;
  readonly enableProposedApi: boolean;

  activate();
}

//  VSCode Types
export abstract class VSCodeContributePoint< T extends JSONType = JSONType > extends Disposable {
  constructor(protected json: T, protected contributes: any, protected extension: IExtensionMetaData) {
    super();
  }

  abstract async contribute();
}

export const CONTRIBUTE_NAME_KEY = 'contribute_name';
export function Contributes(name) {
  return (target) => {
    Reflect.defineMetadata(CONTRIBUTE_NAME_KEY, name, target);
  };
}

export const EXTENSION_EXTEND_SERVICE_PREFIX = 'extension_extend_service';
export const MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER = createExtHostContextProxyIdentifier('mock_extension_extend_proxy_identifier');

export interface IExtensionHostService {
  getExtensions(): IExtension[];
  getExtension(extensionId: string): VSCExtension<any> | undefined;
  storage: ExtHostStorage;
  activateExtension(id: string): Promise<void>;
  extentionsActivator: ExtensionsActivator;
  extensionsChangeEmitter: Emitter<string>;
}

export interface IExtendProxy {
  [key: string]: any;
}
