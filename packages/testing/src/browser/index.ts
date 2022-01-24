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
import { TestPeekMessageToken, TestServiceToken } from '../common';
import { TestingPeekOpenerServiceToken } from '../common/testingPeekOpener';

import './icons/icons.less';
import './outputPeek/test-peek-widget.less';
import './theme.less';

import { TestingPeekOpenerServiceImpl } from './outputPeek/test-peek-opener.service';
import { TestingPeekMessageServiceImpl } from './outputPeek/test-peek-message.service';
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
