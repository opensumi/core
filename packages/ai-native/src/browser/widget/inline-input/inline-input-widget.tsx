import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { AIAction, InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { AIInlineInputChatContentWidgetId, Disposable, Event, localize } from '@opensumi/ide-core-common';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import { InlineResultAction } from '../inline-actions/result-items/index';
import { EInlineChatStatus, EResultKind } from '../inline-chat/inline-chat.service';
import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';

import styles from './inline-input.module.less';
import { InlineInputChatService } from './inline-input.service';

interface IInlineInputWidgetRenderProps {
  onLayoutChange: (height: number) => void;
  onClose?: () => void;
  onInteractiveInputSend?: (value: string) => void;
  onChatStatus: Event<EInlineChatStatus>;
  onResultClick: (k: EResultKind) => void;
}

const InlineInputWidgetRender = (props: IInlineInputWidgetRenderProps) => {
  const { onClose, onInteractiveInputSend, onLayoutChange, onChatStatus, onResultClick } = props;
  const [status, setStatus] = useState<EInlineChatStatus>(EInlineChatStatus.READY);
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    const dis = new Disposable();
    dis.addDispose(onChatStatus((s) => setStatus(s)));

    return () => {
      dis.dispose();
    };
  }, [onChatStatus]);

  const isLoading = useMemo(() => status === EInlineChatStatus.THINKING, [status]);
  const isDone = useMemo(() => status === EInlineChatStatus.DONE, [status]);
  const isError = useMemo(() => status === EInlineChatStatus.ERROR, [status]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleInteractiveInputSend = useCallback(
    (value: string) => {
      onInteractiveInputSend?.(value);
    },
    [onInteractiveInputSend],
  );

  const handleValueChange = useCallback((value) => {
    setInputValue(value);
  }, []);

  if (isError) {
    return null;
  }

  if (isDone) {
    return <InlineResultAction onResultClick={onResultClick} />;
  }

  return (
    <AIAction
      loadingShowOperation
      onClose={handleClose}
      loading={isLoading}
      customOperationRender={
        <InteractiveInput
          autoFocus
          onHeightChange={(height) => onLayoutChange(height)}
          size='small'
          placeholder={localize('aiNative.inline.chat.input.placeholder.default')}
          width={320}
          value={inputValue}
          onValueChange={handleValueChange}
          disabled={isLoading}
          onSend={handleInteractiveInputSend}
        />
      }
    />
  );
};

@Injectable({ multiple: true })
export class InlineInputChatWidget extends AIInlineContentWidget {
  @Autowired(InlineInputChatService)
  private inlineInputChatService: InlineInputChatService;

  allowEditorOverflow = true;
  positionPreference = [ContentWidgetPositionPreference.ABOVE];

  override dispose(): void {
    super.dispose();
    this.inlineInputChatService.hide();
  }

  override id(): string {
    return AIInlineInputChatContentWidgetId;
  }

  override renderView(): ReactNode {
    return (
      <div className={styles.input_wrapper}>
        <InlineInputWidgetRender
          onClose={() => this.dispose()}
          onChatStatus={this.onStatusChange.bind(this)}
          onLayoutChange={() => {
            this.editor.layoutContentWidget(this);
          }}
          onInteractiveInputSend={(value) => {
            this.launchChatStatus(EInlineChatStatus.THINKING);
            this._onInteractiveInputValue.fire(value);
          }}
          onResultClick={(k: EResultKind) => {
            this._onResultClick.fire(k);
          }}
        />
      </div>
    );
  }
}
