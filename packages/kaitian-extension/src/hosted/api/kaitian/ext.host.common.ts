import { IExtHostCommands, IExtensionDescription } from '../../../common/vscode';
import { Emitter, IDisposable } from '@ali/ide-core-common';
import { MainThreadKaitianAPIIdentifier } from '../../../common/kaitian';
import { IRPCProtocol } from '@ali/ide-connection';
import { EMIT_EXT_HOST_EVENT } from '../../../common';
import { IExtHostCommon, IMainThreadCommon } from '../../../common/kaitian/common';

export class ExtHostCommon implements IExtHostCommon {

  private emitters = new Map<string, Emitter<any[]>>();

  private proxy: IMainThreadCommon;

  constructor(private rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadKaitianAPIIdentifier.MainThreadCommon);
  }

  async $acceptEvent(eventName: string, eventArgs: any[]): Promise<any[]> {
    if (!this.emitters.has(eventName)) {
      return [];
    }
    const res = await this.emitters.get(eventName)!.fireAndAwait(eventArgs);
    return res;
  }

  onEvent(eventName: string, listener: (...eventArgs: any[]) => any): IDisposable {
    if (!this.emitters.has(eventName)) {
      this.emitters.set(eventName, new Emitter());
    }

    this.proxy.$subscribeEvent(eventName);
    const disposer = this.emitters.get(eventName)!.event((eventArgs: any[]) => {
      return listener(...eventArgs);
    });
    return {
      dispose: () => {
        disposer.dispose();
        if (this.emitters.get(eventName)!.listenerSize === 0) {
          this.proxy.$unSubscribeEvent(eventName);
        }
      },
    };
  }

}

export function createEventAPIFactory(
  extHostCommands: IExtHostCommands,
  kaitianCommon: ExtHostCommon,
  extension: IExtensionDescription,
) {
  return {
    fire: async (eventName: string, ...eventArgs: any[]) => {
      return await extHostCommands.executeCommand(EMIT_EXT_HOST_EVENT.id, eventName, ...eventArgs);
    },
    subscribe: (eventName: string, listener: (...eventArgs: any[]) => any) => {
      return kaitianCommon.onEvent(eventName, listener);
    },
  };
}
