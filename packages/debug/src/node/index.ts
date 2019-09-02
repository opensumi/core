import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { DebugAdapterContribution, DebugAdapterSessionFactory, DebugAdapterFactory } from '../common/debug-model';
import { DebugAdapterSessionManager } from './debug-adapter-session-manager';
import { DebugAdapterSessionFactoryImpl, LaunchBasedDebugAdapterFactory } from './debug-adapter-factory';
import { DebugServicePath, DebugService } from '../common';
import { DebugServiceImpl } from './debug-service';
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
      token: DebugService,
      useClass: DebugServiceImpl,
    },
    DebugAdapterSessionContribution,
  ];

  contributionProvider = DebugAdapterContribution;

  backServices = [
    {
      servicePath: DebugServicePath,
      token: DebugService,
    },
  ];
}
