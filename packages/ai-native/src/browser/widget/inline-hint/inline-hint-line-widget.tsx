import React, { ReactNode } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry } from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { AIInlineHintLineContentWidgetId, formatLocalize, localize } from '@opensumi/ide-core-common';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';

import styles from './inline-hint.module.less';

@Injectable({ multiple: true })
export class InlineHintLineWidget extends ReactInlineContentWidget {
  positionPreference = [ContentWidgetPositionPreference.EXACT];

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  override id(): string {
    return AIInlineHintLineContentWidgetId;
  }

  private getSequenceKeyString() {
    const keybindings = this.keybindingRegistry.getKeybindingsForCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id);
    const resolved = keybindings[0].resolved;

    return this.keybindingRegistry.acceleratorForSequence(resolved!, '+');
  }

  override renderView(): ReactNode {
    return (
      <div className={styles.hint_line_widget}>
        <span className={styles.text}>
          {formatLocalize('aiNative.inline.hint.widget.placeholder', this.getSequenceKeyString())}
        </span>
      </div>
    );
  }
}
