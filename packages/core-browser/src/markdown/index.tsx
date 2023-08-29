import React from 'react';

import { DATA_SET_COMMAND, RenderWrapper } from '@opensumi/ide-components/lib/markdown/render';
import { createMarkedRenderer, toMarkdownHtml as toHtml, IMarkedOptions } from '@opensumi/ide-components/lib/utils';

import { IOpenerService } from '../opener';

export const toMarkdown = (
  message: string | React.ReactNode,
  opener?: IOpenerService,
  options?: IMarkedOptions,
): React.ReactNode =>
  typeof message === 'string' ? (
    <RenderWrapper opener={opener} html={toMarkdownHtml(message, options)}></RenderWrapper>
  ) : (
    message
  );

export const toMarkdownHtml = (message: string, options?: IMarkedOptions): string => {
  const renderer = createMarkedRenderer();

  renderer.link = (href, title, text) =>
    `<a rel="noopener" ${DATA_SET_COMMAND}="${href}" href="javascript:void(0)" title="${title}">${text}</a>`;

  return toHtml(message, {
    gfm: true,
    breaks: false,
    pedantic: false,
    smartLists: true,
    smartypants: false,
    renderer,
    ...(options || {}),
  });
};
