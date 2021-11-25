import { Injectable } from '@opensumi/common-di';
import { URI } from '@opensumi/ide-core-browser';
import { PreferenceScope } from '@opensumi/ide-core-browser/lib/preferences';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';
import { USER_STORAGE_SCHEME } from '../common';

export const USER_PREFERENCE_URI = new URI().withScheme(USER_STORAGE_SCHEME).withPath('settings.json');

@Injectable()
export class UserPreferenceProvider extends AbstractResourcePreferenceProvider {

  protected getUri(): URI {
    return USER_PREFERENCE_URI;
  }

  protected getScope() {
    return PreferenceScope.User;
  }
}
