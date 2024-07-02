import { Injectable, Provider } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  ITerminalNodeService,
  ITerminalProcessPath,
  ITerminalProcessService,
  ITerminalServiceClient,
  ITerminalServicePath,
} from '../common';
import { terminalIntellCommonDeps } from '../common/intell';
import { ITerminalIntellEnvironment } from '../common/intell/environment';
import { IFigSpecLoader, ITerminalSuggestionProviderPath, ITerminalSuggestionRuntime } from '../common/intell/runtime';

import { IPtyService, PtyService } from './pty';
import { PtyServiceManager, PtyServiceManagerToken } from './pty.manager';
import { IShellIntegrationService, ShellIntegrationService } from './shell-integration.service';
import { TerminalIntellEnviromentNode } from './terminal.intell.enviroment';
import { SpecLoaderNodeImpl } from './terminal.intell.spec.loader';
import { TerminalProcessServiceImpl } from './terminal.process.service';
import { ITerminalProfileServiceNode, TerminalProfileServiceNode } from './terminal.profile.service';
import { TerminalServiceImpl } from './terminal.service';
import { TerminalServiceClientImpl } from './terminal.service.client';


@Injectable()
export class TerminalNodePtyModule extends NodeModule {
  providers: Provider[] = [
    {
      token: ITerminalNodeService,
      useClass: TerminalServiceImpl,
    },
    {
      token: ITerminalServiceClient,
      useClass: TerminalServiceClientImpl,
    },
    {
      token: ITerminalProcessService,
      useClass: TerminalProcessServiceImpl,
    },
    {
      token: IShellIntegrationService,
      useClass: ShellIntegrationService,
    },
    {
      token: IPtyService,
      useClass: PtyService,
    },
    {
      token: ITerminalProfileServiceNode,
      useClass: TerminalProfileServiceNode,
    },
    {
      token: PtyServiceManagerToken,
      useClass: PtyServiceManager,
    },
    {
      token: ITerminalIntellEnvironment, // 提供终端智能需要的 Node.js 抽象环境
      useClass: TerminalIntellEnviromentNode,
    },
    {
      token: IFigSpecLoader, // 动态的 Fig Spec 加载逻辑
      useClass: SpecLoaderNodeImpl,
    },
    ...terminalIntellCommonDeps,
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      token: ITerminalServiceClient,
    },
    {
      servicePath: ITerminalProcessPath,
      token: ITerminalProcessService,
    },
    {
      servicePath: ITerminalSuggestionProviderPath, // Fig Suggestion 终端智能补全能力，暴露给前端
      token: ITerminalSuggestionRuntime,
    },
  ];
}
