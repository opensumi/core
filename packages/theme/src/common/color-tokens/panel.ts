import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../color-registry';

import { contrastBorder } from './base';
import { editorBackground } from './editor';
import { textLinkActiveForeground } from './text';

// < --- Panels --- >
export const PANEL_BACKGROUND = registerColor(
  'panel.background',
  {
    dark: editorBackground,
    light: editorBackground,
    hc: editorBackground,
  },
  localize(
    'panelBackground',
    'Panel background color. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_BORDER = registerColor(
  'panel.border',
  {
    dark: Color.fromHex('#808080').transparent(0.35),
    light: Color.fromHex('#808080').transparent(0.35),
    hc: contrastBorder,
  },
  localize(
    'panelBorder',
    'Panel border color to separate the panel from the editor. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_ACTIVE_TITLE_FOREGROUND = registerColor(
  'panelTitle.activeForeground',
  {
    dark: '#E7E7E7',
    light: '#424242',
    hc: Color.white,
  },
  localize(
    'panelActiveTitleForeground',
    'Title color for the active panel. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_INACTIVE_TITLE_FOREGROUND = registerColor(
  'panelTitle.inactiveForeground',
  {
    dark: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.6),
    light: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.75),
    hc: Color.white,
  },
  localize(
    'panelInactiveTitleForeground',
    'Title color for the inactive panel. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_ACTIVE_TITLE_BORDER = registerColor(
  'panelTitle.activeBorder',
  {
    dark: textLinkActiveForeground,
    light: textLinkActiveForeground,
    hc: contrastBorder,
  },
  localize(
    'panelActiveTitleBorder',
    'Border color for the active panel title. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_DRAG_AND_DROP_BACKGROUND = registerColor(
  'panel.dropBackground',
  {
    dark: Color.white.transparent(0.12),
    light: Color.fromHex('#2677CB').transparent(0.18),
    hc: Color.white.transparent(0.12),
  },
  localize(
    'panelDragAndDropBackground',
    'Drag and drop feedback color for the panel title items. The color should have transparency so that the panel entries can still shine through. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_INPUT_BORDER = registerColor(
  'panelInput.border',
  {
    dark: null,
    light: Color.fromHex('#ddd'),
    hc: null,
  },
  localize('panelInputBorder', 'Input box border for inputs in the panel.'),
);
