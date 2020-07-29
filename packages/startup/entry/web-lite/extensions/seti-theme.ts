import { vscAuthority } from './const';

export const themeSetiExtContributes = {
  extPath: vscAuthority + '/theme-seti',
  pkgJSON: {
    'contributes': {
      'iconThemes': [
        {
          'id': 'vs-seti',
          'label': 'Seti (Visual Studio Code)',
          'path': './icons/vs-seti-icon-theme.json',
        },
      ],
    },
  },
};
