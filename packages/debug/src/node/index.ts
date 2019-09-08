import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { DebugAdapterContribution, DebugAdapterSessionFactory, DebugAdapterFactory } from '../common/debug-model';
import { DebugAdapterSessionManager } from './debug-adapter-session-manager';
import { DebugAdapterSessionFactoryImpl, LaunchBasedDebugAdapterFactory } from './debug-adapter-factory';
import { DebugServerPath, DebugServer } from '../common';
import { DebugServerImpl } from './debug-service';
import { DebugAdapterSessionContribution } from './debug-adapter-contribution';

@Injectable()
export class DebugModule extends NodeModule {
  providers: Provider[] = [
    {
      token: DebugAdapterSessionFactory,
      useClass: DebugAdapterSessionFactoryImpl,
    },
    {
      token: DebugAdapterFactory,
      useClass: LaunchBasedDebugAdapterFactory,
    },
    {
      token: DebugAdapterSessionManager,
      useClass: DebugAdapterSessionManager,
    },
    {
      token: DebugServer,
      useClass: DebugServerImpl,
    },
    DebugAdapterSessionContribution,
  ];

  contributionProvider = DebugAdapterContribution;

  backServices = [
    {
      servicePath: DebugServerPath,
      token: DebugServer,
    },
  ];
}

export * from './debug-adapter-contribution';
export * from './debug-adapter-contribution-registry';
export * from  './debug-adapter-factory';
export * from  './debug-adapter-session';
export * from  './debug-adapter-session-manager';
export * from  './debug-service';
