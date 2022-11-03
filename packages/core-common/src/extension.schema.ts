import { IJSONSchema } from './json-schema';

export type FrameworkKind = 'vscode' | 'opensumi';

export interface IExtensionPointDescriptor {
  extensionPoint: string;
  jsonSchema: IJSONSchema;
  frameworkKind?: FrameworkKind[];
}

export const IExtensionsSchemaService = Symbol('IExtensionsSchemaService');

export interface IExtensionsSchemaService {
  registerExtensionPoint(desc: IExtensionPointDescriptor): void;
  appendExtensionPoint(points: string[], desc: IExtensionPointDescriptor): void;
}
