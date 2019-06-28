import { Injectable } from '@ali/common-di';

export type ILocalizationKey = string | symbol;

let localizationRegistry: ILocalizationRegistry;

export function localize(symbol: ILocalizationKey, defaultMessage?: string): string {
  return getLocalizationRegistry().getLocalizeString(symbol, defaultMessage);
}

export function registerLocalizationBundle(bundle: ILocalizationBundle) {
  return getLocalizationRegistry().registerLocalizationBundle(bundle);
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
  
  
  private _currentLocale: string = 'zh-CN'; 

  private localizationMap: Map<string, ILocalizationMessages> = new Map() ;
  

  get currentLocale() {
    return this._currentLocale;
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

function getLocalizationRegistry() {
  if (!localizationRegistry) {
    localizationRegistry = new LocalizationRegistry();
  }
  return localizationRegistry;
}
