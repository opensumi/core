import { ITerminalNetwork, ITerminalErrorService, TerminalNetworkStatus } from '../../src/common';

import { injector } from './inject';
import { delay } from './utils';

describe('Terminal Network', () => {
  let network: ITerminalNetwork;
  let errorService: ITerminalErrorService;

  beforeAll(() => {
    network = injector.get(ITerminalNetwork);
    network.reconnectClient = jest.fn(network.reconnectClient);
    network.setStatus(TerminalNetworkStatus.CONNECTED);
    errorService = injector.get(ITerminalErrorService);
    errorService.errors.set('1', {
      id: '1',
      stopped: true,
      message: 'mock error client',
      shouldReconnect: true,
    });
  });

  it('scheduleReconnection', async () => {
    network.scheduleReconnection();
    network.scheduleReconnection();
    network.scheduleReconnection();
    await delay(1000);
    expect((network.reconnectClient as jest.Mock).mock.calls.length).toBe(1);
    const reconnectInfo = network.getReconnectInfo('1');
    expect(reconnectInfo).toEqual({
      nextRetry: 0,
      times: 1,
    });
  });

  afterAll(() => {
    // network
  });
});
