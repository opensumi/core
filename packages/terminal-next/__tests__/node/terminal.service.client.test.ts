import { Injector } from '@opensumi/di';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { ITerminalServiceClient, ITerminalNodeService } from '../../src/common';
import { TerminalNodePtyModule } from '../../src/node';
import { IPty } from '../../src/node/pty';

describe('TerminalServiceClientImpl', () => {
  let terminalServiceClient: ITerminalServiceClient;
  let terminalService: ITerminalNodeService;
  let injector: Injector;
  const mockClientId = 'a';

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule], new Injector([]));
    terminalServiceClient = injector.get(ITerminalServiceClient);
    terminalService = injector.get(ITerminalNodeService);
  });

  it('setConnectionClientId, should be set the id correctly.', () => {
    terminalServiceClient.setConnectionClientId(mockClientId);
    expect((terminalService as any).serviceClientMap.get(mockClientId)).not.toBeUndefined();
  });

  it('Should be create pty, and other operations.', async () => {
    const mockId = '1';
    await terminalServiceClient.create(mockId, 200, 200, { name: 'test'} );
    const terminal: IPty = (terminalService as any).getTerminal(mockId);
    let receiveData = '';

    terminal.on('data', (data: any) => {
      receiveData = receiveData + data;
    });

    terminalServiceClient.onMessage(mockId, JSON.stringify({ data: 'message test' }));
    terminalServiceClient.resize(mockId, 400, 400);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    }).then();

    expect(typeof terminalServiceClient.getProcessId(mockId)).toEqual('number');
    expect(typeof terminalServiceClient.getShellName(mockId)).toEqual('string');
    expect(receiveData.indexOf('message test') > -1).toEqual(true);

    expect(terminal.rows).toEqual(400);
    expect(terminal.cols).toEqual(400);
  });

  it('Should be  disposed.', async () => {
    (process as any).env.IS_DEV = 0;
    const mockId = '2';
    await terminalServiceClient.create(mockId, 200, 200, { name: 'test'} );

    terminalServiceClient.disposeById(mockId);
    terminalServiceClient.dispose();

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    }).then();

    expect((terminalService as any).clientTerminalMap.get(mockClientId)).toBeUndefined();
  });
});
