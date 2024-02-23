/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.86.0/src/vs/platform/theme/common/iconRegistry.ts

import { Emitter, Event, IJSONSchema, IJSONSchemaMap, ThemeIcon, URI, localize } from '@opensumi/ide-core-common';
import { getCodiconFontCharacters } from '@opensumi/ide-core-common/lib/codicons';

import { sumiIconIdentifier } from './icons';

export const Extensions = {
  IconContribution: 'base.contributions.icons',
};

export declare type IconDefaults = ThemeIcon | IconDefinition;
export interface IconDefinition {
  font?: IconFontContribution;
  fontCharacter: string;
}
export interface IconFontContribution {
  readonly id: string;
  readonly definition: IconFontDefinition;
}
export interface IconContribution {
  readonly id: string;
  description: string | undefined;
  deprecationMessage?: string;
  readonly defaults: IconDefaults;
}

export interface IconFontDefinition {
  readonly weight?: string;
  readonly style?: string;
  readonly src: IconFontSource[];
}

export interface IconFontSource {
  readonly location: URI;
  readonly format: string;
}

export declare type IconIdentifier = string;

export interface IIconRegistry {
  readonly onDidChange: Event<void>;
  /**
   * Register a icon to the registry.
   * @param id The icon id
   * @param defaults The default values
   * @param description The description
   */
  registerIcon(id: IconIdentifier, defaults: IconDefaults, description?: string): ThemeIcon;
  /**
   * Deregister a icon from the registry.
   */
  deregisterIcon(id: IconIdentifier): void;
  /**
   * Get all icon contributions
   */
  getIcons(): IconContribution[];
  /**
   * Get the icon for the given id
   */
  getIcon(id: IconIdentifier): IconContribution | undefined;
  /**
   * JSON schema for an object to assign icon values to one of the icon contributions.
   */
  getIconSchema(): IJSONSchema;
  /**
   * JSON schema to for a reference to a icon contribution.
   */
  getIconReferenceSchema(): IJSONSchema;
  /**
   * Register a icon font to the registry.
   * @param id The icon font id
   * @param definition The icon font definition
   */
  registerIconFont(id: string, definition: IconFontDefinition): IconFontDefinition;
  /**
   * Deregister an icon font to the registry.
   */
  deregisterIconFont(id: string): void;
  /**
   * Get the icon font for the given id
   */
  getIconFont(id: string): IconFontDefinition | undefined;
}

class IconRegistry implements IIconRegistry {
  private readonly _onDidChange = new Emitter<void>();
  readonly onDidChange: Event<void> = this._onDidChange.event;

  private iconsById: { [key: string]: IconContribution };
  private sumiIconsById: { [key: string]: IconContribution };
  private iconFontsById: { [key: string]: IconFontDefinition };

  private iconSchema: IJSONSchema & { properties: IJSONSchemaMap } = {
    definitions: {
      icons: {
        type: 'object',
        properties: {
          fontId: {
            type: 'string',
            description: localize(
              'iconDefinition.fontId',
              'The id of the font to use. If not set, the font that is defined first is used.',
            ),
          },
          fontCharacter: {
            type: 'string',
            description: localize(
              'iconDefinition.fontCharacter',
              'The font character associated with the icon definition.',
            ),
          },
        },
        additionalProperties: false,
        defaultSnippets: [{ body: { fontCharacter: '\\\\e030' } }],
      },
    },
    type: 'object',
    properties: {},
  };
  private iconReferenceSchema: IJSONSchema & { enum: string[]; enumDescriptions: string[] } = {
    type: 'string',
    pattern: `^${ThemeIcon.iconNameExpression}$`,
    enum: [],
    enumDescriptions: [],
  };

  constructor() {
    this.iconsById = {};
    this.iconFontsById = {};
    this.sumiIconsById = {};
  }

  public registerIcon(
    id: string,
    defaults: IconDefaults,
    description?: string,
    deprecationMessage?: string,
  ): ThemeIcon {
    const existing = this.iconsById[id];
    if (existing) {
      if (description && !existing.description) {
        existing.description = description;
        this.iconSchema.properties[id].markdownDescription = `${description} $(${id})`;
        const enumIndex = this.iconReferenceSchema.enum.indexOf(id);
        if (enumIndex !== -1) {
          this.iconReferenceSchema.enumDescriptions[enumIndex] = description;
        }
        this._onDidChange.fire();
      }
      return existing;
    }
    const iconContribution: IconContribution = {
      id,
      defaults,
      description,
      deprecationMessage,
    };
    this.iconsById[id] = iconContribution;
    const propertySchema: IJSONSchema = { $ref: '#/definitions/icons' };
    if (deprecationMessage) {
      propertySchema.deprecationMessage = deprecationMessage;
    }
    if (description) {
      propertySchema.markdownDescription = `${description}: $(${id})`;
    }
    this.iconSchema.properties[id] = propertySchema;
    this.iconReferenceSchema.enum.push(id);
    this.iconReferenceSchema.enumDescriptions.push(description || '');

    this._onDidChange.fire();
    return { id };
  }
  public registerSumiIcon(
    id: string,
    defaults: IconDefaults,
    description?: string,
    deprecationMessage?: string,
  ): ThemeIcon {
    const existing = this.sumiIconsById[id];
    if (existing) {
      if (description && !existing.description) {
        existing.description = description;
        this.iconSchema.properties[id].markdownDescription = `${description} $(${id})`;
        const enumIndex = this.iconReferenceSchema.enum.indexOf(id);
        if (enumIndex !== -1) {
          this.iconReferenceSchema.enumDescriptions[enumIndex] = description;
        }
        this._onDidChange.fire();
      }
      return existing;
    }
    const iconContribution: IconContribution = {
      id,
      defaults,
      description,
      deprecationMessage,
    };
    this.sumiIconsById[id] = iconContribution;
    const propertySchema: IJSONSchema = { $ref: '#/definitions/icons' };
    if (deprecationMessage) {
      propertySchema.deprecationMessage = deprecationMessage;
    }
    if (description) {
      propertySchema.markdownDescription = `${description}: $(${id})`;
    }
    this.iconSchema.properties[id] = propertySchema;
    this.iconReferenceSchema.enum.push(id);
    this.iconReferenceSchema.enumDescriptions.push(description || '');

    this._onDidChange.fire();
    return { id };
  }

