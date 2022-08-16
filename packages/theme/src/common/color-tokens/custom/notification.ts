import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';
import { NOTIFICATIONS_FOREGROUND } from '../notification';

/* --- notification --- */
export const ktNotificationsCloseIconForeground = registerColor(
  'kt.notificationsCloseIcon.foreground',
  { dark: NOTIFICATIONS_FOREGROUND, light: NOTIFICATIONS_FOREGROUND, hc: NOTIFICATIONS_FOREGROUND },
  localize('notificationsCloseIconForeground', 'Notifications close icon foreground.'),
);
