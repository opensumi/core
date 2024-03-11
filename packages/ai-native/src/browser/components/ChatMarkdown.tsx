import React from 'react';

import { DefaultMarkedRenderer, Markdown } from '@opensumi/ide-components/lib/markdown';

import styles from './components.module.less';

const renderSearchLinkBlock = new (class extends DefaultMarkedRenderer {
  link(href: string | null, title: string | null, text: string): string {
    return `<a class="${styles.link_block}" rel="noopener" target="_blank" href="${href}" target="${href}" title="${
      title ?? href
    }">${text}</a>`;
  }
})();

export const ChatMarkdown = ({ content }: { content: string }) => (
  <div className={styles.ai_chat_markdown_container}>
    <Markdown value={content} renderer={renderSearchLinkBlock}></Markdown>
  </div>
);
