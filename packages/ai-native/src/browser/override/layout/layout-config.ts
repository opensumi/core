import { SlotLocation } from '@opensumi/ide-core-browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../../common';

import { AiMenuBarContribution } from './menu-bar/menu-bar.contribution';

export const AiLayoutConfig = {
  ...defaultConfig,
  ...{
    [SlotLocation.top]: {
      modules: [AiMenuBarContribution.AiMenuBarContainer],
    },
  },
  ...{
    [Ai_CHAT_CONTAINER_VIEW_ID]: {
      modules: [Ai_CHAT_CONTAINER_VIEW_ID],
    },
  },
};
