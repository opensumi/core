import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, IDisposable } from '@opensumi/ide-core-common';

import { EMIT_EXT_HOST_EVENT } from '../../../common';
import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import { IExtHostCommon, IMainThreadCommon } from '../../../common/sumi/common';
import { IExtHostCommands, IExtensionDescription } from '../../../common/vscode';

export class ExtHostCommon implements IExtHostCommon {
  private emitters = new Map<string, Emitter<any[]>>();

  private proxy: IMainThreadCommon;

  constructor(private rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadCommon);
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
    const disposer = this.emitters.get(eventName)!.event((eventArgs: any[]) => listener(...eventArgs));
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
    fire: async (eventName: string, ...eventArgs: any[]) =>
      await extHostCommands.executeCommand(EMIT_EXT_HOST_EVENT.id, eventName, ...eventArgs),
    subscribe: (eventName: string, listener: (...eventArgs: any[]) => any) =>
      kaitianCommon.onEvent(eventName, listener),
  };
}
