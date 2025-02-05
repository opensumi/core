import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { Injectable } from '@opensumi/di';
import { AINativeConfigService, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { AIInlineInputChatContentWidgetId, Disposable, Emitter, Event, localize } from '@opensumi/ide-core-common';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import { InlineResultAction } from '../inline-actions/result-items/index';
import { EInlineChatStatus, EResultKind } from '../inline-chat/inline-chat.service';
import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';

import styles from './inline-input.module.less';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco';

interface IInlineInputWidgetRenderProps {
  defaultValue?: string;
  onLayoutChange: (height: number) => void;
  onClose?: () => void;
  onInteractiveInputSend?: (value: string) => void;
  onChatStatus: Event<EInlineChatStatus>;
  onResultClick: (k: EResultKind) => void;
}

const InlineInputWidgetRender = (props: IInlineInputWidgetRenderProps) => {
  const { defaultValue, onClose, onInteractiveInputSend, onLayoutChange, onChatStatus, onResultClick } = props;
  const [status, setStatus] = useState<EInlineChatStatus>(EInlineChatStatus.READY);
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);

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
          defaultValue={defaultValue}
          onHeightChange={(height) => onLayoutChange(height)}
          size='small'
          placeholder={localize('aiNative.inline.chat.input.placeholder.default')}
          width={aiNativeConfigService.inlineChat.inputWidth}
          disabled={isLoading}
          onSend={handleInteractiveInputSend}
        />
      }
    />
  );
};

@Injectable({ multiple: true })
export class InlineInputChatWidget extends AIInlineContentWidget {
  allowEditorOverflow = true;
  positionPreference = [ContentWidgetPositionPreference.ABOVE];

  protected readonly _onInteractiveInputValue = new Emitter<string>();
  public readonly onInteractiveInputValue = this._onInteractiveInputValue.event;

  constructor(protected readonly editor: IMonacoCodeEditor, protected readonly defaultValue?: string) {
    super(editor);
  }

  override dispose(): void {
    super.dispose();
    this.inlineInputService.hide();
  }

  override id(): string {
    return AIInlineInputChatContentWidgetId;
  }

  override renderView(): ReactNode {
    return (
      <div className={styles.input_wrapper}>
        <InlineInputWidgetRender
          defaultValue={this.defaultValue}
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
