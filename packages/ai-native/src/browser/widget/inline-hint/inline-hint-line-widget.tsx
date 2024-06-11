import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { SpecialCases, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { AIInlineHintLineContentWidgetId, isMacintosh, localize } from '@opensumi/ide-core-common';
import { IContentWidgetPosition, Position, Selection } from '@opensumi/ide-monaco';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import { AIInlineContentWidget } from '../inline-chat/inline-content-widget';

import styles from './inline-hint.module.less';
import { InlineHintService } from './inline-hint.service';

interface IInlineHintRenderProps {
  layoutWidget: () => void;
  onInteractiveInputSend: (value: string) => void;
}

const InlineHintRender = ({ layoutWidget, onInteractiveInputSend }: IInlineHintRenderProps) => {
  const [interactiveInputVisible, setInteractiveInputVisible] = useState<boolean>(false);
  const inlineHintService: InlineHintService = useInjectable(InlineHintService);

  useEffect(() => {
    const dis = inlineHintService.onInteractiveInputVisible((v) => {
      setInteractiveInputVisible(v);
    });

    return dis.dispose.bind(dis);
  }, []);

  useEffect(() => {
    if (interactiveInputVisible && layoutWidget) {
      layoutWidget();
    }
  }, [interactiveInputVisible, layoutWidget]);

  const handleLayoutWidget = useCallback(() => {
    layoutWidget();
  }, [layoutWidget]);

  const handleInteractiveInputSend = useCallback(
    (value: string) => {
      onInteractiveInputSend(value);
    },
    [onInteractiveInputSend],
  );

  const customOperationRender = useMemo(() => {
    if (!interactiveInputVisible) {
      return null;
    }

    return (
      <InteractiveInput
        autoFocus
        size='small'
        placeholder={localize('aiNative.inline.chat.input.placeholder.default')}
        width={320}
        onHeightChange={handleLayoutWidget}
        onSend={handleInteractiveInputSend}
      />
    );
  }, [interactiveInputVisible]);

  const hintText = useMemo(
    () => `按 ${isMacintosh ? SpecialCases.MACMETA : SpecialCases.CTRL} + i 唤起 Inline Chat`,
    [],
  );

  return interactiveInputVisible ? (
    <AIAction loadingShowOperation customOperationRender={customOperationRender} />
  ) : (
    <div className={styles.hint_line_widget}>
      <span className={styles.text}>{hintText}</span>
    </div>
  );
};

@Injectable({ multiple: true })
export class InlineHintLineWidget extends AIInlineContentWidget {
  @Autowired(InlineHintService)
  private inlineHintService: InlineHintService;

  positionPreference = [ContentWidgetPositionPreference.ABOVE];

  override dispose(): void {
    super.dispose();
    this.inlineHintService.changVisible(false);
  }

  override id(): string {
    return AIInlineHintLineContentWidgetId;
  }

  override renderView(): ReactNode {
    return (
      <InlineHintRender
        layoutWidget={this.layoutContentWidget.bind(this)}
        onInteractiveInputSend={(v) => {
          this._onInteractiveInputValue.fire(v);
        }}
      />
    );
  }

  override computePosition(selection: Selection): IContentWidgetPosition | null {
    if (this.inlineHintService.interactiveInputVisible) {
      return super.computePosition(selection);
    }

    return {
      position: new Position(selection.startLineNumber, selection.startColumn),
      preference: this.positionPreference,
    };
  }
}
