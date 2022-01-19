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
} from '../common';
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
import { TerminalController } from './terminal.controller';
import { TerminalTheme } from './terminal.theme';
import { NodePtyTerminalService } from './terminal.service';
import { TerminalInternalService } from './terminal.internal.service';
import { TerminalRestore } from './terminal.restore';
import { createTerminalClientFactory, createTerminalClientFactory2 } from './terminal.client';
import { TerminalApiService } from './terminal.api';
import { TerminalSearchService } from './terminal.search';
import { TerminalHoverManagerService } from './terminal.hover.manager';
import { TerminalGroupViewService } from './terminal.view';
import { TerminalErrorService } from './terminal.error';
import { TerminalPreference } from './terminal.preference';
import { TerminalRenderProvider } from './terminal.render';
import { TerminalNetworkService } from './terminal.network';
import { EnvironmentVariableServiceToken } from '../common/environmentVariable';
import { TerminalEnvironmentService } from './terminal.environment.service';
import { TerminalProfileService } from './terminal.profile';

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
