import { ProxyIdentifier } from '@ali/ide-connection';

export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export const VSCodeExtensionService = Symbol('VSCodeExtensionService');

export interface VSCodeExtensionService {

  getProxy<T>(identifier: ProxyIdentifier<T>): Promise<T>;

}
