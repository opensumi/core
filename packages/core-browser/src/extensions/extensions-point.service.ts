import lodashAssign from 'lodash/assign';
import lodashGet from 'lodash/get';
import lodashHas from 'lodash/has';
import lodashSet from 'lodash/set';

import { Autowired, Injectable } from '@opensumi/di';
import { IJSONSchema, localize } from '@opensumi/ide-core-common';

import { IJSONSchemaRegistry } from '../monaco';

import { OpensumiExtensionPackageSchema } from './schema/opensumiExtensionPackageSchema';
import { VSCodeExtensionPackageSchema } from './schema/vscodeExtensionPackageSchema';

export const EXTENSION_JSON_URI = 'vscode://schemas/vscode-extensions';
export const OPENSUMI_EXTENSION_JSON_URI = 'vscode://schemas/opensumi-extensions';

export type FrameworkKind = 'vscode' | 'opensumi';

export interface IExtensionPointDescriptor {
  extensionPoint: string;
  jsonSchema: IJSONSchema;
  frameworkKind?: FrameworkKind[];
}

export const IExtensionsPointService = Symbol('IExtensionsPointService');

export interface IExtensionsPointService {
  registerExtensionPoint(desc: IExtensionPointDescriptor): void;
  appendExtensionPoint(points: string[], desc: IExtensionPointDescriptor): void;
}

@Injectable()
export class ExtensionsPointServiceImpl implements IExtensionsPointService {

  @Autowired(IJSONSchemaRegistry)
  private schemaRegistry: IJSONSchemaRegistry;

  private registerSchema(): void {
    this.schemaRegistry.registerSchema(OPENSUMI_EXTENSION_JSON_URI, OpensumiExtensionPackageSchema, ['package.json']);
    this.schemaRegistry.registerSchema(EXTENSION_JSON_URI, VSCodeExtensionPackageSchema, ['package.json']);
  }

  private appendPropertiesFactory(kind: FrameworkKind): (points: string[], desc: IExtensionPointDescriptor) => void {
    const properties = kind === 'opensumi'
      ? OpensumiExtensionPackageSchema.properties!.kaitianContributes.properties
      : VSCodeExtensionPackageSchema.properties!.contributes.properties;

    return (points: string[], desc: IExtensionPointDescriptor) => {
      const { extensionPoint, jsonSchema } = desc;
      const assignExtensionPoint = points.concat(extensionPoint).filter(Boolean);

      if (lodashHas(properties, assignExtensionPoint)) {
        const perProp = lodashGet(properties, assignExtensionPoint.concat('properties'));
        lodashAssign(jsonSchema.properties, perProp);
      }
      lodashSet(properties, assignExtensionPoint, jsonSchema);
    };
  }

  private appendOpensumiProperties(points: string[], desc: IExtensionPointDescriptor): void {
    this.appendPropertiesFactory('opensumi')(points, desc);
  }

  private appendVScodeProperties(points: string[], desc: IExtensionPointDescriptor): void {
    this.appendPropertiesFactory('vscode')(points, desc);
  }

  public appendExtensionPoint(points: string[], desc: IExtensionPointDescriptor): void {
    if (!desc) {return;}

    const { frameworkKind = ['vscode'] } = desc;

    if (frameworkKind.includes('opensumi')) {
      this.appendOpensumiProperties(points, desc);
    }

    if (frameworkKind.includes('vscode')) {
      this.appendVScodeProperties(points, desc);
    }

    this.registerSchema();
  }

  public registerExtensionPoint(desc: IExtensionPointDescriptor): void {
    if (!desc) {return;}

    this.appendExtensionPoint([], desc);
  }
}
