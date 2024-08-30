import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { DebugSessionContributionRegistry } from '@opensumi/ide-debug/lib/browser/debug-session-contribution';
import { IDebugServer } from '@opensumi/ide-debug/lib/common';
import { FileSearchServicePath } from '@opensumi/ide-file-search/lib/common';

import {
  AbstractExtensionManagementService,
  ExtensionHostProfilerServicePath,
  ExtensionNodeServiceServerPath,
  ExtensionService,
  IExtCommandManagement,
  IRequireInterceptorService,
  RequireInterceptorContribution,
  RequireInterceptorService,
} from '../common';
import {
  AbstractNodeExtProcessService,
  AbstractViewExtProcessService,
  AbstractWorkerExtProcessService,
} from '../common/extension.service';
import {
  IMainThreadExtenderService,
  MainThreadExtenderContribution,
  MainThreadExtenderService,
} from '../common/main.thread.extender';

import { ActivationEventServiceImpl } from './activation.service';
import { ExtCommandManagementImpl as ExtCommandManagementImpl } from './extension-command-management';
import { ExtInstanceManagementService } from './extension-instance-management';
import { ExtensionManagementService } from './extension-management.service';
import { NodeExtProcessService } from './extension-node.service';
import { ViewExtProcessService } from './extension-view.service';
import { WorkerExtProcessService } from './extension-worker.service';
import { ExtensionClientAppContribution, ExtensionCommandContribution } from './extension.contribution';
import { ExtensionServiceImpl } from './extension.service';
import { BrowserRequireInterceptorContribution } from './require-interceptor.contribution';
import { SumiContributionsService, SumiContributionsServiceToken } from './sumi/contributes';
import { AbstractExtInstanceManagementService, IActivationEventService } from './types';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';
import { VSCodeContributesService, VSCodeContributesServiceToken } from './vscode/contributes';

@Injectable()
export class ExtensionModule extends BrowserModule {
  contributionProvider = [RequireInterceptorContribution, MainThreadExtenderContribution];
  providers: Provider[] = [
    {
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    },
    {
      token: IDebugServer,
      useClass: ExtensionDebugService,
      override: true,
    },
    {
      token: DebugSessionContributionRegistry,
      useClass: ExtensionDebugSessionContributionRegistry,
      override: true,
    },
    {
      token: IActivationEventService,
      useClass: ActivationEventServiceImpl,
    },
    {
      token: IExtCommandManagement,
      useClass: ExtCommandManagementImpl,
    },
    {
      token: AbstractExtInstanceManagementService,
      useClass: ExtInstanceManagementService,
    },
    {
      token: AbstractExtensionManagementService,
      useClass: ExtensionManagementService,
    },
    {
      token: AbstractNodeExtProcessService,
      useClass: NodeExtProcessService,
    },
    {
      token: AbstractWorkerExtProcessService,
      useClass: WorkerExtProcessService,
    },
    {
      token: AbstractViewExtProcessService,
      useClass: ViewExtProcessService,
    },
    {
      token: IRequireInterceptorService,
      useClass: RequireInterceptorService,
    },
    {
      token: VSCodeContributesServiceToken,
      useClass: VSCodeContributesService,
    },
    {
      token: SumiContributionsServiceToken,
      useClass: SumiContributionsService,
    },
    {
      token: IMainThreadExtenderService,
      useClass: MainThreadExtenderService,
    },
    ExtensionCommandContribution,
    ExtensionClientAppContribution,
    BrowserRequireInterceptorContribution,
  ];

  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      clientToken: ExtensionService,
    },
    {
      servicePath: FileSearchServicePath,
    },
    {
      servicePath: ExtensionHostProfilerServicePath,
    },
  ];
}
