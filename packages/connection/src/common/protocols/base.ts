import Fury, { Type } from '@furyjs/fury';

/**
 * @furyjs/hps use v8's fast-calls-api that can be called directly by jit, ensure that the version of Node is 20 or above.
 * Experimental feature, installation success cannot be guaranteed at this moment
 **/
// import hps from '@furyjs/hps';

const hps = undefined;

const fury = new Fury({ hps });

export const wsChannelProtocol = Type.object('ws-channel-protocol', {
  kind: Type.string(),
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
  content: Type.string(),
  code: Type.uint32(),
  reason: Type.string(),
  binary: Type.binary(),
});

const wsChannelProtocolSerializer = fury.registerSerializer(wsChannelProtocol);

export { wsChannelProtocolSerializer };
