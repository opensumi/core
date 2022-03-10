import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { IDebugServer } from '@opensumi/ide-debug';
import { DebugSessionContributionRegistry } from '@opensumi/ide-debug/lib/browser';
import { FileSearchServicePath } from '@opensumi/ide-file-search/lib/common';

import {
  ExtensionHostProfilerServicePath,
  ExtensionNodeServiceServerPath,
  ExtensionService,
  IExtCommandManagement,
  AbstractExtensionManagementService,
  RequireInterceptorContribution,
  IRequireInterceptorService,
  RequireInterceptorService,
} from '../common';
import {
  AbstractNodeExtProcessService,
  AbstractWorkerExtProcessService,
  AbstractViewExtProcessService,
} from '../common/extension.service';

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
import { AbstractExtInstanceManagementService, IActivationEventService } from './types';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';

@Injectable()
export class ExtensionModule extends BrowserModule {
  contributionProvider = [RequireInterceptorContribution];
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
