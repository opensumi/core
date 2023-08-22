/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// some code copied and modified from https://github.com/microsoft/vscode/blob/d5277e8e2b73134126cabd4fe570a15b821e96c1/src/vs/workbench/api/common/extHostLocalizationService.ts

import { IRPCProtocol } from '@opensumi/ide-connection';
import { LANGUAGE_DEFAULT, Uri as URI, IExtensionLogger, path, Deferred } from '@opensumi/ide-core-common';
import { format2 } from '@opensumi/ide-utils/lib/strings';

import { MainThreadAPIIdentifier } from '../../../common/vscode';
import { IExtensionDescription } from '../../../common/vscode';
import { IExtHostLocalization, IMainThreadLocalization, IStringDetails } from '../../../common/vscode/localization';

export class ExtHostLocalization implements IExtHostLocalization {
  protected readonly proxy: IMainThreadLocalization;
  private readonly isDefaultLanguage: boolean;
  private currentLanguage: string;

  private readonly bundleCache: Map<string, { contents: { [key: string]: string }; uri: URI }> = new Map();
  private whenReadyDeferred = new Deferred<void>();

  constructor(private rpcProtocol: IRPCProtocol, private logger: IExtensionLogger) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadLocalization);
    this.isDefaultLanguage = this.currentLanguage === LANGUAGE_DEFAULT;
  }

  get whenReady() {
    return this.whenReadyDeferred.promise;
  }

  $setCurrentLanguage(language: string) {
    this.currentLanguage = language;
    this.whenReadyDeferred.resolve();
  }

  getMessage(extensionId: string, details: IStringDetails): string {
    const { message, args, comment } = details;
    if (this.isDefaultLanguage) {
      return format2(message, args ?? {});
    }

    let key = message;
    if (comment && comment.length > 0) {
      key += `/${Array.isArray(comment) ? comment.join('') : comment}`;
    }
    const str = this.bundleCache.get(extensionId)?.contents[key];
    if (!str) {
      this.logger.warn(`Using default string since no string found in i18n bundle that has the key: ${key}`);
    }
    return format2(str ?? message, args ?? {});
  }

  getBundle(extensionId: string): { [key: string]: string } | undefined {
    return this.bundleCache.get(extensionId)?.contents;
  }

  getBundleUri(extensionId: string): URI | undefined {
    return this.bundleCache.get(extensionId)?.uri;
  }

  async initializeLocalizedMessages(extension: IExtensionDescription) {
    await this.whenReady;

    if (this.isDefaultLanguage || (!extension.l10n && !extension.isBuiltin)) {
      return;
    }

    if (this.bundleCache.has(extension.identifier.value)) {
      return;
    }

    let contents: { [key: string]: string } | undefined;
    const locatization = await this.getBundleLocation(extension);
    if (!locatization.uri) {
      this.logger.warn(`No bundle location found for extension ${extension.identifier.value}`);
      return;
    }
    try {
      const response = await this.proxy.$fetchBundleContents(locatization.uri);
      const result = JSON.parse(response);
      // 'contents.bundle' is a well-known key in the language pack json file that contains the _code_ translations for the extension
      contents = locatization.fromBundle ? result.contents?.bundle : result;
    } catch (e) {
      this.logger.error(
        `Failed to load translations for ${extension.identifier.value} from ${locatization.uri}: ${e.message}`,
      );
      return;
    }

    if (contents) {
      this.bundleCache.set(extension.identifier.value, {
        contents,
        uri: locatization.uri as URI,
      });
    }
  }

  private async getBundleLocation(extension: IExtensionDescription) {
    // VS Code 中，对于内置插件会默认从语言包内尝试获取 i18n 文件内容
    // 由于内置的逻辑存在差异，这里对于每个插件都尝试获取一下，以便兼容性
    // 见：https://github.com/microsoft/vscode/blob/d5277e8e2b73134126cabd4fe570a15b821e96c1/src/vs/workbench/api/common/extHostLocalizationService.ts#L97
    const uri = await this.proxy.$fetchBuiltInBundleUri(extension.identifier.value, this.currentLanguage);
    if (uri) {
      return {
        fromBundle: true,
        uri,
      };
    }
    return {
      fromBundle: false,
      uri: extension.l10n
        ? URI.file(
            path.join(
              extension.extensionLocation.fsPath.toString(),
              extension.l10n,
              `bundle.l10n.${this.currentLanguage}.json`,
            ),
          )
        : undefined,
    };
  }
}

export function createLocalizationApiFactory(
  extHostLocalization: IExtHostLocalization,
  extension: IExtensionDescription,
) {
  return {
    t(
      ...params:
        | [message: string, ...args: Array<string | number | boolean>]
        | [message: string, args: Record<string, any>]
        | [
            {
              message: string;
              args?: Array<string | number | boolean> | Record<string, any>;
              comment: string | string[];
            },
          ]
    ): string {
      if (typeof params[0] === 'string') {
        const key = params.shift() as string;

        // We have either rest args which are Array<string | number | boolean> or an array with a single Record<string, any>.
        // This ensures we get a Record<string | number, any> which will be formatted correctly.
        const argsFormatted = !params || typeof params[0] !== 'object' ? params : params[0];
        return extHostLocalization.getMessage(extension.identifier.value, {
          message: key,
          args: argsFormatted as Record<string | number, any> | undefined,
        });
      }

      return extHostLocalization.getMessage(extension.identifier.value, params[0]);
    },
    get bundle() {
      return extHostLocalization.getBundle(extension.identifier.value);
    },
    get uri() {
      return extHostLocalization.getBundleUri(extension.identifier.value);
    },
  };
}