  public deregisterIcon(id: string): void {
    delete this.iconsById[id];
    delete this.iconSchema.properties[id];
    const index = this.iconReferenceSchema.enum.indexOf(id);
    if (index !== -1) {
      this.iconReferenceSchema.enum.splice(index, 1);
      this.iconReferenceSchema.enumDescriptions.splice(index, 1);
    }
    this._onDidChange.fire();
  }

  public getIcons(isSumi?: boolean): IconContribution[] {
    if (isSumi) {
      return Object.keys(this.sumiIconsById).map((id) => this.sumiIconsById[id]);
    }
    return Object.keys(this.iconsById).map((id) => this.iconsById[id]);
  }

  public getIcon(id: string): IconContribution | undefined {
    return this.iconsById[id];
  }
  public getSumiIcon(id: string): IconContribution | undefined {
    return this.sumiIconsById[id];
  }
  public getIconSchema(): IJSONSchema {
    return this.iconSchema;
  }

  public getIconReferenceSchema(): IJSONSchema {
    return this.iconReferenceSchema;
  }

  public registerIconFont(id: string, definition: IconFontDefinition): IconFontDefinition {
    const existing = this.iconFontsById[id];
    if (existing) {
      return existing;
    }
    this.iconFontsById[id] = definition;
    this._onDidChange.fire();
    return definition;
  }

  public deregisterIconFont(id: string): void {
    delete this.iconFontsById[id];
  }

  public getIconFont(id: string): IconFontDefinition | undefined {
    return this.iconFontsById[id];
  }

  public toString() {
    const sorter = (i1: IconContribution, i2: IconContribution) => i1.id.localeCompare(i2.id);
    const classNames = (i: IconContribution) => {
      while (ThemeIcon.isThemeIcon(i.defaults)) {
        i = this.iconsById[i.defaults.id];
      }
      return `codicon codicon-${i ? i.id : ''}`;
    };

    const reference: string[] = [];

    reference.push(
      '| preview     | identifier                        | default codicon ID                | description',
    );
    reference.push(
      '| ----------- | --------------------------------- | --------------------------------- | --------------------------------- |',
    );
    const contributions = Object.keys(this.iconsById).map((key) => this.iconsById[key]);

    for (const i of contributions.filter((i) => !!i.description).sort(sorter)) {
      reference.push(
        `|<i class="${classNames(i)}"></i>|${i.id}|${ThemeIcon.isThemeIcon(i.defaults) ? i.defaults.id : i.id}|${
          i.description || ''
        }|`,
      );
    }

    reference.push('| preview     | identifier                        ');
    reference.push('| ----------- | --------------------------------- |');

    for (const i of contributions.filter((i) => !ThemeIcon.isThemeIcon(i.defaults)).sort(sorter)) {
      reference.push(`|<i class="${classNames(i)}"></i>|${i.id}|`);
    }

    return reference.join('\n');
  }
}

const iconRegistry = new IconRegistry();

export function registerIcon(
  id: string,
  defaults: IconDefaults,
  description: string,
  deprecationMessage?: string,
): ThemeIcon {
  return iconRegistry.registerIcon(id, defaults, description, deprecationMessage);
}

export function getIconRegistry() {
  return iconRegistry;
}

// 初始化注册 vscode 定义 icon
function initialize() {
  const codiconFontCharacters = getCodiconFontCharacters();
  for (const icon in codiconFontCharacters) {
    if (Object.hasOwn(codiconFontCharacters, icon)) {
      const fontCharacter = '\\' + codiconFontCharacters[icon].toString(16);
      iconRegistry.registerIcon(icon, { fontCharacter });
    }
  }
  for (const icon in sumiIconIdentifier) {
    if (Object.hasOwn(sumiIconIdentifier, icon)) {
      const sumiicon = sumiIconIdentifier[icon];
      iconRegistry.registerSumiIcon(icon, sumiicon.defaults, sumiicon.description);
    }
  }
}

initialize();
