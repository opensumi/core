import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { NodeDebugAdapterContribution, Node2DebugAdapterContribution } from './node-debug-adapter-contribution';

@Injectable()
export class DebugNodejsModule extends NodeModule {
  providers: Provider[] = [
    NodeDebugAdapterContribution,
    Node2DebugAdapterContribution,
  ];
}
