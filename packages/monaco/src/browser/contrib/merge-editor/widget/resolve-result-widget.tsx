import React from 'react';
import { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import {
  AiInlineResult,
  IAiInlineResultIconItemsProps,
} from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import { uuid } from '@opensumi/ide-core-common';

import { BaseInlineContentWidget } from '../../../ai-native/content-widget';
import { ContentWidgetContainerPanel } from '../../../ai-native/content-widget/containerPanel';
import { LineRange } from '../model/line-range';
import { AiResolveConflictContentWidget, REVOKE_ACTIONS } from '../types';
import { ResultCodeEditor } from '../view/editors/resultCodeEditor';

@Injectable({ multiple: true })
export class ResolveResultWidget extends BaseInlineContentWidget {
  protected uid: string = uuid(4);

  constructor(private readonly codeEditor: ResultCodeEditor, private readonly lineRange: LineRange) {
    super(codeEditor.editor);
  }

  protected isRenderThumbs(): boolean {
    return true;
  }

  protected iconItems(): IAiInlineResultIconItemsProps[] {
    return [
      {
        icon: 'diuqi',
        text: '丢弃',
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: REVOKE_ACTIONS,
          });
          this.codeEditor.hideResolveResultWidget();
        },
      },
      {
        icon: 'zhongxin',
        text: '重新生成',
        onClick: () => {},
      },
    ];
  }

  public renderView(): ReactNode {
    const iconResultItems = this.iconItems();
    const isRenderThumbs = this.isRenderThumbs();

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(-15px)' }}>
        <AiInlineResult iconItems={iconResultItems} isRenderThumbs={isRenderThumbs} />
      </ContentWidgetContainerPanel>
    );
  }
  public id(): string {
    return `${AiResolveConflictContentWidget}_${this.uid}`;
  }
}
