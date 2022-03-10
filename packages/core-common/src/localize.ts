import { CaseInsensitiveMap } from './map';
import { format, mnemonicButtonLabel } from './utils/strings';

export type ILocalizationKey = string; // ts不支持symbol作为key

let _currentLanguageId = 'zh-CN';

const localizationRegistryMap = new CaseInsensitiveMap<string, LocalizationRegistry>();

export function localize(symbol: ILocalizationKey, defaultMessage?: string | undefined, scope = 'host'): string {
  const localizationRegistry = getLocalizationRegistry(scope);
  return localizationRegistry.getLocalizeString(symbol, defaultMessage);
}

export function formatLocalize(symbol: ILocalizationKey, ...args: any) {
  return format(localize(symbol), ...args);
}

export function registerLocalizationBundle(bundle: ILocalizationBundle, scope = 'host') {
  return getLocalizationRegistry(scope).registerLocalizationBundle(bundle);
}

interface IExtensionLocalizationValue {
  message: string;
  comment: string;
}

export interface IExtensionLocalizationContents {
  [key: string]: string | IExtensionLocalizationValue;
}

export interface ILocalizationBundle extends ILocalizationInfo {
  contents: IExtensionLocalizationContents;
}

export interface ILocalizationInfo {
  languageId: string;
  languageName: string;
  localizedLanguageName: string;
}

export interface ILocalizationContents {
  [key: string]: string;
}

interface ILocalizationRegistry {
  registerLocalizationBundle(bundle: ILocalizationBundle): void;

  getLocalizeString(symbol: ILocalizationKey, defaultLabel?: string): string;

  getAllLanguages(): ILocalizationInfo[];
}

function isExtensionLocalizationValue(thing: any): thing is IExtensionLocalizationValue {
  return typeof thing === 'object' && thing.message;
}

class LocalizationRegistry implements ILocalizationRegistry {
  private localizationMap = new CaseInsensitiveMap<string, ILocalizationContents>();

  public readonly localizationInfo = new CaseInsensitiveMap<string, ILocalizationInfo>();

  registerLocalizationBundle(bundle: ILocalizationBundle): void {
    const languageId = bundle.languageId;
    if (!languageId) {
      return;
    }
    const existingMessages = this.getContents(languageId);
    Object.keys(bundle.contents).forEach((key: ILocalizationKey) => {
      const rawContent = bundle.contents[key];
      let content: string;
      if (isExtensionLocalizationValue(rawContent)) {
        content = rawContent.message;
      } else {
        content = rawContent;
      }
      existingMessages[key] = mnemonicButtonLabel(content, true); // 暂时去除所有注记符
    });
    if (!this.localizationInfo.has(languageId)) {
      this.localizationInfo.set(languageId, Object.assign({}, bundle, { contents: undefined }));
    }
  }

  getLocalizeString(key: ILocalizationKey, defaultLabel?: string | null): string {
    return this.getContents(_currentLanguageId)[key] || this.getContents('default')[key] || defaultLabel || '';
  }

  private getContents(languageId: string | undefined = 'zh-CN'): ILocalizationContents {
    if (!languageId) {
      return {};
    }
    if (!this.localizationMap.has(languageId)) {
      this.localizationMap.set(languageId, {});
    }
    return this.localizationMap.get(languageId) as ILocalizationContents;
  }

  getAllLanguages(): ILocalizationInfo[] {
    return Array.from(this.localizationInfo.values());
  }
}

/**
 * 获取当前语言别名，默认为中文
 * TODO 临时通过 href 获取
 * @returns 当前语言别名
 */
export function getLanguageId(scope = 'host'): string {
  return _currentLanguageId;
}

export function getCurrentLanguageInfo(scope = 'host'): ILocalizationInfo {
  return getLocalizationRegistry(scope).localizationInfo.get(_currentLanguageId)!;
}

export function setLanguageId(languageId: string): void {
  _currentLanguageId = languageId;
}

export function getAvailableLanguages(scope = 'host'): ILocalizationInfo[] {
  return getLocalizationRegistry(scope).getAllLanguages();
}

function getLocalizationRegistry(scope: string): LocalizationRegistry {
  if (!localizationRegistryMap.has(scope)) {
    localizationRegistryMap.set(scope, new LocalizationRegistry());
  }
  return localizationRegistryMap.get(scope)!;
}

/**
 * 将整段字符串中所有的占位符标识的做一遍转换，
 * 标识符转换失败则返回该字符串本身：
 * ```js
 * "%abcd%1 %1234%2".replace(/%(.*?)%/g, (c, a)=>{return c;})
 * -> "%abcd%1 %1234%2"
 * ```
 * @param label 要转换的字段
 * @param scope 默认为 host
 */
export function replaceLocalizePlaceholder(label?: string, scope?: string): string | undefined {
  if (label) {
    return label.replace(/%(.*?)%/g, (w, p) => localize(p, w, scope).replace(/\"/g, '\\"'));
  }
  return label;
}

/**
 * 含有占位符标识的字段转换，字段为 falsy 的时候返回该字段
 * 占位符找不到时返回 fallback 值(默认为 undefined)
 * @param label 要转换的字段
 * @param scope 默认为 host
 * @param fallback 默认为 undefined
 */
export function replaceNlsField(
  label?: string,
  scope?: string,
  fallback: string | undefined = undefined,
): string | undefined {
  if (label) {
    const nlsRegex = /^%([\w\d.-]+)%$/i;
    const result = nlsRegex.exec(label);
    if (result) {
      return localize(result[1], fallback, scope);
    }
  }
  return label;
}
