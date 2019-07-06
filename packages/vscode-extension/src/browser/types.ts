export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export const VSCodeExtensionService = Symbol('VSCodeExtensionService');

export interface VSCodeExtensionService {

  getProxy(identifier): Promise<any>;

}
