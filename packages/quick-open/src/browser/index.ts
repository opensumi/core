import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { QuickOpenClientContribution } from './quick-open.contribution';
import { PrefixQuickOpenServiceImpl, QuickOpenContribution } from './prefix-quick-open.service';
import { PrefixQuickOpenService, QuickPickService } from './quick-open.model';
import { QuickPickServiceImpl } from './quick-pick.service';

@EffectDomain(require('../../package.json').name)
export class QuickOpenModule extends BrowserModule {
  providers = [
    QuickOpenClientContribution,
    {
      token: PrefixQuickOpenService,
      useClass: PrefixQuickOpenServiceImpl,
    },
    {
      token: QuickPickService,
      useClass: QuickPickServiceImpl,
    },
  ];
  contributionProvider = QuickOpenContribution;
}
