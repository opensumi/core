import { Injectable, Injector, Optional } from '@opensumi/di';

import { PreferenceScope, ISettingGroup, ISettingSection } from '../src';
import { PreferenceProvider } from '../src/preferences';

@Injectable()
export class MockPreferenceSchemaProvider {
  setSchema() {}
}

@Injectable()
export class MockPreferenceSettingsService {
  setPreference(key: string, value: any, scope: PreferenceScope) {
    // noop
  }
  getSettingGroups() {
    // noop
  }
  registerSettingGroup(group: ISettingGroup) {
    // noop
  }
  registerSettingSection(groupId: string, section: ISettingSection) {
    // noop
  }
  getSections(groupId: string, scope: PreferenceScope) {
    // noop
  }
  getPreference(preferenceName: string, scope: PreferenceScope) {
    // noop
  }
  setEnumLabels(preferenceName: string, labels: { [key: string]: string }): void {
    // noop
  }
}

@Injectable()
export class MockPreferenceProvider extends PreferenceProvider {
  protected readonly preferences: { [name: string]: any } = {};

  constructor(@Optional() protected scope: PreferenceScope) {
    super();
    this.init();
  }

  protected init() {
    this._ready.resolve();
  }

  getPreferences(resourceUri?: string): { [p: string]: any } {
    return this.preferences;
  }

  getLanguagePreferences(resourceUri?: string) {
    return {};
  }

  async doSetPreference(key: string, value: any, resourceUri?: string): Promise<boolean> {
    const oldValue = this.preferences[key];
    this.preferences[key] = value;
    return this.emitPreferencesChangedEvent([
      { preferenceName: key, oldValue, newValue: value, scope: this.scope, domain: [] },
    ]);
  }

  async setPreference(preferenceName: string, newValue: any, resourceUri?: string): Promise<boolean> {
    return await this.doSetPreference(preferenceName, newValue, resourceUri);
  }
}

export const injectMockPreferences = (injector: Injector) => {
  injector.overrideProviders(
    {
      token: PreferenceProvider,
      tag: PreferenceScope.User,
      useFactory: (injector) => injector.get(MockPreferenceProvider, [PreferenceScope.User]),
    },
    {
      token: PreferenceProvider,
      tag: PreferenceScope.Workspace,
      useFactory: (injector) => injector.get(MockPreferenceProvider, [PreferenceScope.Workspace]),
    },
    {
      token: PreferenceProvider,
      tag: PreferenceScope.Folder,
      useFactory: (injector) => injector.get(MockPreferenceProvider, [PreferenceScope.Folder]),
    },
  );
};
