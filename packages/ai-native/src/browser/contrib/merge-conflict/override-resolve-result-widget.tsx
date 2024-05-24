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
  IAcceptConflictActionsEvent,
  IGNORE_ACTIONS,
  REVOKE_ACTIONS,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/types';
import { ResultCodeEditor } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/view/editors/resultCodeEditor';
import {
  ResolveResultWidget,
  WapperAIInlineResult,
} from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/widget/resolve-result-widget';

import { InlineDiffWidget } from '../../widget/inline-diff/inline-diff-widget';

@Injectable({ multiple: true })
export class DiffResolveResultWidget extends ResolveResultWidget {
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
          const modifiedValue = this.inlineDiffWidget?.getModifiedModel()?.getValue();
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: ACCEPT_CURRENT_ACTIONS,
            reason: ECompleteReason.UserManual,
            value: modifiedValue,
          } as IAcceptConflictActionsEvent);
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

  private inlineDiffWidget: InlineDiffWidget | undefined;

  override hide(): void {
    super.hide();
    this.codeEditor.editor.setHiddenAreas([], this.uid);
    this.inlineDiffWidget?.dispose();
    this.inlineDiffWidget = undefined;
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

    // 渲染在下一行空行上，但是通过 css 下移 1/2 行
    const halfLineHeight = this.getLineHeight() / 2;

    const resultWidget = (
      <ContentWidgetContainerPanel
        style={{ transform: `translateY(${halfLineHeight}px)`, left: 2, display: 'flex', position: 'absolute' }}
      >
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

    if (this.inlineDiffWidget) {
      this.inlineDiffWidget.dispose();
    }

    const { range } = this;

    // hidden full conflict area, but only show diff for current and the ai response
    this.inlineDiffWidget = this.injector.get(InlineDiffWidget, [
      this.uid,
      {
        editor: this.codeEditor.editor,
        selection: range,
        hiddenArea: this.lineRange.toInclusiveRange(),
      },
    ]);
    this.inlineDiffWidget.setResolveResultWidget(resultWidget);
    this.inlineDiffWidget.create();

    this.addDispose(
      this.inlineDiffWidget.onReady(() => {
        const modifiedModel = this.inlineDiffWidget!.getModifiedModel();
        if (modifiedModel) {
          modifiedModel.setValue(this.text);
        }
      }),
    );

    this.inlineDiffWidget.show(range, range.endLineNumber - range.startLineNumber + 1);
    return null;
  }
  public id(): string {
    return `${AIResolveConflictContentWidget}_${this.uid}`;
  }
}
