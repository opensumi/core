import React from 'react';
import { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { IAiInlineResultIconItemsProps } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import { uuid } from '@opensumi/ide-core-common';
import { ContentWidgetContainerPanel } from '@opensumi/ide-monaco/lib/browser/ai-native/content-widget/containerPanel';
import { LineRange } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/model/line-range';
import {
  AiResolveConflictContentWidget,
  REVOKE_ACTIONS,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/types';
import { ResultCodeEditor } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/editors/resultCodeEditor';
import {
  ResolveResultWidget,
  WapperAiInlineResult,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/widget/resolve-result-widget';

@Injectable({ multiple: true })
export class OverrideResolveResultWidget extends ResolveResultWidget {
  protected uid: string = uuid(4);

  constructor(protected readonly codeEditor: ResultCodeEditor, protected readonly lineRange: LineRange) {
    super(codeEditor, lineRange);
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
          // this.codeEditor.hideResolveResultWidget();
        },
      },
    ];
  }

  public renderView(): ReactNode {
    const iconResultItems = this.iconItems();
    const isRenderThumbs = this.isRenderThumbs();

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
        <WapperAiInlineResult
          iconItems={iconResultItems}
          isRenderThumbs={isRenderThumbs}
          codeEditor={this.codeEditor}
          range={this.lineRange}
          closeClick={() => this.codeEditor.hideResolveResultWidget(this.lineRange.id)}
          isRenderClose={true}
        />
      </ContentWidgetContainerPanel>
    );
  }
  public id(): string {
    return `${AiResolveConflictContentWidget}_${this.uid}`;
  }
}
