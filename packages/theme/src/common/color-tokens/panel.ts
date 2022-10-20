import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { transparent, registerColor } from '../utils';

import { contrastBorder } from './base';
import { editorBackground, editorForeground, EDITOR_DRAG_AND_DROP_BACKGROUND } from './editor';
import { textLinkActiveForeground } from './text';

// < --- Panels --- >
export const PANEL_BACKGROUND = registerColor(
  'panel.background',
  {
    dark: editorBackground,
    light: editorBackground,
    hcDark: editorBackground,
    hcLight: editorBackground,
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
    hcDark: contrastBorder,
    hcLight: contrastBorder,
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
    hcDark: Color.white,
    hcLight: editorForeground,
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
    hcDark: Color.white,
    hcLight: editorForeground,
  },
  localize(
    'panelInactiveTitleForeground',
    'Title color for the inactive panel. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_ACTIVE_TITLE_BORDER = registerColor(
  'panelTitle.activeBorder',
  {
    dark: PANEL_ACTIVE_TITLE_FOREGROUND,
    light: PANEL_ACTIVE_TITLE_FOREGROUND,
    hcDark: contrastBorder,
    hcLight: '#B5200D',
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
    hcDark: Color.white.transparent(0.12),
    hcLight: Color.fromHex('#2677CB').transparent(0.18),
  },
  localize(
    'panelDragAndDropBackground',
    'Drag and drop feedback color for the panel title items. The color should have transparency so that the panel entries can still shine through. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_DRAG_AND_DROP_BORDER = registerColor(
  'panel.dropBorder',
  {
    dark: PANEL_ACTIVE_TITLE_FOREGROUND,
    light: PANEL_ACTIVE_TITLE_FOREGROUND,
    hcDark: PANEL_ACTIVE_TITLE_FOREGROUND,
    hcLight: PANEL_ACTIVE_TITLE_FOREGROUND,
  },
  localize(
    'panelDragAndDropBorder',
    'Drag and drop feedback color for the panel titles. Panels are shown below the editor area and contain views like output and integrated terminal.',
  ),
);

export const PANEL_SECTION_DRAG_AND_DROP_BACKGROUND = registerColor(
  'panelSection.dropBackground',
  {
    dark: EDITOR_DRAG_AND_DROP_BACKGROUND,
    light: EDITOR_DRAG_AND_DROP_BACKGROUND,
    hcDark: EDITOR_DRAG_AND_DROP_BACKGROUND,
    hcLight: EDITOR_DRAG_AND_DROP_BACKGROUND,
  },
  localize(
    'panelSectionDragAndDropBackground',
    'Drag and drop feedback color for the panel sections. The color should have transparency so that the panel sections can still shine through. Panels are shown below the editor area and contain views like output and integrated terminal. Panel sections are views nested within the panels.',
  ),
);

export const PANEL_SECTION_HEADER_BACKGROUND = registerColor(
  'panelSectionHeader.background',
  {
    dark: Color.fromHex('#808080').transparent(0.2),
    light: Color.fromHex('#808080').transparent(0.2),
    hcDark: null,
    hcLight: null,
  },
  localize(
    'panelSectionHeaderBackground',
    'Panel section header background color. Panels are shown below the editor area and contain views like output and integrated terminal. Panel sections are views nested within the panels.',
  ),
);

export const PANEL_SECTION_HEADER_FOREGROUND = registerColor(
  'panelSectionHeader.foreground',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize(
    'panelSectionHeaderForeground',
    'Panel section header foreground color. Panels are shown below the editor area and contain views like output and integrated terminal. Panel sections are views nested within the panels.',
  ),
);

export const PANEL_SECTION_HEADER_BORDER = registerColor(
  'panelSectionHeader.border',
  {
    dark: contrastBorder,
    light: contrastBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'panelSectionHeaderBorder',
    'Panel section header border color used when multiple views are stacked vertically in the panel. Panels are shown below the editor area and contain views like output and integrated terminal. Panel sections are views nested within the panels.',
  ),
);

export const PANEL_SECTION_BORDER = registerColor(
  'panelSection.border',
  {
    dark: PANEL_BORDER,
    light: PANEL_BORDER,
    hcDark: PANEL_BORDER,
    hcLight: PANEL_BORDER,
  },
  localize(
    'panelSectionBorder',
    'Panel section border color used when multiple views are stacked horizontally in the panel. Panels are shown below the editor area and contain views like output and integrated terminal. Panel sections are views nested within the panels.',
  ),
);
