import { ITestController, TestId } from '../index';

import { InternalTestItem, ITestRunProfile, TestRunProfileBitset } from './testCollection';

export const sorter = (a: ITestRunProfile, b: ITestRunProfile) => {
  if (a.isDefault !== b.isDefault) {
    return a.isDefault ? -1 : 1;
  }

  return a.label.localeCompare(b.label);
};

export const canUseProfileWithTest = (profile: ITestRunProfile, test: InternalTestItem) =>
  profile.controllerId === test.controllerId &&
  (TestId.isRoot(test.item.extId) || !profile.tag || test.item.tags.includes(profile.tag));

export const TestProfileServiceToken = Symbol('TestProfileService');

export interface ITestProfileService {
  addProfile(controller: ITestController, profile: ITestRunProfile): void;
  removeProfile(controllerId: string, profileId?: number): void;

  getBaseDefaultsProfile(group: TestRunProfileBitset): ITestRunProfile[];
  getControllerProfiles(controllerId: string): ITestRunProfile[];
}
