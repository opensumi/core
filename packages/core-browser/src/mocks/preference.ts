import { IPreferenceSettingsService, PreferenceScope, ISettingGroup, IDisposable, ISettingSection } from '..';
import { Injectable, Injector } from '@ali/common-di';
import { PreferenceProvider } from '../preferences';

@Injectable()
export class MockPreferenceSchemaProvider {
  setSchema() {

  }
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
  setEnumLabels(preferenceName: string, labels: { [key: string]: string; }): void {
    // noop
  }

}

@Injectable()
export class MockPreferenceProvider extends PreferenceProvider {
  protected readonly preferences: { [name: string]: any } = {};

  constructor() {
    super();
    this.init();
  }

  protected init() {
    this._ready.resolve();
  }

  getPreferences(resourceUri?: string): { [p: string]: any } {
    return this.preferences;
  }

  async setPreference(key: string, value: any, resourceUri?: string): Promise<boolean> {
    this.preferences[key] = value;
    return true;
  }

}

export const injectMockPreferences = (injector: Injector) => {
  injector.addProviders(
    {
      token: PreferenceProvider,
      tag: PreferenceScope.User,
      useClass: MockPreferenceProvider,
    },
    {
      token: PreferenceProvider,
      tag: PreferenceScope.Workspace,
      useClass: MockPreferenceProvider,
    },
    {
      token: PreferenceProvider,
      tag: PreferenceScope.Folder,
      useClass: MockPreferenceProvider,
    },
  );
};
