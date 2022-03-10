import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule, QuickOpenService } from '@opensumi/ide-core-browser';
import {
  PrefixQuickOpenService,
  QuickPickService,
  IQuickInputService,
} from '@opensumi/ide-core-browser/lib/quick-open';

import { PrefixQuickOpenServiceImpl, QuickOpenContribution } from './prefix-quick-open.service';
import { QuickInputService } from './quick-input-service';
import { CoreQuickOpenContribution, QuickOpenFeatureContribution } from './quick-open.contribution';
import { MonacoQuickOpenService } from './quick-open.service';
import { QuickPickServiceImpl } from './quick-pick.service';

@Injectable()
export class CoreQuickOpenModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: PrefixQuickOpenService,
      useClass: PrefixQuickOpenServiceImpl,
    },
    {
      token: QuickOpenService,
      useClass: MonacoQuickOpenService,
    },
    {
      token: QuickPickService,
      useClass: QuickPickServiceImpl,
    },
    {
      token: IQuickInputService,
      useClass: QuickInputService,
    },
    CoreQuickOpenContribution,
  ];
  contributionProvider = QuickOpenContribution;
}

@Injectable()
export class QuickOpenModule extends CoreQuickOpenModule {
  providers = this.providers.concat(QuickOpenFeatureContribution);
}
