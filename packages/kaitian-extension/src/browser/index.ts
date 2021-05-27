import { Injectable, Provider } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { IDebugServer } from '@ali/ide-debug';
import { DebugSessionContributionRegistry } from '@ali/ide-debug/lib/browser';
import { FileSearchServicePath } from '@ali/ide-file-search/lib/common';

import { ExtensionHostProfilerServicePath, ExtensionNodeServiceServerPath, ExtensionService, IExtCommandManagement, AbstractExtensionManagementService } from '../common';
import { AbstractNodeExtProcessService, AbstractWorkerExtProcessService, AbstractViewExtProcessService } from '../common/extension.service';
import { ActivationEventServiceImpl } from './activation.service';
import { ExtCommandManagementImpl as ExtCommandManagementImpl } from './extension-command-management';
import { ExtInstanceManagementService } from './extension-instance-management';
import { ExtensionManagementService } from './extension-management.service';
import { NodeExtProcessService } from './extension-node.service';
import { ViewExtProcessService } from './extension-view.service';
import { WorkerExtProcessService } from './extension-worker.service';
import { KaitianExtensionClientAppContribution, KaitianExtensionCommandContribution } from './extension.contribution';
import { ExtensionServiceImpl } from './extension.service';
import { AbstractExtInstanceManagementService, IActivationEventService } from './types';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';

@Injectable()
export class KaitianExtensionModule extends BrowserModule {
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
    KaitianExtensionCommandContribution,
    KaitianExtensionClientAppContribution,
  ];

  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
    },
    {
      servicePath: FileSearchServicePath,
      clientToken: ExtensionService,
    },
    {
      servicePath: ExtensionHostProfilerServicePath,
    },
  ];
}
