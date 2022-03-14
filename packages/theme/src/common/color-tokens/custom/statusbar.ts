import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';

// 断网是状态栏用的颜色
// 没有很好的 backup token，先写死这个色值
export const ktStatusBarOfflineBackground = registerColor(
  'kt.statusbar.offline.background',
  {
    dark: '#D21F28',
    light: '#D21F28',
    hc: '#D21F28',
  },
  localize('statusBarOfflineBackground', 'StatusBar background color when app is offline'),
);
