import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import { NOTIFICATIONS_FOREGROUND } from '../notification';

/* --- notification --- */
export const ktNotificationsCloseIconForeground = registerColor(
  'kt.notificationsCloseIcon.foreground',
  { dark: NOTIFICATIONS_FOREGROUND, light: NOTIFICATIONS_FOREGROUND, hc: NOTIFICATIONS_FOREGROUND },
  localize('notificationsCloseIconForeground', 'Notifications close icon foreground.'),
);

export const ktNotificationsSuccessIconForeground = registerColor(
  'kt.notificationsSuccessIcon.foreground',
  {
    dark: '#64B436',
    light: '#64B436',
    hc: null,
  },
  localize('notificationsSuccessIconForeground', 'Notifications success icon foreground.'),
);
