import React, { ReactNode, useCallback, useMemo } from 'react';

import { Injectable } from '@opensumi/di';
import { Button, MessageType, PopoverTriggerType } from '@opensumi/ide-components';
import { DialogContent, Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { AIInlineResult } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { IAiInlineResultIconItemsProps } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import { localize, uuid } from '@opensumi/ide-core-common';

import { BaseInlineContentWidget } from '../../../ai-native/BaseInlineContentWidget';
import { LineRange } from '../model/line-range';
import { AI_RESOLVE_REGENERATE_ACTIONS, AiResolveConflictContentWidget, REVOKE_ACTIONS } from '../types';
import { ResultCodeEditor } from '../view/editors/resultCodeEditor';

interface IWrapperAiInlineResultProps {
  iconItems: IAiInlineResultIconItemsProps[];
  isRenderThumbs: boolean;
  codeEditor: ResultCodeEditor;
  range: LineRange;
  closeClick?: () => void;
  isRenderClose?: boolean;
  disablePopover?: boolean;
}

export const WapperAiInlineResult = (props: IWrapperAiInlineResultProps) => {
  const { iconItems, isRenderThumbs, codeEditor, range, closeClick, isRenderClose, disablePopover = false } = props;
  const [isVisiablePopover, setIsVisiablePopover] = React.useState(false);
  const uid = useMemo(() => uuid(4), []);

  const onCancel = useCallback(
    (event) => {
      setIsVisiablePopover(false);
      event.stopPropagation();
      event.preventDefault();
    },
    [isVisiablePopover],
  );

  const onOk = useCallback(
    (event) => {
      onCancel(event);
      execGenerate();
      event.stopPropagation();
      event.preventDefault();
    },
    [isVisiablePopover],
  );

  const execGenerate = useCallback(() => {
    codeEditor.launchConflictActionsEvent({
      range,
      action: AI_RESOLVE_REGENERATE_ACTIONS,
    });
    codeEditor.hideResolveResultWidget();
  }, [range, codeEditor]);

  const popoverContent = useMemo(
    () => (
      <div style={{ padding: '8px 12px' }}>
        <DialogContent
          type='confirm'
          buttons={[
            <Button size='small' onClick={onCancel} type='secondary'>
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
      <Popover
        trigger={PopoverTriggerType.program}
        display={isVisiablePopover}
        id={uid}
        content={popoverContent}
        position={PopoverPosition.bottom}
      >
        {localize('aiNative.operate.afresh.title')}
      </Popover>
    ),
    [isVisiablePopover],
  );

  const handleRenerate = useCallback(() => {
    const intelligentStateModel = range.getIntelligentStateModel();
    const preAnswerCode = intelligentStateModel.answerCode;
    const currentCode = codeEditor.getModel()?.getValueInRange(range.toRange()) || '';

    // 如果内容有变化，说明用户有修改，需要弹出确认框
    if (preAnswerCode.trim() === currentCode.trim()) {
      execGenerate();
    } else {
      if (disablePopover) {
        return;
      }
      setIsVisiablePopover(true);
    }
  }, [range, codeEditor, isVisiablePopover, disablePopover]);

  const iconResultItems: IAiInlineResultIconItemsProps[] = useMemo(
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
        icon: 'discard',
        text: localize('aiNative.operate.discard.title'),
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: REVOKE_ACTIONS,
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
        <WapperAiInlineResult
          iconItems={iconResultItems}
          isRenderThumbs={isRenderThumbs}
          codeEditor={this.codeEditor}
          range={this.lineRange}
        />
      </ContentWidgetContainerPanel>
    );
  }

  public id(): string {
    return `${AiResolveConflictContentWidget}_${this.uid}`;
  }
}
