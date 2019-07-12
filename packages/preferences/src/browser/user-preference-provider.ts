import { Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-browser';
import { PreferenceScope } from '@ali/ide-core-browser/lib/preferences';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';

export namespace UserStorageUri {
    export const SCHEME = 'user_storage';
}

export const USER_PREFERENCE_URI = new URI().withScheme(UserStorageUri.SCHEME).withPath('settings.json');

@Injectable()
export class UserPreferenceProvider extends AbstractResourcePreferenceProvider {

    protected getUri(): URI {
        return USER_PREFERENCE_URI;
    }

    protected getScope() {
        return PreferenceScope.User;
    }
}
