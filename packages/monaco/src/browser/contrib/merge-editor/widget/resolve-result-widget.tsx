import React from 'react';
import { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { BaseInlineContentWidget } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { AiInlineResult } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { LineRange } from '../model/line-range';
import { AiResolveConflictContentWidget, REVOKE_ACTIONS } from '../types';
import { ResultCodeEditor } from '../view/editors/resultCodeEditor';

@Injectable({ multiple: true })
export class ResolveResultWidget extends BaseInlineContentWidget {
  constructor(private readonly codeEditor: ResultCodeEditor, private readonly lineRange: LineRange) {
    super(codeEditor.editor);
  }

  public renderView(): ReactNode {
    const iconResultItems = [
      {
        icon: 'diuqi',
        text: '丢弃',
        onClick: () => {
          this.codeEditor.launchConflictActionsEvent({
            range: this.lineRange,
            action: REVOKE_ACTIONS,
          });
          this.codeEditor.hideResolveResultWidget();
        },
      },
      {
        icon: 'zhongxin',
        text: '重新生成',
        onClick: () => {},
      },
    ];

    return (
      <ContentWidgetContainerPanel style={{ transform: 'translateY(-15px)' }}>
        <AiInlineResult iconItems={iconResultItems} />
      </ContentWidgetContainerPanel>
    );
  }
  public id(): string {
    return AiResolveConflictContentWidget;
  }
}
