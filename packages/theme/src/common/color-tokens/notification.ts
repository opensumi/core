import { localize } from '@opensumi/ide-core-common';

import { darken, lighten, registerColor } from '../utils';

import { contrastBorder } from './base';
import {
  editorErrorForeground,
  editorInfoForeground,
  editorWarningForeground,
  editorWidgetBackground,
  editorWidgetForeground,
} from './editor';
import { textLinkForeground } from './text';

// < --- Notifications --- >

export const NOTIFICATIONS_CENTER_BORDER = registerColor(
  'notificationCenter.border',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'notificationCenterBorder',
    'Notifications center border color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_TOAST_BORDER = registerColor(
  'notificationToast.border',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'notificationToastBorder',
    'Notification toast border color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_FOREGROUND = registerColor(
  'notifications.foreground',
  {
    dark: editorWidgetForeground,
    light: editorWidgetForeground,
    hcDark: editorWidgetForeground,
    hcLight: editorWidgetForeground,
  },
  localize(
    'notificationsForeground',
    'Notifications foreground color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_BACKGROUND = registerColor(
  'notifications.background',
  {
    dark: editorWidgetBackground,
    light: editorWidgetBackground,
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize(
    'notificationsBackground',
    'Notifications background color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_LINKS = registerColor(
  'notificationLink.foreground',
  {
    dark: textLinkForeground,
    light: textLinkForeground,
    hcDark: textLinkForeground,
    hcLight: textLinkForeground,
  },
  localize(
    'notificationsLink',
    'Notification links foreground color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_CENTER_HEADER_FOREGROUND = registerColor(
  'notificationCenterHeader.foreground',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize(
    'notificationCenterHeaderForeground',
    'Notifications center header foreground color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_CENTER_HEADER_BACKGROUND = registerColor(
  'notificationCenterHeader.background',
  {
    dark: lighten(NOTIFICATIONS_BACKGROUND, 0.3),
    light: darken(NOTIFICATIONS_BACKGROUND, 0.05),
    hcDark: NOTIFICATIONS_BACKGROUND,
    hcLight: NOTIFICATIONS_BACKGROUND,
  },
  localize(
    'notificationCenterHeaderBackground',
    'Notifications center header background color. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_BORDER = registerColor(
  'notifications.border',
  {
    dark: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
    light: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
    hcDark: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
    hcLight: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
  },
  localize(
    'notificationsBorder',
    'Notifications border color separating from other notifications in the notifications center. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_ERROR_ICON_FOREGROUND = registerColor(
  'notificationsErrorIcon.foreground',
  {
    dark: editorErrorForeground,
    light: editorErrorForeground,
    hcDark: editorErrorForeground,
    hcLight: editorErrorForeground,
  },
  localize(
    'notificationsErrorIconForeground',
    'The color used for the icon of error notifications. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_WARNING_ICON_FOREGROUND = registerColor(
  'notificationsWarningIcon.foreground',
  {
    dark: editorWarningForeground,
    light: editorWarningForeground,
    hcDark: editorWarningForeground,
    hcLight: editorWarningForeground,
  },
  localize(
    'notificationsWarningIconForeground',
    'The color used for the icon of warning notifications. Notifications slide in from the bottom right of the window.',
  ),
);

export const NOTIFICATIONS_INFO_ICON_FOREGROUND = registerColor(
  'notificationsInfoIcon.foreground',
  {
    dark: editorInfoForeground,
    light: editorInfoForeground,
    hcDark: editorInfoForeground,
    hcLight: editorInfoForeground,
  },
  localize(
    'notificationsInfoIconForeground',
    'The color used for the icon of info notifications. Notifications slide in from the bottom right of the window.',
  ),
);
