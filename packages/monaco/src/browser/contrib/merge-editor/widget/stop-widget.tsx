import React, { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import {
  AiInlineResult,
  IAiInlineResultIconItemsProps,
} from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';

import { ContentWidgetContainerPanel } from '../../../ai-native/content-widget/containerPanel';

import { ResolveResultWidget } from './resolve-result-widget';

@Injectable({ multiple: true })
export class StopWidget extends ResolveResultWidget {
  override isRenderThumbs(): boolean {
    return false;
  }

  override iconItems(): IAiInlineResultIconItemsProps[] {
    return [
      {
        icon: 'circle-pause',
        text: '停止',
        onClick: () => {
          this.codeEditor.cancelRequestToken(this.lineRange.id);
          this.codeEditor.hideStopWidget(this.lineRange.id);
        },
      },
    ];
  }

  override id(): string {
    return `${super.id()}_stop_${this.uid}`;
  }

  override renderView(): ReactNode {
    const iconResultItems = this.iconItems();
    const isRenderThumbs = this.isRenderThumbs();

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
        <AiInlineResult iconItems={iconResultItems} isRenderThumbs={isRenderThumbs} />
      </ContentWidgetContainerPanel>
    );
  }
}
