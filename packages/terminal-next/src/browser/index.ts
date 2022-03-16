import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import {
  ITerminalController,
  ITerminalService,
  ITerminalRestore,
  ITerminalTheme,
  ITerminalServicePath,
  ITerminalProcessPath,
  ITerminalClientFactory,
  ITerminalApiService,
  ITerminalSearchService,
  ITerminalGroupViewService,
  ITerminalErrorService,
  ITerminalInternalService,
  ITerminalRenderProvider,
  ITerminalNetwork,
  ITerminalHoverManagerService,
  ITerminalProfileService,
  ITerminalClientFactory2,
  ITerminalContributionService,
  ITerminalProfileInternalService,
} from '../common';
import { EnvironmentVariableServiceToken } from '../common/environmentVariable';
import { ITerminalPreference } from '../common/preference';

import {
  TerminalCommandContribution,
  TerminalMenuContribution,
  TerminalLifeCycleContribution,
  TerminalRenderContribution,
  TerminalKeybindinngContribution,
  TerminalNetworkContribution,
  TerminalPreferenceContribution,
} from './contribution';
import { TerminalApiService } from './terminal.api';
import { createTerminalClientFactory, createTerminalClientFactory2 } from './terminal.client';
import { TerminalContributionService } from './terminal.contribution';
import { TerminalController } from './terminal.controller';
import { TerminalEnvironmentService } from './terminal.environment.service';
import { TerminalErrorService } from './terminal.error';
import { TerminalHoverManagerService } from './terminal.hover.manager';
import { TerminalInternalService } from './terminal.internal.service';
import { TerminalNetworkService } from './terminal.network';
import { TerminalPreference } from './terminal.preference';
import { TerminalProfileService } from './terminal.profile';
import { TerminalProfileInternalService } from './terminal.profile.internal';
import { TerminalRenderProvider } from './terminal.render';
import { TerminalRestore } from './terminal.restore';
import { TerminalSearchService } from './terminal.search';
import { NodePtyTerminalService } from './terminal.service';
import { TerminalTheme } from './terminal.theme';
import { TerminalGroupViewService } from './terminal.view';

@Injectable()
export class TerminalNextModule extends BrowserModule {
  providers: Provider[] = [
    TerminalLifeCycleContribution,
    TerminalRenderContribution,
    TerminalCommandContribution,
    TerminalMenuContribution,
    TerminalKeybindinngContribution,
    TerminalNetworkContribution,
    TerminalPreferenceContribution,
    {
      token: ITerminalApiService,
      useClass: TerminalApiService,
    },
    {
      token: ITerminalController,
      useClass: TerminalController,
    },
    {
      token: ITerminalTheme,
      useClass: TerminalTheme,
    },
    {
      token: ITerminalSearchService,
      useClass: TerminalSearchService,
    },
    {
      token: ITerminalHoverManagerService,
      useClass: TerminalHoverManagerService,
    },
    {
      token: ITerminalGroupViewService,
      useClass: TerminalGroupViewService,
    },
    {
      token: ITerminalErrorService,
      useClass: TerminalErrorService,
    },
    {
      token: ITerminalService,
      useClass: NodePtyTerminalService,
    },
    {
      token: ITerminalInternalService,
      useClass: TerminalInternalService,
    },
    {
      token: ITerminalRestore,
      useClass: TerminalRestore,
    },
    {
      token: ITerminalPreference,
      useClass: TerminalPreference,
    },
    {
      token: ITerminalRenderProvider,
      useClass: TerminalRenderProvider,
    },
    {
      token: ITerminalClientFactory,
      useFactory: createTerminalClientFactory,
    },
    {
      token: ITerminalClientFactory2,
      useFactory: createTerminalClientFactory2,
    },
    {
      token: ITerminalNetwork,
      useClass: TerminalNetworkService,
    },
    {
      token: EnvironmentVariableServiceToken,
      useClass: TerminalEnvironmentService,
    },
    {
      token: ITerminalProfileService,
      useClass: TerminalProfileService,
    },
    {
      token: ITerminalProfileInternalService,
      useClass: TerminalProfileInternalService,
    },
    {
      token: ITerminalContributionService,
      useClass: TerminalContributionService,
    },
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: ITerminalService,
    },
    {
      servicePath: ITerminalProcessPath,
      clientToken: EnvironmentVariableServiceToken,
    },
  ];
}
