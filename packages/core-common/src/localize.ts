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

  locale: string;

  messages: ILocalizationMessages;

}

export interface ILocalizationMessages{
  [key : string ]: string;
}

interface ILocalizationRegistry {

  readonly currentLocale: string;

  registerLocalizationBundle(bundle: ILocalizationBundle): void;

  getLocalizeString(symbol: ILocalizationKey, defaultLabel?: string): string;

}

class LocalizationRegistry implements ILocalizationRegistry {
  
  constructor(private _currentLocale: string){

  }
  
  private localizationMap: Map<string, ILocalizationMessages> = new Map() ;
  
  get currentLocale() {
    return this._currentLocale;
  }

  set currentLocale(locale: string) {
    this._currentLocale = locale;
  }

  registerLocalizationBundle(bundle: ILocalizationBundle): void {
    const existingMessages = this.getMessages(bundle.locale);
    Object.keys(bundle.messages).forEach((key: ILocalizationKey)=> {
      existingMessages[key] = bundle.messages[key];
    });
  }
  
  getLocalizeString(key: ILocalizationKey, defaultLabel?: string): string {
    
    return this.getMessages(this.currentLocale)[key as keyof ILocalizationMessages] || defaultLabel || '';
  }

  private getMessages(locale: string): ILocalizationMessages {
    if (!this.localizationMap.has(locale)) {
      this.localizationMap.set(locale, {})
    }
    return this.localizationMap.get(locale) as ILocalizationMessages;
  }
  
}

/**
 * 获取当前语言别名，默认为中文
 * TODO 临时通过 href 获取
 * @returns 当前语言别名
 */
export function getLanguageAlias(): string {
  let lang = 'zh-CN';
  if (global['location']) {
    const langReg = global['location'].href.match(/lang\=([\w-]+)/i);
    if (langReg) {
      lang = langReg[1];
    }
  }
  return lang;
}

function getLocalizationRegistry(env: string) {
  if(!localizationRegistryMap[env]){
    let lang = getLanguageAlias();
    localizationRegistryMap[env] = new LocalizationRegistry(lang);
  }
  return localizationRegistryMap[env];
}

