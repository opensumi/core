import { Injectable, Autowired } from '@opensumi/di';
import { uuid } from '@opensumi/ide-core-common';
import { ITestProfileService, TestProfileServiceToken } from '../common/test-profile';
import { ITestResult, ITestResultService, TestResultImpl } from '../common/test-result';
import { ResolvedTestRunRequest, ExtensionRunTestsRequest, ITestRunProfile } from '../common/testCollection';

@Injectable()
export class TestResultServiceImpl implements ITestResultService {
  @Autowired(TestProfileServiceToken)
  protected readonly testProfiles: ITestProfileService;

  private results: ITestResult[] = [];

  createTestResult(req: ResolvedTestRunRequest | ExtensionRunTestsRequest): ITestResult {
    if ('targets' in req) {
      const id = uuid();
      const testResult = new TestResultImpl(id, req);
      this.addTestResult(testResult);
      return testResult;
    }

    let profile: ITestRunProfile | undefined;
    if ((req as ExtensionRunTestsRequest).profile) {
      const profiles = this.testProfiles.getControllerProfiles((req as ExtensionRunTestsRequest).controllerId);
      profile = profiles.find((c) => c.profileId === (req as ExtensionRunTestsRequest).profile!.id);
    }

    const resolved: ResolvedTestRunRequest = {
      targets: [],
      exclude: (req as ExtensionRunTestsRequest).exclude,
      isAutoRun: false,
    };

    if (profile) {
      resolved.targets.push({
        profileGroup: profile.group,
        profileId: profile.profileId,
        controllerId: (req as ExtensionRunTestsRequest).controllerId,
        testIds: (req as ExtensionRunTestsRequest).include,
      });
    }

    const result = new TestResultImpl((req as ExtensionRunTestsRequest).id, resolved);
    this.addTestResult(result);
    return result;
  }

  getResult(resultId: string): ITestResult | undefined {
    return this.results.find((r) => r.id === resultId);
  }

  addTestResult(result: ITestResult): void {
    if (result.completedAt === undefined) {
      this.results.unshift(result);
    } else {
      //
    }
  }
}
