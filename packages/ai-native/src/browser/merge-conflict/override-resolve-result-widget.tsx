import React, { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { IAiInlineResultIconItemsProps } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import { localize, uuid } from '@opensumi/ide-core-common';
import { LineRange } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/model/line-range';
import {
  AiResolveConflictContentWidget,
  IGNORE_ACTIONS,
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
        icon: 'discard',
        text: localize('aiNative.operate.discard.title'),
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: REVOKE_ACTIONS,
          });
        },
      },
    ];
  }

  public renderView(): ReactNode {
    const iconResultItems = this.iconItems();
    const isRenderThumbs = this.isRenderThumbs();

    const handleCloseClick = () => {
      this.codeEditor.launchConflictActionsEvent({
        range: this.lineRange,
        action: IGNORE_ACTIONS,
      });
    };

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
        <WapperAiInlineResult
          iconItems={iconResultItems}
          isRenderThumbs={isRenderThumbs}
          codeEditor={this.codeEditor}
          range={this.lineRange}
          closeClick={handleCloseClick}
          isRenderClose={true}
          disablePopover={true}
        />
      </ContentWidgetContainerPanel>
    );
  }
  public id(): string {
    return `${AiResolveConflictContentWidget}_${this.uid}`;
  }
}
