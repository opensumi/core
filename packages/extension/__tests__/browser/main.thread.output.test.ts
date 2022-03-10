import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Emitter } from '@opensumi/ide-core-common';
import { ExtHostAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockOutputService } from '../../__mocks__/api/output.service';
import * as types from '../../src/common/vscode/ext-types';
import { ExtHostOutput } from '../../src/hosted/api/vscode/ext.host.output';

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);

describe('MainThreadOutput Test Suites', () => {
  const injector = createBrowserInjector(
    [],
    new Injector([
      {
        token: OutputPreferences,
        useValue: {
          'output.logWhenNoPanel': true,
        },
      },
      {
        token: OutputService,
        useClass: MockOutputService,
      },
    ]),
  );
  let extOutput: ExtHostOutput;
  const service = injector.get(MockOutputService);
  const disposables: types.OutputChannel[] = [];

  afterAll(() => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  });

  beforeAll((done) => {
    extOutput = new ExtHostOutput(rpcProtocolExt);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostOutput, extOutput);
    done();
  });

  it('should create outputchannel', async () => {
    const name = 'test-output-1';
    const outputChannel = extOutput.createOutputChannel(name);
    disposables.push(outputChannel);
    expect(outputChannel.name).toBe(name);
    expect(service.getChannel(name).name).toBe(name);
  });

  it('should have enough API', async () => {
    const name = 'test-output-2';
    const outputChannel = extOutput.createOutputChannel(name);
    disposables.push(outputChannel);
    expect(typeof outputChannel.append).toBe('function');
    expect(typeof outputChannel.appendLine).toBe('function');
    expect(typeof outputChannel.clear).toBe('function');
    expect(typeof outputChannel.dispose).toBe('function');
    expect(typeof outputChannel.hide).toBe('function');
    expect(typeof outputChannel.show).toBe('function');
  });

  it('should append text', async (done) => {
    const name = 'test-output-3';
    const outputChannel = extOutput.createOutputChannel(name);
    disposables.push(outputChannel);
    outputChannel.appendLine('text');
    expect(service.getChannel(name)).toBeDefined();
    done();
  });

  it('should hide/show work', async () => {
    const name = 'test-output-4';
    const outputChannel = extOutput.createOutputChannel(name);
    disposables.push(outputChannel);
    outputChannel.show();
    expect(service.getChannel(name).isVisible).toBeTruthy();
  });

  it('can dispose output', async (done) => {
    const name = 'test-output-5';
    const outputChannel = extOutput.createOutputChannel(name);
    outputChannel.dispose();
    const existing = service.getChannels().find((c) => c.name === name);
    expect(existing).toBeUndefined();
    done();
  });
});
