import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { TestPeekMessageToken, TestServiceToken } from '../common';
import { TestProfileServiceToken } from '../common/test-profile';
import { TestResultServiceToken } from '../common/test-result';
import { TestingPeekOpenerServiceToken } from '../common/testingPeekOpener';
import { TestTreeViewModelToken } from '../common/tree-view.model';

import { TestingPeekMessageServiceImpl } from './outputPeek/test-peek-message.service';
import { TestingPeekOpenerServiceImpl } from './outputPeek/test-peek-opener.service';
import { TestProfileServiceImpl } from './test-profile.service';
import { TestTreeViewModelImpl } from './test-tree-view.model';
import { TestResultServiceImpl } from './test.result.service';
import { TestServiceImpl } from './test.service';
import { TestingContribution } from './testing.contribution';

import './icons/icons.less';
import './outputPeek/test-peek-widget.less';
import './theme.less';

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
    {
      token: TestingPeekOpenerServiceToken,
      useClass: TestingPeekOpenerServiceImpl,
    },
    {
      token: TestPeekMessageToken,
      useClass: TestingPeekMessageServiceImpl,
    },
  ];
}
