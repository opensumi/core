import Fury, { Type } from '@furyjs/fury';

type PlatformBuffer = Uint8Array | Buffer;

export { PlatformBuffer };

/**
 * @furyjs/hps use v8's fast-calls-api that can be called directly by jit, ensure that the version of Node is 20 or above.
 * Experimental feature, installation success cannot be guaranteed at this moment
 **/
// import hps from '@furyjs/hps';

const hps = undefined;

// Now we describe data structures using JSON, but in the future, we will use more ways.
const description = Type.object('ws-channel-protocol', {
  kind: Type.string(),
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
  content: Type.string(),
  // error
  code: Type.uint32(),
  reason: Type.string(),
});

const fury = new Fury({ hps });
const { serialize, deserialize } = fury.registerSerializer(description);

export { serialize, deserialize };
