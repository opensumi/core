import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-common';
import * as cp from 'child_process';

export interface IExtensionMetaData {
  path: string;
  packageJSON: {[key: string]: any};
  extraMetadata: {
    [key: string]: any,
  };
  realPath: string; // 真实路径，用于去除symbolicLink
}

export interface IExtraMetaData {
  [key: string]: any;
}

export const ExtensionNodeServiceServerPath = 'ExtensionNodeServiceServerPath';

@Injectable()
export abstract class ExtensionNodeService {
  abstract async getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any});
  abstract async createProcess();
  abstract async getElectronMainThreadListenPath(clientId: string);
  abstract async resolveConnection();
  abstract async resolveProcessInit();
}

export abstract class ExtensionService {
  abstract async activate(): Promise<void>;
  abstract async activeExtension(extension: IExtension);
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
