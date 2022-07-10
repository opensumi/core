import { localize } from '@opensumi/ide-core-common';

export const OpensumiExtensionPackageSchema = {
  properties: {
    kaitianContributes: {
      description: localize('sumiContributes.opensumiContributes'),
      type: 'object',
      properties: {} as { [key: string]: any },
      default: {},
    },
  },
};
