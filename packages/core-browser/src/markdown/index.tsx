import React from 'react';

import { DATA_SET_COMMAND, RenderWrapper } from '@opensumi/ide-components/lib/markdown/render';
import { IMarkedOptions, createMarkedRenderer, toMarkdownHtml as toHtml } from '@opensumi/ide-components/lib/utils';
import { isString } from '@opensumi/ide-core-common';

import { IOpenerService } from '../opener';

import type { Tokens } from 'marked';

export const toMarkdown = (
  content: string | React.ReactNode,
  opener?: IOpenerService,
  options?: IMarkedOptions,
  justUseContent?: boolean,
): React.ReactNode => {
  if (justUseContent && content && isString(content)) {
    return <RenderWrapper opener={opener} html={content}></RenderWrapper>;
  }

  return typeof content === 'string' ? (
    <RenderWrapper opener={opener} html={toMarkdownHtml(content, options)}></RenderWrapper>
  ) : (
    content
  );
};

export const toMarkdownHtml = (message: string, options?: IMarkedOptions): string => {
  const renderer = createMarkedRenderer();

  renderer.link = ({ href, title, text }: Tokens.Link): string =>
    `<a rel="noopener" ${DATA_SET_COMMAND}="${href}" href="javascript:void(0)" title="${title || ''}">${text}</a>`;

  const result = toHtml(message, {
    gfm: true,
    breaks: false,
    pedantic: false,
    renderer,
    ...(options || {}),
  });

  return typeof result === 'string' ? result : '';
};
