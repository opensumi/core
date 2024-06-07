import React, { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { AIInlineHintLineContentWidgetId } from '@opensumi/ide-core-common';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import styles from './inline-chat.module.less';

@Injectable({ multiple: true })
export class InlineHintLineWidget extends ReactInlineContentWidget {
  positionPreference = [ContentWidgetPositionPreference.EXACT];

  public id(): string {
    return AIInlineHintLineContentWidgetId;
  }

  public renderView(): ReactNode {
    return (
      <div className={styles.hint_line_widget}>
        <span className={styles.text}>按 cmd + i 唤起 inline chat</span>
      </div>
    );
  }
}
