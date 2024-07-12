import { IConnectionShape } from '../connection/types';

import { ISerializer } from './types';

export * from './fury';
export * from './raw';
export * from './types';

export const wrapSerializer = <FROM, TO>(
  connection: IConnectionShape<TO>,
  serializer: ISerializer<FROM, TO>,
): IConnectionShape<FROM> => ({
  onceClose(cb) {
    return connection.onceClose(cb);
  },
  onMessage(cb) {
    return connection.onMessage((data) => {
      cb(serializer.deserialize(data));
    });
  },
  send(data) {
    connection.send(serializer.serialize(data));
  },
});
