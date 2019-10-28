import { IPreferenceSettingsService, PreferenceScope, ISettingGroup, IDisposable, ISettingSection } from '..';
import { Injectable } from '@ali/common-di';

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
