import { Injector } from '@ali/common-di';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { ITerminalServiceClient, ITerminalService } from '../../src/common';
import { TerminalNodePtyModule } from '../../src/node';
import { IPty } from '../../src/node/pty';

describe('TerminalServiceClientImpl', () => {
  let terminalServiceClient: ITerminalServiceClient;
  let terminalService: ITerminalService;
  let injector: Injector;
  const mockClientId = 'a';

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule], new Injector([]));
    terminalServiceClient = injector.get(ITerminalServiceClient);
    terminalService = injector.get(ITerminalService);
  });

  it('setConnectionClientId 需要正确设置id', () => {
    terminalServiceClient.setConnectionClientId(mockClientId);
    expect((terminalService as any).serviceClientMap.get(mockClientId)).not.toBeUndefined();
  });

  it('可以创建 pty，及常规操作', async () => {
    const mockId = '1';
    terminalServiceClient.create(mockId, 200, 200, { name: 'test'} );
    const terminal: IPty = (terminalService as any).getTerminal(mockId);
    let receiveData = '';

    terminal.on('data', (data: any) => {
      receiveData = receiveData + data;
    });

    terminalServiceClient.onMessage(mockId, JSON.stringify({ data: 'message test' }));
    terminalServiceClient.resize(mockId, 400, 400);

    await new Promise((resolve) => {
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

  it('dispose 可以正常销毁', async () => {
    (process as any).env.IS_DEV = 0;
    const mockId = '2';
    terminalServiceClient.create(mockId, 200, 200, { name: 'test'} );

    terminalServiceClient.disposeById(mockId);
    terminalServiceClient.dispose();

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    }).then();

    expect((terminalService as any).clientTerminalMap.get(mockClientId)).toBeUndefined();
  });
});
