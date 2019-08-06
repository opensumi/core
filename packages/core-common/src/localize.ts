import { format } from './utils/strings';

export type ILocalizationKey = string; //ts不支持symbol作为key

const localizationRegistryMap = new Map<string, ILocalizationRegistry>();

export function localize(symbol: ILocalizationKey, defaultMessage?: string, env: string = 'host'): string {
  return getLocalizationRegistry(env).getLocalizeString(symbol, defaultMessage);
}

export function formatLocalize(symbol: ILocalizationKey, ...args: any){
  return format(localize(symbol), ...args);
}

export function registerLocalizationBundle(bundle: ILocalizationBundle, env: string = 'host') {
  return getLocalizationRegistry(env).registerLocalizationBundle(bundle);
}

export interface ILocalizationBundle {

  languageId: string;
  languageName: string;
  localizedLanguageName: string;
  contents: ILocalizationContents;

}

export interface ILocalizationContents{
  [key : string ]: string;
}

interface ILocalizationRegistry {

  readonly currentLanguageId: string;

  registerLocalizationBundle(bundle: ILocalizationBundle): void;

  getLocalizeString(symbol: ILocalizationKey, defaultLabel?: string): string;

}

class LocalizationRegistry implements ILocalizationRegistry {

  constructor(private _currentLanguageId: string){

  }

  private localizationMap: Map<string, ILocalizationContents> = new Map() ;

  get currentLanguageId() {
    return this._currentLanguageId;
  }

  set currentLanguageId(languageId: string) {
    this._currentLanguageId = languageId;
  }

  registerLocalizationBundle(bundle: ILocalizationBundle): void {
    const existingMessages = this.getContents(bundle.languageId);
    Object.keys(bundle.contents).forEach((key: ILocalizationKey)=> {
      existingMessages[key] = bundle.contents[key];
    });
  }

  getLocalizeString(key: ILocalizationKey, defaultLabel?: string): string {

    return this.getContents(this.currentLanguageId)[key as keyof ILocalizationContents] || defaultLabel || '';
  }

  private getContents(languageId: string): ILocalizationContents {
    languageId = languageId.toLowerCase();
    if (!this.localizationMap.has(languageId)) {
      this.localizationMap.set(languageId, {})
    }
    return this.localizationMap.get(languageId) as ILocalizationContents;
  }

}

/**
 * 获取当前语言别名，默认为中文
 * TODO 临时通过 href 获取
 * @returns 当前语言别名
 */
export function getLanguageId(): string {
  let lang = 'zh-CN';
  const ls = global['localStorage'];
  if (ls && ls['lang']) {
      lang = ls['lang'];
  }
  return lang;
}

function getLocalizationRegistry(env: string) {
  if(!localizationRegistryMap[env]){
    let languageId = getLanguageId();
    localizationRegistryMap[env] = new LocalizationRegistry(languageId);
  }
  return localizationRegistryMap[env];
}

/**
 * 含有占位符标识的 key 转换
 * @param label
 */
export function replaceLocalizePlaceholder(label?: string): string | undefined {
  if (label) {
    return label.replace(/%(.*?)%/g, (_, p) => localize(p)) ;
  }
}


