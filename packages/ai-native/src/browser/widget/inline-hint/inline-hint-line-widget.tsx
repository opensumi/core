import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Injectable } from '@opensumi/di';
import { SpecialCases, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { AIInlineHintLineContentWidgetId } from '@opensumi/ide-core-common';
import { localize } from '@opensumi/ide-core-common';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import styles from './inline-hint.module.less';
import { InlineHintService } from './inline-hint.service';


const InlineHintRender = () => {
  const [interactiveInputVisible, setInteractiveInputVisible] = useState<boolean>(false);
  const inlineHintService: InlineHintService = useInjectable(InlineHintService);

  useEffect(() => {
    const dis = inlineHintService.onInteractiveInputVisible((v) => {
      setInteractiveInputVisible(v);
    });

    return dis.dispose.bind(dis);
  }, []);

  const handleInteractiveInputSend = useCallback((value: string) => {}, []);

  const customOperationRender = useMemo(() => {
    if (!interactiveInputVisible) {
      return null;
    }

    return (
      <InteractiveInput
        autoFocus
        // onHeightChange={(height) => onLayoutChange(height)}
        size='small'
        placeholder={localize('aiNative.inline.chat.input.placeholder.default')}
        width={320}
        // disabled={isLoading}
        onSend={handleInteractiveInputSend}
      />
    );
  }, [interactiveInputVisible]);

  if (interactiveInputVisible) {
    return (
      <AIAction
        // loading={isLoading}
        loadingShowOperation={interactiveInputVisible}
        customOperationRender={customOperationRender}
      />
    );
  }

  return (
    <div className={styles.hint_line_widget}>
      <span className={styles.text}>按 {SpecialCases.MACMETA} + i 唤起 Inline Chat</span>
    </div>
  );
};

@Injectable({ multiple: true })
export class InlineHintLineWidget extends ReactInlineContentWidget {
  positionPreference = [ContentWidgetPositionPreference.EXACT];

  public id(): string {
    return AIInlineHintLineContentWidgetId;
  }

  public renderView(): ReactNode {
    return <InlineHintRender />;
  }
}
