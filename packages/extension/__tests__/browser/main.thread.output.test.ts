import { Injector } from '@opensumi/di';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { ExtHostAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';

import { MockOutputService } from '../../__mocks__/api/output.service';
import { createMockPairRPCProtocol } from '../../__mocks__/initRPCProtocol';
import * as types from '../../src/common/vscode/ext-types';
import { ExtHostOutput } from '../../src/hosted/api/vscode/ext.host.output';

const { rpcProtocolExt } = createMockPairRPCProtocol();

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

  it('should append text', async () => {
    const name = 'test-output-3';
    const outputChannel = extOutput.createOutputChannel(name);
    disposables.push(outputChannel);
    outputChannel.appendLine('text');
    expect(service.getChannel(name)).toBeDefined();
  });

  it('should hide/show work', async () => {
    const name = 'test-output-4';
    const outputChannel = extOutput.createOutputChannel(name);
    disposables.push(outputChannel);
    outputChannel.show();
    expect(service.getChannel(name).isVisible).toBeTruthy();
  });

  it('can dispose output', async () => {
    const name = 'test-output-5';
    const outputChannel = extOutput.createOutputChannel(name);
    outputChannel.dispose();
    const existing = service.getChannels().find((c) => c.name === name);
    expect(existing).toBeUndefined();
  });

  it('can create log output channel', () => {
    const name = 'test-output-6';
    const outputChannel = extOutput.createOutputChannel(name, { log: true });
    disposables.push(outputChannel);
    expect(outputChannel.name).toBe(name);
    expect(service.getChannel(name).name).toBe(name);
    expect(typeof outputChannel.append).toBe('function');
    expect(typeof outputChannel.appendLine).toBe('function');
    expect(typeof outputChannel.clear).toBe('function');
    expect(typeof outputChannel.dispose).toBe('function');
    expect(typeof outputChannel.hide).toBe('function');
    expect(typeof outputChannel.trace).toBe('function');
    expect(typeof outputChannel.debug).toBe('function');
    expect(typeof outputChannel.info).toBe('function');
    expect(typeof outputChannel.warn).toBe('function');
    expect(typeof outputChannel.error).toBe('function');
    expect(typeof outputChannel.show).toBe('function');
  });
});
