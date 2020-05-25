import { BrowserModule } from '@ali/ide-core-browser';
import { Injectable, Provider } from '@ali/common-di';

import { QuickOpenClientContribution } from './quick-open.contribution';
import { PrefixQuickOpenServiceImpl, QuickOpenContribution } from './prefix-quick-open.service';
import { PrefixQuickOpenService, QuickPickService, IQuickInputService } from './quick-open.model';
import { QuickPickServiceImpl } from './quick-pick.service';
import { QuickInputService } from './quick-input-service';

@Injectable()
export class CoreQuickOpenModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: PrefixQuickOpenService,
      useClass: PrefixQuickOpenServiceImpl,
    },
    {
      token: QuickPickService,
      useClass: QuickPickServiceImpl,
    },
    {
      token: IQuickInputService,
      useClass: QuickInputService,
    },
  ];
  contributionProvider = QuickOpenContribution;
}

@Injectable()
export class QuickOpenModule extends CoreQuickOpenModule {
  providers = this.providers.concat(QuickOpenClientContribution);
}
