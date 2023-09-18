import { SlotLocation } from '@opensumi/ide-core-browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { AiMenuBarContribution } from './menu-bar/menu-bar.contribution';
import { AiChatContribution } from '../../ai-chat.contribution';

export const AiLayoutConfig = {
  ...defaultConfig,
  ...{
    [SlotLocation.top]: {
      modules: [AiMenuBarContribution.AiMenuBarContainer],
    },
  },
  ...{
    [AiChatContribution.AiChatContainer]: {
      modules: [AiChatContribution.AiChatContainer],
    },
  },
}