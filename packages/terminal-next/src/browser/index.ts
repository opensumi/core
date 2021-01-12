import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import {
  ITerminalController,
  ITerminalService,
  ITerminalRestore,
  ITerminalTheme,
  ITerminalServicePath,
  ITerminalClientFactory,
  ITerminalApiService,
  ITerminalSearchService,
  ITerminalGroupViewService,
  ITerminalErrorService,
  ITerminalInternalService,
  TerminalOptions,
  IWidget,
  ITerminalRenderProvider,
  ITerminalClient,
} from '../common';
import {
  ITerminalPreference,
} from '../common/preference';
import {
  TerminalCommandContribution,
  TerminalMenuContribution,
  TerminalLifeCycleContribution,
  TerminalRenderContribution,
  TerminalKeybindinngContribution,
} from './contribution';
import { TerminalController } from './terminal.controller';
import { TerminalTheme } from './terminal.theme';
import { TerminalInternalService, NodePtyTerminalService } from './terminal.service';
import { TerminalRestore } from './terminal.restore';
import { TerminalClientFactory } from './terminal.client';
import { TerminalApiService } from './terminal.api';
import { TerminalSearchService } from './terminal.search';
import { TerminalGroupViewService } from './terminal.view';
import { TerminalErrorService } from './terminal.error';
import { TerminalPreference } from './terminal.preference';
import { TerminalRenderProvider } from './terminal.render';

@Injectable()
export class TerminalNextModule extends BrowserModule {
  providers: Provider[] = [
    TerminalLifeCycleContribution,
    TerminalRenderContribution,
    TerminalCommandContribution,
    TerminalMenuContribution,
    TerminalKeybindinngContribution,
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
      useFactory: (injector) => (widget: IWidget, options?: TerminalOptions) => {
        return TerminalClientFactory.createClient(injector, widget, options);
      },
    },
  ];
  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: ITerminalService,
    },
  ];
}
