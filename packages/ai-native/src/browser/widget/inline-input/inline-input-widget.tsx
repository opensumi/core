import React, { ReactNode } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { AIAction, InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { AIInlineInputChatContentWidgetId, localize } from '@opensumi/ide-core-common';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';

import { InlineInputChatService } from './inline-input.service';

@Injectable({ multiple: true })
export class InlineInputChatWidget extends AIInlineContentWidget {
  @Autowired(InlineInputChatService)
  private inlineInputChatService: InlineInputChatService;

  positionPreference = [ContentWidgetPositionPreference.ABOVE];

  override dispose(): void {
    super.dispose();
    this.inlineInputChatService.hide();
  }

  override id(): string {
    return AIInlineInputChatContentWidgetId;
  }

  private handleLayoutWidget(): void {
    this.layoutContentWidget();
  }

  private handleInteractiveInputSend(value: string): void {
    this._onInteractiveInputValue.fire(value);
  }

  override renderView(): ReactNode {
    return (
      <AIAction
        loadingShowOperation
        customOperationRender={
          <InteractiveInput
            autoFocus
            size='small'
            placeholder={localize('aiNative.inline.chat.input.placeholder.default')}
            width={320}
            onHeightChange={this.handleLayoutWidget.bind(this)}
            onSend={(value) => {
              this.handleInteractiveInputSend(value);
            }}
          />
        }
      />
    );
  }
}
