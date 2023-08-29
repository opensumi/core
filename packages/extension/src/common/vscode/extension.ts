/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strings, IExtensionProps } from '@opensumi/ide-core-common';
import type { Uri } from '@opensumi/ide-core-common';

import { IExtensionWalkthrough } from './walkthrough';

const { equalsIgnoreCase } = strings;

export const MANIFEST_CACHE_FOLDER = 'CachedExtensions';
export const USER_MANIFEST_CACHE_FILE = 'user';
export const BUILTIN_MANIFEST_CACHE_FILE = 'builtin';

export interface ICommand {
  command: string;
  title: string;
  category?: string;
}

export interface IConfigurationProperty {
  description: string;
  type: string | string[];
  default?: any;
}

export interface IConfiguration {
  title: string;
  properties: { [key: string]: IConfigurationProperty };
}

export interface IDebugger {
  label?: string;
  type: string;
  runtime?: string;
}

export interface IGrammar {
  language: string;
}

export interface IJSONValidation {
  fileMatch: string;
  url: string;
}

export interface IKeyBinding {
  command: string;
  key: string;
  when?: string;
  mac?: string;
  linux?: string;
  win?: string;
}

export interface ILanguage {
  id: string;
  extensions: string[];
  aliases: string[];
}

export interface IMenu {
  command: string;
  alt?: string;
  when?: string;
  group?: string;
}

export interface ISnippet {
  language: string;
}

export interface ITheme {
  label: string;
}

export interface IViewContainer {
  id: string;
  title: string;
}

export interface IView {
  id: string;
  name: string;
  when?: string;
}

export interface IColor {
  id: string;
  description: string;
  defaults: { light: string; dark: string; highContrast: string; highContrastLight: string };
}

export interface IExtensionContributions {
  commands?: ICommand[];
  configuration?: IConfiguration | IConfiguration[];
  debuggers?: IDebugger[];
  grammars?: IGrammar[];
  jsonValidation?: IJSONValidation[];
  keybindings?: IKeyBinding[];
  languages?: ILanguage[];
  menus?: { [context: string]: IMenu[] };
  snippets?: ISnippet[];
  themes?: ITheme[];
  iconThemes?: ITheme[];
  viewsContainers?: { [location: string]: IViewContainer[] };
  views?: { [location: string]: IView[] };
  walkthroughs?: IExtensionWalkthrough[];
  colors?: IColor[];
  localizations?: any[]; // ILocalization[];
}

export type ExtensionKind = 'ui' | 'workspace';

export interface IExtensionIdentifier {
  id: string;
  uuid?: string;
}

export interface IExtensionManifest {
  readonly name: string;
  readonly displayName?: string;
  readonly publisher: string;
  readonly version: string;
  readonly engines: { vscode: string };
  readonly description?: string;
  readonly main?: string;
  readonly browser?: string;
  readonly l10n?: string;
  readonly icon?: string;
  readonly categories?: string[];
  readonly keywords?: string[];
  readonly activationEvents?: string[];
  readonly extensionDependencies?: string[];
  readonly extensionPack?: string[];
  readonly extensionKind?: ExtensionKind;
  readonly contributes?: IExtensionContributions;
  readonly repository?: { url: string };
  readonly bugs?: { url: string };
  readonly enableProposedApi?: boolean;
  readonly api?: string;
  readonly scripts?: { [key: string]: string };
}

/**
 * **!Do not construct directly!**
 *
 * **!Only static methods because it gets serialized!**
 *
 * This represents the "canonical" version for an extension identifier. Extension ids
 * have to be case-insensitive (due to the marketplace), but we must ensure case
 * preservation because the extension API is already public at this time.
 *
 * For example, given an extension with the publisher `"Hello"` and the name `"World"`,
 * its canonical extension identifier is `"Hello.World"`. This extension could be
 * referenced in some other extension's dependencies using the string `"hello.world"`.
 *
 * To make matters more complicated, an extension can optionally have an UUID. When two
 * extensions have the same UUID, they are considered equal even if their identifier is different.
 */
export class ExtensionIdentifier {
  public readonly value: string;
  private readonly _lower: string;

  constructor(value: string) {
    this.value = value;
    this._lower = value.toLowerCase();
  }

  public static equals(
    a: ExtensionIdentifier | string | null | undefined,
    b: ExtensionIdentifier | string | null | undefined,
  ) {
    if (typeof a === 'undefined' || a === null) {
      return typeof b === 'undefined' || b === null;
    }
    if (typeof b === 'undefined' || b === null) {
      return false;
    }
    if (typeof a === 'string' || typeof b === 'string') {
      // At least one of the arguments is an extension id in string form,
      // so we have to use the string comparison which ignores case.
      const aValue = typeof a === 'string' ? a : a.value;
      const bValue = typeof b === 'string' ? b : b.value;
      return equalsIgnoreCase(aValue, bValue);
    }

    // Now we know both arguments are ExtensionIdentifier
    return a._lower === b._lower;
  }

  /**
   * Gives the value by which to index (for equality).
   */
  public static toKey(id: ExtensionIdentifier | string): string {
    if (typeof id === 'string') {
      return id.toLowerCase();
    }
    return id._lower;
  }
}

/**
 * 插件进程 extension 实例 vscode 保持一致，并且继承 IExtensionProps
 */
export interface IExtensionDescription extends IExtensionManifest, IExtensionProps {
  readonly identifier: ExtensionIdentifier;
  readonly uuid?: string;
  readonly isBuiltin: boolean;
  readonly isUnderDevelopment: boolean;
  readonly extensionLocation: Uri;
  enableProposedApi: boolean;
}

export function throwProposedApiError(extension: IExtensionDescription): void {
  // eslint-disable-next-line no-console
  throw new Error(
    `[${extension.name}]: Proposed API is only available when running out of dev or with the following command line switch: --enable-proposed-api ${extension.id}`,
  );
}

export interface IExtensionLanguagePackMetadata {
  [languageId: string]: IExtensionLanguagePack;
}

export interface IExtensionLanguagePack {
  hash: string;
  extensions: {
    version: string;
    extensionIdentifier: {
      id: string;
      uuid: string;
    };
  }[];
  translations: {
    [key: string]: string;
  };
}
