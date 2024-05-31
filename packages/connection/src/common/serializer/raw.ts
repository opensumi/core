import { ChannelMessage } from '../channel';

import { ISerializer } from './types';

export const rawSerializer: ISerializer<ChannelMessage, ChannelMessage> = {
  serialize: (message) => message,
  deserialize: (message) => message,
};
