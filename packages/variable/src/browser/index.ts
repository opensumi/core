import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IVariableResolverService } from '../common';

import { VariableQuickOpenService } from './variable-quick-open.service';
import { VariableResolverContribution } from './variable-resolver.contribution';
import { VariableResolverService } from './variable-resolver.service';

@Injectable()
export class VariableModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IVariableResolverService,
      useClass: VariableResolverService,
    },
    {
      token: VariableQuickOpenService,
      useClass: VariableQuickOpenService,
    },
    VariableResolverContribution,
  ];
}
