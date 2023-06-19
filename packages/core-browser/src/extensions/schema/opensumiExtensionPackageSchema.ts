import { localize } from '@opensumi/ide-core-common';

export const OpenSumiExtensionPackageSchema = {
  properties: {
    sumiContributes: {
      description: localize('sumiContributes.contributes'),
      type: 'object',
      properties: {} as { [key: string]: any },
      default: {},
    },
  },
};
