import { SlotLocation } from '@opensumi/ide-core-browser';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../../common';

import { AiMenuBarContribution } from './menu-bar/menu-bar.contribution';

export const AiTopLayoutConfig = {
  [SlotLocation.top]: {
    modules: [AiMenuBarContribution.AiMenuBarContainer],
  },
};

export const AiChatLayoutConfig = {
  [Ai_CHAT_CONTAINER_VIEW_ID]: {
    modules: [Ai_CHAT_CONTAINER_VIEW_ID],
  },
};

export const AI_MENU_BAR_RIGHT = 'ai_menu_bar_right';
export const AI_MENU_BAR_LEFT = 'ai_menu_bar_left';
