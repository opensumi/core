import { Type } from '@furyjs/fury';

import { CommonServerPath } from '@opensumi/ide-core-common';

import type { TSumiProtocol } from '../sumi-rpc';

export const CommonServerProtocol = {
  name: CommonServerPath,
  methods: [
    {
      method: 'getBackendOS',
      request: [],
      response: {
        type: Type.int16(),
      },
    },
  ],
} as TSumiProtocol;
