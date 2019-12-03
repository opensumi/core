import { BasicEvent } from '@ali/ide-core-common';

export interface JSONType { [key: string]: any; }

export interface IExtensionProps {
  readonly id: string;
  readonly extensionId: string;
  readonly name: string;
  readonly activated: boolean;
  readonly enabled: boolean;
  readonly packageJSON: JSONType;
  readonly path: string;
  readonly realPath: string;
  readonly extraMetadata: JSONType;
  readonly extendConfig: JSONType;
  readonly enableProposedApi: boolean;
  readonly isUseEnable: boolean;
  workerVarId?: string;
  workerScriptPath?: string;
  readonly isBuiltin: boolean;
}

export class ExtensionEnabledEvent extends BasicEvent<IExtensionProps> {}
