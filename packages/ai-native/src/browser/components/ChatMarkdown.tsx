import cls from 'classnames';
import { MarkdownItAsync } from 'markdown-it-async';
import React, { useEffect, useRef, useState } from 'react';

import { IMarkedOptions, marked } from '@opensumi/ide-components/lib/utils';
import { useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';
import { IMarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import styles from './components.module.less';
import { createMarkdownRenderer } from './markdownit-renderer';

interface MarkdownProps {
  markdown: IMarkdownString | string;
  agentId?: string;
  command?: string;
  relationId?: string;
  className?: string;
  fillInIncompleteTokens?: boolean; // 补齐不完整的 token，如代码块或表格
  markedOptions?: IMarkedOptions;
  hideInsert?: boolean;
}

export const ChatMarkdown = (props: MarkdownProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const workbenchThemeService = useInjectable<WorkbenchThemeService>(IThemeService);
  const [renderer, setRenderer] = useState<MarkdownItAsync | null>(null);
  const [html, setHtml] = useState('');

  useEffect(() => {
    const theme = workbenchThemeService.getCurrentThemeSync();
    createMarkdownRenderer(theme).then((renderer) => setRenderer(renderer));
  }, []);

  useEffect(() => {
    if (props.markdown && renderer) {
      const mdString = typeof props.markdown === 'string' ? props.markdown : props.markdown.value;
      renderer?.renderAsync(mdString).then((h) => {
        setHtml(h);
      });
    }
  }, [props.markdown, renderer]);

  return (
    <div
      className={cls(styles.markdown_container, props.className)}
      ref={ref}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
