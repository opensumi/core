import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { darken, registerColor } from '../utils';

import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND } from './activity-bar';
import { activeContrastBorder, contrastBorder, errorForeground } from './base';
import { editorForeground, editorWarningForeground } from './editor';

// < --- Status --- >

export const STATUS_BAR_FOREGROUND = registerColor(
  'statusBar.foreground',
  {
    dark: '#FFFFFF',
    light: '#FFFFFF',
    hcDark: '#FFFFFF',
    hcLight: editorForeground,
  },
  localize(
    'statusBarForeground',
    'Status bar foreground color when a workspace or folder is opened. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_NO_FOLDER_FOREGROUND = registerColor(
  'statusBar.noFolderForeground',
  {
    dark: STATUS_BAR_FOREGROUND,
    light: STATUS_BAR_FOREGROUND,
    hcDark: STATUS_BAR_FOREGROUND,
    hcLight: STATUS_BAR_FOREGROUND,
  },
  localize(
    'statusBarNoFolderForeground',
    'Status bar foreground color when no folder is opened. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_BACKGROUND = registerColor(
  'statusBar.background',
  {
    dark: '#007ACC',
    light: '#007ACC',
    hcDark: null,
    hcLight: null,
  },
  localize(
    'statusBarBackground',
    'Status bar background color when a workspace or folder is opened. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_NO_FOLDER_BACKGROUND = registerColor(
  'statusBar.noFolderBackground',
  {
    dark: '#68217A',
    light: '#68217A',
    hcDark: null,
    hcLight: null,
  },
  localize(
    'statusBarNoFolderBackground',
    'Status bar background color when no folder is opened. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_BORDER = registerColor(
  'statusBar.border',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'statusBarBorder',
    'Status bar border color separating to the sidebar and editor. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_FOCUS_BORDER = registerColor(
  'statusBar.focusBorder',
  {
    dark: STATUS_BAR_FOREGROUND,
    light: STATUS_BAR_FOREGROUND,
    hcDark: null,
    hcLight: STATUS_BAR_FOREGROUND,
  },
  localize(
    'statusBarFocusBorder',
    'Status bar border color when focused on keyboard navigation. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_NO_FOLDER_BORDER = registerColor(
  'statusBar.noFolderBorder',
  {
    dark: STATUS_BAR_BORDER,
    light: STATUS_BAR_BORDER,
    hcDark: STATUS_BAR_BORDER,
    hcLight: STATUS_BAR_BORDER,
  },
  localize(
    'statusBarNoFolderBorder',
    'Status bar border color separating to the sidebar and editor when no folder is opened. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_ITEM_ACTIVE_BACKGROUND = registerColor(
  'statusBarItem.activeBackground',
  {
    dark: Color.white.transparent(0.18),
    light: Color.white.transparent(0.18),
    hcDark: Color.white.transparent(0.18),
    hcLight: Color.black.transparent(0.18),
  },
  localize(
    'statusBarItemActiveBackground',
    'Status bar item background color when clicking. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_ITEM_FOCUS_BORDER = registerColor(
  'statusBarItem.focusBorder',
  {
    dark: STATUS_BAR_FOREGROUND,
    light: STATUS_BAR_FOREGROUND,
    hcDark: null,
    hcLight: activeContrastBorder,
  },
  localize(
    'statusBarItemFocusBorder',
    'Status bar item border color when focused on keyboard navigation. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_ITEM_HOVER_BACKGROUND = registerColor(
  'statusBarItem.hoverBackground',
  {
    dark: Color.white.transparent(0.12),
    light: Color.white.transparent(0.12),
    hcDark: Color.white.transparent(0.12),
    hcLight: Color.black.transparent(0.12),
  },
  localize(
    'statusBarItemHoverBackground',
    'Status bar item background color when hovering. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND = registerColor(
  'statusBarItem.compactHoverBackground',
  {
    dark: Color.white.transparent(0.2),
    light: Color.white.transparent(0.2),
    hcDark: Color.white.transparent(0.2),
    hcLight: Color.black.transparent(0.2),
  },
  localize(
    'statusBarItemCompactHoverBackground',
    'Status bar item background color when hovering an item that contains two hovers. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_PROMINENT_ITEM_FOREGROUND = registerColor(
  'statusBarItem.prominentForeground',
  {
    dark: STATUS_BAR_FOREGROUND,
    light: STATUS_BAR_FOREGROUND,
    hcDark: STATUS_BAR_FOREGROUND,
    hcLight: STATUS_BAR_FOREGROUND,
  },
  localize(
    'statusBarProminentItemForeground',
    'Status bar prominent items foreground color. Prominent items stand out from other status bar entries to indicate importance. Change mode `Toggle Tab Key Moves Focus` from command palette to see an example. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_PROMINENT_ITEM_BACKGROUND = registerColor(
  'statusBarItem.prominentBackground',
  {
    dark: Color.black.transparent(0.5),
    light: Color.black.transparent(0.5),
    hcDark: Color.black.transparent(0.5),
    hcLight: Color.black.transparent(0.5),
  },
  localize(
    'statusBarProminentItemBackground',
    'Status bar prominent items background color. Prominent items stand out from other status bar entries to indicate importance. Change mode `Toggle Tab Key Moves Focus` from command palette to see an example. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_PROMINENT_ITEM_HOVER_BACKGROUND = registerColor(
  'statusBarItem.prominentHoverBackground',
  {
    dark: Color.black.transparent(0.3),
    light: Color.black.transparent(0.3),
    hcDark: Color.black.transparent(0.3),
    hcLight: null,
  },
  localize(
    'statusBarProminentItemHoverBackground',
    'Status bar prominent items background color when hovering. Prominent items stand out from other status bar entries to indicate importance. Change mode `Toggle Tab Key Moves Focus` from command palette to see an example. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_ERROR_ITEM_BACKGROUND = registerColor(
  'statusBarItem.errorBackground',
  {
    dark: darken(errorForeground, 0.4),
    light: darken(errorForeground, 0.4),
    hcDark: null,
    hcLight: '#B5200D',
  },
  localize(
    'statusBarErrorItemBackground',
    'Status bar error items background color. Error items stand out from other status bar entries to indicate error conditions. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_ERROR_ITEM_FOREGROUND = registerColor(
  'statusBarItem.errorForeground',
  {
    dark: Color.white,
    light: Color.white,
    hcDark: Color.white,
    hcLight: Color.white,
  },
  localize(
    'statusBarErrorItemForeground',
    'Status bar error items foreground color. Error items stand out from other status bar entries to indicate error conditions. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_WARNING_ITEM_BACKGROUND = registerColor(
  'statusBarItem.warningBackground',
  {
    dark: darken(editorWarningForeground, 0.4),
    light: darken(editorWarningForeground, 0.4),
    hcDark: null,
    hcLight: '#895503',
  },
  localize(
    'statusBarWarningItemBackground',
    'Status bar warning items background color. Warning items stand out from other status bar entries to indicate warning conditions. The status bar is shown in the bottom of the window.',
  ),
);

export const STATUS_BAR_WARNING_ITEM_FOREGROUND = registerColor(
  'statusBarItem.warningForeground',
  {
    dark: Color.white,
    light: Color.white,
    hcDark: Color.white,
    hcLight: Color.white,
  },
  localize(
    'statusBarWarningItemForeground',
    'Status bar warning items foreground color. Warning items stand out from other status bar entries to indicate warning conditions. The status bar is shown in the bottom of the window.',
  ),
);

// < --- Remote --- >

export const STATUS_BAR_HOST_NAME_BACKGROUND = registerColor(
  'statusBarItem.remoteBackground',
  {
    dark: ACTIVITY_BAR_BADGE_BACKGROUND,
    light: ACTIVITY_BAR_BADGE_BACKGROUND,
    hcDark: ACTIVITY_BAR_BADGE_BACKGROUND,
    hcLight: ACTIVITY_BAR_BADGE_BACKGROUND,
  },
  localize('statusBarItemHostBackground', 'Background color for the remote indicator on the status bar.'),
);

export const STATUS_BAR_HOST_NAME_FOREGROUND = registerColor(
  'statusBarItem.remoteForeground',
  {
    dark: ACTIVITY_BAR_BADGE_FOREGROUND,
    light: ACTIVITY_BAR_BADGE_FOREGROUND,
    hcDark: ACTIVITY_BAR_BADGE_FOREGROUND,
    hcLight: ACTIVITY_BAR_BADGE_FOREGROUND,
  },
  localize('statusBarItemHostForeground', 'Foreground color for the remote indicator on the status bar.'),
);

export const EXTENSION_BADGE_REMOTE_BACKGROUND = registerColor(
  'extensionBadge.remoteBackground',
  {
    dark: ACTIVITY_BAR_BADGE_BACKGROUND,
    light: ACTIVITY_BAR_BADGE_BACKGROUND,
    hcDark: ACTIVITY_BAR_BADGE_BACKGROUND,
    hcLight: ACTIVITY_BAR_BADGE_BACKGROUND,
  },
  localize('extensionBadge.remoteBackground', 'Background color for the remote badge in the extensions view.'),
);

export const EXTENSION_BADGE_REMOTE_FOREGROUND = registerColor(
  'extensionBadge.remoteForeground',
  {
    dark: ACTIVITY_BAR_BADGE_FOREGROUND,
    light: ACTIVITY_BAR_BADGE_FOREGROUND,
    hcDark: ACTIVITY_BAR_BADGE_FOREGROUND,
    hcLight: ACTIVITY_BAR_BADGE_FOREGROUND,
  },
  localize('extensionBadge.remoteForeground', 'Foreground color for the remote badge in the extensions view.'),
);

export const STATUS_BAR_DEBUGGING_BACKGROUND = registerColor(
  'statusBar.debuggingBackground',
  {
    dark: '#CC6633',
    light: '#CC6633',
    hcDark: '#BA592C',
    hcLight: '#B5200D',
  },
  localize(
    'statusBarDebuggingBackground',
    'Status bar background color when a program is being debugged. The status bar is shown in the bottom of the window',
  ),
);

export const STATUS_BAR_DEBUGGING_FOREGROUND = registerColor(
  'statusBar.debuggingForeground',
  {
    dark: STATUS_BAR_FOREGROUND,
    light: STATUS_BAR_FOREGROUND,
    hcDark: STATUS_BAR_FOREGROUND,
    hcLight: '#FFFFFF',
  },
  localize(
    'statusBarDebuggingForeground',
    'Status bar foreground color when a program is being debugged. The status bar is shown in the bottom of the window',
  ),
);

export const STATUS_BAR_DEBUGGING_BORDER = registerColor(
  'statusBar.debuggingBorder',
  {
    dark: STATUS_BAR_BORDER,
    light: STATUS_BAR_BORDER,
    hcDark: STATUS_BAR_BORDER,
    hcLight: STATUS_BAR_BORDER,
  },
  localize(
    'statusBarDebuggingBorder',
    'Status bar border color separating to the sidebar and editor when a program is being debugged. The status bar is shown in the bottom of the window',
  ),
);
