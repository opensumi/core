import { DisposableCollection } from '@opensumi/ide-core-common';

import { IWSChannelCreateOptions, WSChannel, furySerializer, wrapSerializer } from '../../src/common';
import { IConnectionShape } from '../../src/common/connection/types';

export function createWSChannelForClient(connection: IConnectionShape<Uint8Array>, options: IWSChannelCreateOptions) {
  const disposable = new DisposableCollection();

  const wrappedConnection = wrapSerializer(connection, furySerializer);
  const channel = new WSChannel(wrappedConnection, options);
  disposable.push(
    wrappedConnection.onMessage((data) => {
      channel.dispatch(data);
    }),
  );
  connection.onceClose(() => {
    disposable.dispose();
  });

  return channel;
}
