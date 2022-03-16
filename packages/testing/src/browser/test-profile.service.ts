import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-browser';

import { ITestProfileService, sorter } from '../common/test-profile';
import { ITestRunProfile, TestRunProfileBitset } from '../common/testCollection';
import { ITestController } from '../index';

@Injectable()
export class TestProfileServiceImpl extends Disposable implements ITestProfileService {
  private readonly testProfiles = new Map<
    string,
    {
      profiles: ITestRunProfile[];
      controller: ITestController;
    }
  >();

  removeProfile(controllerId: string, profileId?: number): void {
    const controller = this.testProfiles.get(controllerId);
    if (controller) {
      if (profileId) {
        const index = controller.profiles.findIndex((p) => p.profileId !== profileId);
        if (index >= 0) {
          controller.profiles.splice(index, 1);
        }
      } else {
        this.testProfiles.delete(controllerId);
      }
    }
  }

  addProfile(controller: ITestController, profile: ITestRunProfile): void {
    let record = this.testProfiles.get(profile.controllerId);
    if (record) {
      record.profiles.push(profile);
      record.profiles.sort(sorter);
    } else {
      record = {
        profiles: [profile],
        controller,
      };
      this.testProfiles.set(profile.controllerId, record);
    }
  }

  getBaseDefaultsProfile(group: TestRunProfileBitset): ITestRunProfile[] {
    const resultProfiles: ITestRunProfile[] = [];

    for (const { profiles } of this.testProfiles.values()) {
      const profile = profiles.find((p) => p.group === group);
      if (profile) {
        resultProfiles.push(profile);
      }
    }

    return resultProfiles;
  }

  getControllerProfiles(controllerId: string): ITestRunProfile[] {
    const record = this.testProfiles.get(controllerId);
    if (record) {
      return record.profiles;
    }
    return [];
  }
}
