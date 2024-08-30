import React, { useMemo } from 'react';

import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import {
  AIInlineResult,
  IAIInlineResultIconItemsProps,
} from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { localize } from '@opensumi/ide-core-common';

import { EResultKind } from '../../inline-chat/inline-chat.service';

export interface IInlineResultActionProps {
  onResultClick: (k: EResultKind) => void;
}

export const InlineResultAction = ({ onResultClick }: IInlineResultActionProps) => {
  const iconResultItems = useMemo(
    () =>
      [
        {
          icon: 'check',
          text: localize('aiNative.inline.chat.operate.check.title'),
          btnType: 'default',
          onClick: () => onResultClick(EResultKind.ACCEPT),
        },
        {
          icon: 'discard',
          text: localize('aiNative.operate.discard.title'),
          onClick: () => onResultClick(EResultKind.DISCARD),
        },
        {
          icon: 'afresh',
          text: localize('aiNative.operate.afresh.title'),
          onClick: () => onResultClick(EResultKind.REGENERATE),
        },
      ] as IAIInlineResultIconItemsProps[],
    [onResultClick],
  );

  return (
    <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
      <AIInlineResult iconItems={iconResultItems} />
    </ContentWidgetContainerPanel>
  );
};
