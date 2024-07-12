/* eslint-disable no-console */
import { CommonChannelPathHandler } from '../../src/common/server-handler';

describe('CommonChannelPathHandler', () => {
  it('basic', () => {
    const handler = new CommonChannelPathHandler();

    let channelOpened = false;
    let channelOpenParams = {} as any;
    let channelDisposed = false;
    handler.register('test/:id', {
      handler(channel, connectionId, params) {
        channelOpened = true;
        channelOpenParams = params;
      },
      dispose() {
        channelDisposed = true;
      },
    });

    const result = handler.getAll();
    expect(result.length).toBe(1);
    expect(result[0].length).toBe(1);

    const params = handler.getParams('test', 'a');
    expect(params).toEqual({
      id: 'a',
    });

    handler.openChannel('test/artin', {} as any, 'test_client_id');
    expect(channelOpened).toBeTruthy();
    expect(channelOpenParams).toEqual({
      id: 'artin',
    });

    handler.disposeConnectionClientId({} as any, 'test_client_id');
    expect(channelDisposed).toBeTruthy();
  });
});
