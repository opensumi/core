import { Type } from '@furyjs/fury';

import { RPCProtocol } from '@opensumi/ide-connection/lib/common/binary-rpc';

import { DiskFileServicePath } from './tokens';

const UriComponentsProto = Type.object('uri-components', {
  scheme: Type.string(),
  authority: Type.string(),
  path: Type.string(),
  query: Type.string(),
  fragment: Type.string(),
});

export const DiskFileServiceProtocol = {
  name: DiskFileServicePath,
  methods: [
    {
      method: 'readFile',
      request: [
        {
          name: 'uri',
          type: UriComponentsProto,
        },
      ],
      response: {
        type: Type.binary(),
      },
    },
  ],
} as RPCProtocol;
