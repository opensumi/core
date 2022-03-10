import { IRPCProtocol } from '@opensumi/ide-connection';

import { IExtHostOutput, IMainThreadOutput, MainThreadAPIIdentifier } from '../../../common/vscode';
import * as types from '../../../common/vscode/ext-types';

export class ExtHostOutput implements IExtHostOutput {
  constructor(private rpcProtocol: IRPCProtocol) {}

  createOutputChannel(name: string): types.OutputChannel {
    return new OutputChannelImpl(name, this.rpcProtocol);
  }
}

// 批处理字符最大长度
const OUTPUT_BATCH_MAX_SIZE = 20 * 1024;
// 批处理延时
const OUTPUT_BATCH_DURATION_MS = 5;

export class OutputChannelImpl implements types.OutputChannel {
  private disposed: boolean;

  private proxy: IMainThreadOutput;

  private batchedOutputLine = '';

  private batchedTimer: NodeJS.Timeout | null = null;

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
    const data = this.batchedOutputLine + value;
    this.batchedOutputLine = data;

    if (this.batchedOutputLine.length >= OUTPUT_BATCH_MAX_SIZE) {
      this.flushOutputString();
    }

    if (!this.batchedTimer) {
      this.batchedTimer = global.setTimeout(() => this.flushOutputString(), OUTPUT_BATCH_DURATION_MS);
    }
  }

  appendLine(value: string): void {
    this.validate();
    this.append(value + '\n');
  }

  clear(): void {
    this.validate();
    this.proxy.$clear(this.name);
  }

  private flushOutputString() {
    this.proxy.$append(this.name, this.batchedOutputLine);
    this.batchedOutputLine = '';
    if (this.batchedTimer) {
      global.clearTimeout(this.batchedTimer);
      this.batchedTimer = null;
    }
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
