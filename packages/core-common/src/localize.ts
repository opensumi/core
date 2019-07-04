import { Injectable } from '@ali/common-di';

export type ILocalizationKey = string | symbol;

const localizationRegistryMap = new Map<string, ILocalizationRegistry>();

export function localize(symbol: ILocalizationKey, defaultMessage?: string, env: string = 'host'): string {
  return getLocalizationRegistry(env).getLocalizeString(symbol, defaultMessage);
}

export function registerLocalizationBundle(bundle: ILocalizationBundle, env: string = 'host') {
  return getLocalizationRegistry(env).registerLocalizationBundle(bundle);
}

export interface ILocalizationBundle {

  locale: string;

  messages: ILocalizationMessages;

}

export interface ILocalizationMessages{

  // 这里只能ts-ignore因为ts目前版本不允许symbol作为key 
  ///@ts-ignore
  [key : ILocalizationKey ]: string;
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
      key = key as keyof ILocalizationMessages;
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

function getLocalizationRegistry(env: string) {
  if(!localizationRegistryMap[env]){
    const langReg = location.href.match(/lang\=([\w-]+)/i);
    let lang = 'zh-CN';
    if (langReg) {
      lang = langReg[1];
    }
    localizationRegistryMap[env] = new LocalizationRegistry(lang);
  }
  return localizationRegistryMap[env];
}
