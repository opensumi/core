import { format, mnemonicButtonLabel } from './utils/strings';

export type ILocalizationKey = string; //ts不支持symbol作为key

let _currentLanguageId: string = 'zh-CN';

const localizationRegistryMap = new Map<string, ILocalizationRegistry>();

export function localize(symbol: ILocalizationKey, defaultMessage?: string | undefined, scope: string = 'host'): string {
  const localizationRegistry = getLocalizationRegistry(scope);
  return localizationRegistry.getLocalizeString(symbol, defaultMessage);
}

export function formatLocalize(symbol: ILocalizationKey, ...args: any){
  return format(localize(symbol), ...args);
}

export function registerLocalizationBundle(bundle: ILocalizationBundle, scope: string = 'host') {
  return getLocalizationRegistry(scope).registerLocalizationBundle(bundle);
}

export interface ILocalizationBundle extends ILocalizationInfo{
  contents: ILocalizationContents;
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

class LocalizationRegistry implements ILocalizationRegistry {

  private localizationMap: Map<string, ILocalizationContents> = new Map() ;

  public readonly localizationInfo: Map<string, ILocalizationInfo> = new Map();

  registerLocalizationBundle(bundle: ILocalizationBundle): void {
    const existingMessages = this.getContents(bundle.languageId);
    Object.keys(bundle.contents).forEach((key: ILocalizationKey)=> {
      existingMessages[key] = mnemonicButtonLabel(bundle.contents[key], true); // 暂时去除所有注记符
    });
    if (!this.localizationInfo.has(bundle.languageId)) {
      this.localizationInfo.set(bundle.languageId, Object.assign({}, bundle, {contents: undefined}));
    }
  }

  getLocalizeString(key: ILocalizationKey, defaultLabel?: string | null): string {
    const defaultMessage = this.getContents('default')[key as keyof ILocalizationContents]
    return this.getContents(_currentLanguageId)[key as keyof ILocalizationContents] || defaultMessage || defaultLabel || '';
  }

  private getContents(languageId: string = 'zh-CN'): ILocalizationContents {
    languageId = languageId.toLowerCase();
    if (!this.localizationMap.has(languageId)) {
      this.localizationMap.set(languageId, {})
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
export function getLanguageId(scope: string = 'host'): string {
  return _currentLanguageId;
}

export function getCurrentLanguageInfo(scope: string = 'host'): ILocalizationInfo {
  return getLocalizationRegistry(scope).localizationInfo.get(_currentLanguageId)!;
}

export function setLanguageId(language): void {
  _currentLanguageId = language;
}

export function getAvailableLanguages(scope: string = 'host'): ILocalizationInfo[] {
  return getLocalizationRegistry(scope).getAllLanguages();
}

function getLocalizationRegistry(scope: string): LocalizationRegistry {
  if(!localizationRegistryMap[scope]){
    localizationRegistryMap[scope] = new LocalizationRegistry();
  }
  return localizationRegistryMap[scope];
}

/**
 * 含有占位符标识的 key 转换
 * @param label
 */
export function replaceLocalizePlaceholder(label: string, scope?: string): string {
  const nlsRegex = /^%([\w\d.-]+)%$/i;
  const result = nlsRegex.exec(label);
  if (result) {
    return localize(result[1], undefined, scope);
  }
  return label;
}
