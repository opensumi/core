import React, { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { SpecialCases } from '@opensumi/ide-core-browser';
import { AIInlineHintLineContentWidgetId, isMacintosh } from '@opensumi/ide-core-common';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import styles from './inline-hint.module.less';

@Injectable({ multiple: true })
export class InlineHintLineWidget extends ReactInlineContentWidget {
  positionPreference = [ContentWidgetPositionPreference.EXACT];

  override id(): string {
    return AIInlineHintLineContentWidgetId;
  }

  override renderView(): ReactNode {
    return (
      <div className={styles.hint_line_widget}>
        <span className={styles.text}>{`按 ${
          isMacintosh ? SpecialCases.MACMETA : SpecialCases.CTRL
        } + i 唤起 Inline Chat`}</span>
      </div>
    );
  }
}
