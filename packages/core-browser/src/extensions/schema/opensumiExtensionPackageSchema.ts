import { localize } from "@opensumi/ide-core-common";

export const OpensumiExtensionPackageSchema = {
  properties: {
    kaitianContributes: {
      description: localize(
        'vscode.extension.kaitianContributes',
        'All contributions of the KAITIAN extension represented by this package.',
      ),
      type: 'object',
      properties: {} as { [key: string]: any },
      default: {},
    },
  },
};
