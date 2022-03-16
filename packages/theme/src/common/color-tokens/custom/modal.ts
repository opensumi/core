import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import { NOTIFICATIONS_BACKGROUND, NOTIFICATIONS_FOREGROUND } from '../notification';

export const ktModalForeground = registerColor(
  'kt.modal.foreground',
  { light: NOTIFICATIONS_FOREGROUND, dark: '#D7DBDE', hc: null },
  localize('ktModalForeground', 'Modal Foreground color.'),
);
export const ktModalBackground = registerColor(
  'kt.modal.background',
  { light: NOTIFICATIONS_BACKGROUND, dark: '#35393D', hc: null },
  localize('ktModalBackground', 'Modal Background color.'),
);

export const ktModalSeparatorBackground = registerColor(
  'kt.modal.separatorBackground',
  { light: '#2C3033', dark: '#2C3033', hc: null },
  localize('ktModalSeparatorBackground', 'Modal Separator Background color'),
);
export const ktModalErrorIconForeground = registerColor(
  'kt.modalErrorIcon.foreground',
  { light: '#DB4345', dark: '#DB4345', hc: null },
  localize('ktModalErrorIconForeground', 'Modal Error Icon Foreground Color.'),
);
export const ktModalWarningIconForeground = registerColor(
  'kt.modalWarningIcon.foreground',
  { light: '#DB9238', dark: '#DB9238', hc: null },
  localize('ktModalWarningIconForeground', 'Modal Warning Icon Foreground Color.'),
);
export const ktModalInfoIconForeground = registerColor(
  'kt.modalInfoIcon.foreground',
  { light: '#DB4345', dark: '#DB4345', hc: null },
  localize('ktModalInfoIconForeground', 'Modal Info Icon Foreground Color.'),
);
export const ktModalSuccessIconForeground = registerColor(
  'kt.modalSuccessIcon.foreground',
  { light: '#64B436', dark: '#64B436', hc: null },
  localize('ktModalSuccessIconForeground', 'Modal Success Icon Foreground Color.'),
);
