import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';

// 断网是状态栏用的颜色
// 没有很好的 backup token，先写死这个色值
export const ktStatusBarOfflineBackground = registerColor(
  'kt.statusbar.offline.background',
  {
    dark: '#D21F28',
    light: '#D21F28',
    hcDark: '#D21F28',
    hcLight: '#D21F28',
  },
  localize('statusBarOfflineBackground', 'StatusBar background color when app is offline'),
);

export const ktStatusBarOfflineForeground = registerColor(
  'kt.statusbar.offline.foreground',
  {
    dark: '#fff',
    light: '#fff',
    hcDark: '#fff',
    hcLight: '#fff',
  },
  localize('statusBarOfflineForeground', 'StatusBar foreground color when app is offline'),
);
