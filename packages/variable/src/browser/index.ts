import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { VariableResolverContribution } from './variable-resolver.contribution';
import { VariableQuickOpenService } from './variable-quick-open.service';
import { IVariableResolverService } from '../common';
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
