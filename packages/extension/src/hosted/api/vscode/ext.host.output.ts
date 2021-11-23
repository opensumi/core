import * as types from '../../../common/vscode/ext-types';
import { IExtHostOutput, IMainThreadOutput, MainThreadAPIIdentifier } from '../../../common/vscode';
import { IRPCProtocol } from '@ide-framework/ide-connection';

export class ExtHostOutput implements IExtHostOutput {
  constructor(private rpcProtocol: IRPCProtocol) {

  }

  createOutputChannel(name: string): types.OutputChannel {
    return new OutputChannelImpl(name, this.rpcProtocol);
  }
}

export class OutputChannelImpl implements types.OutputChannel {

    private disposed: boolean;

    private proxy: IMainThreadOutput;

    constructor(readonly name: string, private rpcProtocol: IRPCProtocol) {
      this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadOutput);
    }

    dispose(): void {
        if (!this.disposed) {
            this.proxy.$dispose(this.name).then(() => {
                this.disposed = true;
            });
        }
    }

    append(value: string): void {
      this.validate();
      this.proxy.$append(this.name, value);
    }

    appendLine(value: string): void {
        this.validate();
        this.append(value + '\n');
    }

    clear(): void {
        this.validate();
        this.proxy.$clear(this.name);
    }

    show(preserveFocus: boolean | undefined): void {
        this.validate();
        this.proxy.$reveal(this.name, !!preserveFocus);
    }

    hide(): void {
        this.validate();
        this.proxy.$close(this.name);
    }

    private validate(): void {
        if (this.disposed) {
            throw new Error('Channel has been closed');
        }
    }
}
