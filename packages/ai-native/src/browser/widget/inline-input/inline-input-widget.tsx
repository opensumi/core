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
  onValueChange?: (value: string) => void;
}

const InlineInputWidgetRender = (props: IInlineInputWidgetRenderProps) => {
  const { defaultValue, onClose, onInteractiveInputSend, onLayoutChange, onChatStatus, onResultClick, onValueChange } =
    props;
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
          onValueChange={onValueChange}
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
export class InlineInputWidget extends AIInlineContentWidget {
  allowEditorOverflow = true;
  positionPreference = [ContentWidgetPositionPreference.ABOVE];

  protected readonly _onSend = new Emitter<string>();
  public readonly onSend = this._onSend.event;

  protected readonly _onClose = new Emitter<void>();
  public readonly onClose = this._onClose.event;

  protected readonly _onValueChange = new Emitter<string>();
  public readonly onValueChange = this._onValueChange.event;

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
          onClose={() => this._onClose.fire()}
          onChatStatus={this.onStatusChange.bind(this)}
          onLayoutChange={() => {
            this.editor.layoutContentWidget(this);
          }}
          onValueChange={(value) => {
            this._onValueChange.fire(value);
          }}
          onInteractiveInputSend={(value) => {
            this.launchChatStatus(EInlineChatStatus.THINKING);
            this._onSend.fire(value);
          }}
          onResultClick={(k: EResultKind) => {
            this._onResultClick.fire(k);
          }}
        />
      </div>
    );
  }
}
