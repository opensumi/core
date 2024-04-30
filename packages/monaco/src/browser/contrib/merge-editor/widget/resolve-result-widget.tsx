import React, { ReactNode, useCallback, useMemo } from 'react';

import { Injectable } from '@opensumi/di';
import { Button, MessageType } from '@opensumi/ide-components';
import { DialogContent, Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { AIInlineResult } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { IAIInlineResultIconItemsProps } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import { localize, uuid } from '@opensumi/ide-core-common';

import { ReactInlineContentWidget } from '../../../ai-native/BaseInlineContentWidget';
import { LineRange } from '../model/line-range';
import {
  AIResolveConflictContentWidget,
  AI_RESOLVE_REGENERATE_ACTIONS,
  ECompleteReason,
  REVOKE_ACTIONS,
} from '../types';

import { IMergeEditorShape } from './types';

interface IWrapperAIInlineResultProps {
  id: string;
  iconItems: IAIInlineResultIconItemsProps[];
  isRenderThumbs: boolean;
  codeEditor: IMergeEditorShape;
  range: LineRange;
  closeClick?: () => void;
  isRenderClose?: boolean;
  /**
   * 不展示 popover 确认框，用户点击后直接执行 re-generate
   */
  disablePopover?: boolean;
}

export const WapperAIInlineResult = (props: IWrapperAIInlineResultProps) => {
  const { iconItems, isRenderThumbs, codeEditor, range, id, disablePopover = false } = props;
  const [isVisiablePopover, setIsVisiablePopover] = React.useState(false);
  const uid = useMemo(() => uuid(4), []);

  const hidePopover = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();

      setIsVisiablePopover(false);
    },
    [isVisiablePopover],
  );

  const onOk = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();

      hidePopover(event);
      execGenerate();
    },
    [isVisiablePopover],
  );

  const execGenerate = useCallback(() => {
    codeEditor.launchConflictActionsEvent({
      range,
      action: AI_RESOLVE_REGENERATE_ACTIONS,
      reason: ECompleteReason.UserManual,
    });
    codeEditor.hideResolveResultWidget(id);
  }, [range, codeEditor, id]);

  const popoverContent = useMemo(
    () => (
      <div style={{ padding: '8px 12px' }}>
        <DialogContent
          type='confirm'
          buttons={[
            <Button size='small' onClick={hidePopover} type='secondary'>
              {localize('ButtonCancel')}
            </Button>,
            <Button size='small' onClick={onOk}>
              {localize('ButtonOK')}
            </Button>,
          ]}
          icon={{
            color: 'var(--notificationsWarningIcon-foreground)',
            className: 'question-circle',
          }}
          title={localize('aiNative.resolve.conflict.dialog.afresh')}
          message={localize('aiNative.resolve.conflict.dialog.detection')}
          visible={true}
          messageType={MessageType.Warning}
        />
      </div>
    ),
    [isVisiablePopover],
  );

  const renderGenerate = useCallback(
    () => (
      <Popover visible={isVisiablePopover} id={uid} content={popoverContent} position={PopoverPosition.bottom}>
        <span>{localize('aiNative.operate.afresh.title')}</span>
      </Popover>
    ),
    [isVisiablePopover],
  );

  const handleRenerate = useCallback(() => {
    const intelligentStateModel = range.getIntelligentStateModel();
    const preAnswerCode = intelligentStateModel.answerCode;
    const currentCode = codeEditor.editor.getModel()?.getValueInRange(range.toRange()) || '';

    // 如果内容有变化，说明用户有修改，需要弹出确认框
    if (preAnswerCode.trim() === currentCode.trim()) {
      execGenerate();
    } else {
      if (disablePopover) {
        execGenerate();
        return;
      }
      setIsVisiablePopover(true);
    }
  }, [range, codeEditor, isVisiablePopover, disablePopover]);

  const iconResultItems: IAIInlineResultIconItemsProps[] = useMemo(
    () =>
      iconItems.concat([
        {
          icon: 'afresh',
          text: renderGenerate(),
          onClick: handleRenerate,
        },
      ]),
    [iconItems, isVisiablePopover],
  );

  return <AIInlineResult iconItems={iconResultItems} isRenderThumbs={isRenderThumbs} />;
};

@Injectable({ multiple: true })
export class ResolveResultWidget extends ReactInlineContentWidget {
  constructor(
    protected uid: string,
    protected readonly codeEditor: IMergeEditorShape,
    protected readonly lineRange: LineRange,
  ) {
    super(codeEditor.editor);
  }

  protected isRenderThumbs(): boolean {
    return true;
  }

  protected iconItems(): IAIInlineResultIconItemsProps[] {
    return [
      {
        icon: 'discard',
        text: localize('aiNative.operate.discard.title'),
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: REVOKE_ACTIONS,
            reason: ECompleteReason.UserManual,
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
        <WapperAIInlineResult
          id={this.uid}
          iconItems={iconResultItems}
          isRenderThumbs={isRenderThumbs}
          codeEditor={this.codeEditor}
          range={this.lineRange}
        />
      </ContentWidgetContainerPanel>
    );
  }

  public id(): string {
    return `${AIResolveConflictContentWidget}_${this.uid}`;
  }
}
