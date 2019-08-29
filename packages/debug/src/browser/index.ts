import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { VariableResolverService, VariableResolverFrontendContribution, VariableQuickOpenService } from './variable-resolver';
import { injectDebugPreferences } from './debug-preferences';
import { VariableContribution, VariableRegistry } from './variable-resolver';
import { DebugResourceResolverContribution } from './debug-resource';

@Injectable()
export class DebugModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: VariableRegistry,
      useClass: VariableRegistry,
    },
    {
      token: VariableResolverService,
      useClass: VariableResolverService,
    },
    {
      token: VariableQuickOpenService,
      useClass: VariableQuickOpenService,
    },
    VariableResolverFrontendContribution,
    DebugResourceResolverContribution,
  ];
  contributionProvider = VariableContribution;

  preferences = injectDebugPreferences;

}
