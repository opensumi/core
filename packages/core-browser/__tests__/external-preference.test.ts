import { registerExternalPreferenceProvider, getPreferenceLanguageId, PreferenceScope, getExternalPreferenceProvider, getPreferenceThemeId, getPreferenceIconThemeId, getExternalPreference } from '../src/preferences';

describe('external preference tests', () => {

  it('should be able to register preference provider and work properly', () => {

    const store: {
      [key: string]: any,
    } = {
      [PreferenceScope.Default]: undefined,
      [PreferenceScope.User]: undefined,
      [PreferenceScope.Workspace]: undefined,
      [PreferenceScope.Folder]: undefined,
    };

    registerExternalPreferenceProvider('test.preference', {
      get: (scope: PreferenceScope) => {
        return store[scope];
      },
      set: (value, scope: PreferenceScope) => {
        store[scope] = value;
      },
    });
    const schema =  {default: 'defaultSchemaTest'};

    expect(getExternalPreference('test.preference', schema).value).toBe('defaultSchemaTest');

    const provider = getExternalPreferenceProvider('test.preference')!;

    provider.set('Workspace', PreferenceScope.Workspace);
    expect(getExternalPreference('test.preference', schema).value).toBe('Workspace');
    expect(getExternalPreference('test.preference', schema).scope).toBe(PreferenceScope.Workspace);

    store[PreferenceScope.Folder] = 'Folder';
    expect(getExternalPreference('test.preference', schema).value).toBe('Folder');
    expect(getExternalPreference('test.preference', schema).scope).toBe(PreferenceScope.Folder);
    provider.set('DefaultTest', PreferenceScope.Default);
    expect(getExternalPreference('test.preference', schema).value).toBe('Folder');
    expect(getExternalPreference('test.preference', schema).scope).toBe(PreferenceScope.Folder);
    provider.set(undefined, PreferenceScope.Folder);
    provider.set(undefined, PreferenceScope.Workspace);
    expect(getExternalPreference('test.preference', schema).value).toBe('DefaultTest');
    expect(getExternalPreference('test.preference', schema).scope).toBe(PreferenceScope.Default);
  });

  it('default external preferences should work', () => {

    (global as any).localStorage = undefined;
    // should not throw error when localStorage is not defined;
    getExternalPreferenceProvider('general.theme')!.set('testTheme', PreferenceScope.Workspace);
    expect(getPreferenceThemeId()).toBe(undefined);
    // mock localStorage
    const store = new Map();
    (global as any).localStorage = {
      setItem: (key: string, value) => {
        store.set(key, value);
      },
      getItem: (key: string) => {
        return store.get(key);
      },
    };

    getExternalPreferenceProvider('general.theme')!.set('testTheme', PreferenceScope.Workspace);
    expect(getPreferenceThemeId()).toBe('testTheme');

    getExternalPreferenceProvider('general.language')!.set('testLanguage', PreferenceScope.Workspace);
    expect(getPreferenceLanguageId()).toBe('testLanguage');

    getExternalPreferenceProvider('general.icon')!.set('testIcon', PreferenceScope.Workspace);
    expect(getPreferenceIconThemeId()).toBe('testIcon');

  });

});
