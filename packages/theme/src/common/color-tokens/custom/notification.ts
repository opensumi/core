import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import { NOTIFICATIONS_FOREGROUND } from '../notification';

/* --- notification --- */
export const ktNotificationsInfoIcon = registerColor(
  'kt.notificationsCloseIcon.foreground',
  { dark: NOTIFICATIONS_FOREGROUND, light: NOTIFICATIONS_FOREGROUND, hc: NOTIFICATIONS_FOREGROUND },
  localize('notificationCloseIconForeground', 'Notification close icon foreground.'),
);
