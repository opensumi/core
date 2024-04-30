import React, { ReactNode } from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { IAIInlineResultIconItemsProps } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import { localize } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { LineRange } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/model/line-range';
import {
  ACCEPT_CURRENT_ACTIONS,
  AIResolveConflictContentWidget,
  ECompleteReason,
  IGNORE_ACTIONS,
  REVOKE_ACTIONS,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/types';
import { ResultCodeEditor } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/editors/resultCodeEditor';
import {
  ResolveResultWidget,
  WapperAIInlineResult,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/widget/resolve-result-widget';

import { InlineDiffWidget } from '../widget/inline-diff/inline-diff-widget';

@Injectable({ multiple: true })
export class OverrideResolveResultWidget extends ResolveResultWidget {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  constructor(
    protected uid: string,
    protected readonly codeEditor: ResultCodeEditor,
    protected readonly lineRange: LineRange,
    protected readonly range: monaco.IRange,
    protected readonly text: string,
  ) {
    super(uid, codeEditor, lineRange);
  }

  protected isRenderThumbs(): boolean {
    return true;
  }

  protected iconItems(): IAIInlineResultIconItemsProps[] {
    return [
      {
        icon: 'check',
        text: localize('aiNative.inline.chat.operate.check.title'),
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: ACCEPT_CURRENT_ACTIONS,
            reason: ECompleteReason.UserManual,
          });
        },
      },
      {
        icon: 'discard',
        text: localize('aiNative.operate.discard.title'),
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: REVOKE_ACTIONS,
            reason: ECompleteReason.UserManual,
          });
        },
      },
    ];
  }

  private inlineDiffWidget: InlineDiffWidget;

  private visibleDiffWidget(monacoEditor: monaco.ICodeEditor, range: monaco.IRange, answer: string): void {
    if (this.inlineDiffWidget) {
      this.inlineDiffWidget.dispose();
    }

    monacoEditor.setHiddenAreas([range], InlineDiffWidget._hideId);
    this.inlineDiffWidget = this.injector.get(InlineDiffWidget, [monacoEditor, range, answer]);
    this.inlineDiffWidget.create();
    this.inlineDiffWidget.showByLine(range.startLineNumber + 2, range.endLineNumber - range.startLineNumber + 2);
  }

  override hide(): void {
    super.hide();
    this.inlineDiffWidget?.dispose();
  }

  public override renderView(): ReactNode {
    const iconResultItems = this.iconItems();
    const isRenderThumbs = this.isRenderThumbs();

    const handleCloseClick = () => {
      this.codeEditor.launchConflictActionsEvent({
        range: this.lineRange,
        action: IGNORE_ACTIONS,
        reason: ECompleteReason.UserManual,
      });
    };

    this.visibleDiffWidget(this.codeEditor.editor, this.range, this.text);

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
        <WapperAIInlineResult
          id={this.uid}
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
    return `${AIResolveConflictContentWidget}_${this.uid}`;
  }
}
