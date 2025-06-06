import { Color, RGBA } from '../color';
import { registerColor, transparent } from '../utils';

import { badgeBackground, badgeForeground } from './badge';
import { contrastBorder, foreground } from './base';
import { editorBackground, editorWidgetBackground } from './editor';

export const chatRequestBorder = registerColor(
  'chat.requestBorder',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.1)),
    light: new Color(new RGBA(0, 0, 0, 0.1)),
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  'The border color of a chat request.',
);

export const chatRequestBackground = registerColor(
  'chat.requestBackground',
  {
    dark: transparent(editorBackground, 0.62),
    light: transparent(editorBackground, 0.62),
    hcDark: editorWidgetBackground,
    hcLight: null,
  },
  'The background color of a chat request.',
);

export const chatSlashCommandBackground = registerColor(
  'chat.slashCommandBackground',
  { dark: '#34414b8f', light: '#d2ecff99', hcDark: Color.white, hcLight: badgeBackground },
  'The background color of a chat slash command.',
);

export const chatSlashCommandForeground = registerColor(
  'chat.slashCommandForeground',
  { dark: '#40A6FF', light: '#306CA2', hcDark: Color.black, hcLight: badgeForeground },
  'The foreground color of a chat slash command.',
);

export const chatAvatarBackground = registerColor(
  'chat.avatarBackground',
  { dark: '#1f1f1f', light: '#f2f2f2', hcDark: Color.black, hcLight: Color.white },
  'The background color of a chat avatar.',
);

export const chatAvatarForeground = registerColor(
  'chat.avatarForeground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  'The foreground color of a chat avatar.',
);

export const chatEditedFileForeground = registerColor(
  'chat.editedFileForeground',
  {
    light: '#895503',
    dark: '#E2C08D',
    hcDark: '#E2C08D',
    hcLight: '#895503',
  },
  'The foreground color of a chat edited file in the edited file list.',
);
