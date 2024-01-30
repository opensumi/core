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
import { AI_RESOLVE_REGENERATE_ACTIONS, AiResolveConflictContentWidget, REVOKE_ACTIONS } from '../types';
import { ResultCodeEditor } from '../view/editors/resultCodeEditor';

@Injectable({ multiple: true })
export class ResolveResultWidget extends BaseInlineContentWidget {
  protected uid: string = uuid(4);

  constructor(protected readonly codeEditor: ResultCodeEditor, protected readonly lineRange: LineRange) {
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
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: AI_RESOLVE_REGENERATE_ACTIONS,
          });
          this.codeEditor.hideResolveResultWidget();
        },
      },
    ];
  }

  public renderView(): ReactNode {
    const iconResultItems = this.iconItems();
    const isRenderThumbs = this.isRenderThumbs();

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
        <AiInlineResult iconItems={iconResultItems} isRenderThumbs={isRenderThumbs} />
      </ContentWidgetContainerPanel>
    );
  }
  public id(): string {
    return `${AiResolveConflictContentWidget}_${this.uid}`;
  }
}
