import { SlotLocation } from '@opensumi/ide-core-browser';

import { AI_CHAT_CONTAINER_VIEW_ID, AI_MENUBAR_CONTAINER_VIEW_ID } from '../../common';

export const AIChatLayoutConfig = {
  [AI_CHAT_CONTAINER_VIEW_ID]: {
    modules: [AI_CHAT_CONTAINER_VIEW_ID],
  },
};

export const AIMenubarLayoutConfig = {
  [SlotLocation.top]: {
    modules: [AI_MENUBAR_CONTAINER_VIEW_ID],
  },
};

export const AI_MENU_BAR_RIGHT = 'AI_menu_bar_right';
export const AI_MENU_BAR_LEFT = 'AI_menu_bar_left';
