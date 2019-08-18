import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-common';

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
  abstract getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any});
}

export abstract class ExtensionService {
  abstract async activate(): Promise<void>;
}

export abstract class ExtensionCapabilityRegistry {
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
}

export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export interface JSONType { [key: string]: any; }

// export abstract class Extension {
//   readonly id: string;
//   readonly name: string;
//   readonly activated: boolean;
//   readonly enabled: boolean;
//   readonly packageJSON: JSONType;
//   readonly path: string;
//   readonly realPath: string;
//   readonly extraMetadata: JSONType;

//   abstract activate(): Promise<void>;
//   abstract toJSON(): JSONType;

// }

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
