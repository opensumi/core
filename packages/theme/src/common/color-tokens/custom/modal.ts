import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import {
  NOTIFICATIONS_BACKGROUND,
  NOTIFICATIONS_ERROR_ICON_FOREGROUND,
  NOTIFICATIONS_FOREGROUND,
  NOTIFICATIONS_INFO_ICON_FOREGROUND,
  NOTIFICATIONS_WARNING_ICON_FOREGROUND,
} from '../notification';

import { ktNotificationsSuccessIconForeground } from './notification';
import { ktTextSeparatorBackground } from './text';

export const ktModalForeground = registerColor(
  'kt.modal.foreground',
  { light: NOTIFICATIONS_FOREGROUND, dark: NOTIFICATIONS_FOREGROUND, hc: null },
  localize('ktModalForeground', 'Modal Foreground color.'),
);
export const ktModalBackground = registerColor(
  'kt.modal.background',
  { light: NOTIFICATIONS_BACKGROUND, dark: NOTIFICATIONS_BACKGROUND, hc: null },
  localize('ktModalBackground', 'Modal Background color.'),
);

export const ktModalSeparatorBackground = registerColor(
  'kt.modal.separatorBackground',
  { light: ktTextSeparatorBackground, dark: ktTextSeparatorBackground, hc: null },
  localize('ktModalSeparatorBackground', 'Modal Separator Background color'),
);
export const ktModalErrorIconForeground = registerColor(
  'kt.modalErrorIcon.foreground',
  { light: NOTIFICATIONS_ERROR_ICON_FOREGROUND, dark: NOTIFICATIONS_ERROR_ICON_FOREGROUND, hc: null },
  localize('ktModalErrorIconForeground', 'Modal Error Icon Foreground Color.'),
);
export const ktModalWarningIconForeground = registerColor(
  'kt.modalWarningIcon.foreground',
  { light: NOTIFICATIONS_WARNING_ICON_FOREGROUND, dark: NOTIFICATIONS_WARNING_ICON_FOREGROUND, hc: null },
  localize('ktModalWarningIconForeground', 'Modal Warning Icon Foreground Color.'),
);
export const ktModalInfoIconForeground = registerColor(
  'kt.modalInfoIcon.foreground',
  { light: NOTIFICATIONS_INFO_ICON_FOREGROUND, dark: NOTIFICATIONS_INFO_ICON_FOREGROUND, hc: null },
  localize('ktModalInfoIconForeground', 'Modal Info Icon Foreground Color.'),
);
export const ktModalSuccessIconForeground = registerColor(
  'kt.modalSuccessIcon.foreground',
  { light: ktNotificationsSuccessIconForeground, dark: ktNotificationsSuccessIconForeground, hc: null },
  localize('ktModalSuccessIconForeground', 'Modal Success Icon Foreground Color.'),
);
