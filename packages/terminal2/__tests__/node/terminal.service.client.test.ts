import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { TerminalServiceClientImpl } from '../../src/node/terminal.service.client';
import { ITerminalServiceClient, ITerminalService } from '../../src/common';
import { TerminalServiceImpl } from '../../src/node/terminal.service';
import { Terminal2Module } from '../../src/node/index';

describe('PtyService', () => {

  const injector = createNodeInjector([Terminal2Module]);
  injector.addProviders({
    token: ITerminalServiceClient,
    useClass: TerminalServiceClientImpl,
  }, {
    token: ITerminalService,
    useClass: TerminalServiceImpl,
  });

  const terminalServiceClient: ITerminalServiceClient = injector.get(ITerminalServiceClient);

  test('setConnectionClientId', () => {
    terminalServiceClient.setConnectionClientId('1');

    expect((terminalServiceClient as any).clientId).toEqual('1');
  });

  test('create', async () => {
    const result = await terminalServiceClient.create('2', 2, 4, {});

    expect(typeof result.pid === 'number').toBe(true);
    expect(typeof result.name === 'string').toBe(true);
  });

  test('onMessage', () => {
    expect(terminalServiceClient.onMessage('2', 'mes')).toBeUndefined();
  });

  test('resize', () => {
    expect(terminalServiceClient.resize('2', 4, 8)).toBeUndefined();
  });

  test('disposeById', () => {
    expect(terminalServiceClient.disposeById('2')).toBeUndefined();
  });

  test('getProcessId', () => {
    expect(terminalServiceClient.getProcessId('2')).toBeDefined();
  });

  test('dispose', () => {
    expect(terminalServiceClient.dispose()).toBeUndefined();
  });
});
