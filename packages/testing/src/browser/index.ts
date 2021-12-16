import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { TestProfileServiceToken } from '../common/test-profile';
import { TestResultServiceToken } from '../common/test-result';
import { TestTreeViewModelToken } from '../common/tree-view.model';
import { TestProfileServiceImpl } from './test-profile.service';
import { TestTreeViewModelImpl } from './test-tree-view.model';
import { TestResultServiceImpl } from './test.result.service';
import { TestServiceImpl } from './test.service';
import { TestingContribution } from './testing.contribution';
import { TestServiceToken } from '../common';

@Injectable()
export class TestingModule extends BrowserModule {
  providers: Provider[] = [
    TestingContribution,
    {
      token: TestServiceToken,
      useClass: TestServiceImpl,
    },
    {
      token: TestTreeViewModelToken,
      useClass: TestTreeViewModelImpl,
    },
    {
      token: TestProfileServiceToken,
      useClass: TestProfileServiceImpl,
    },
    {
      token: TestResultServiceToken,
      useClass: TestResultServiceImpl,
    },
  ];
}
