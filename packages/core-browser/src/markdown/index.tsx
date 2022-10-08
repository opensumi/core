import React, { RefObject, useEffect, useRef } from 'react';

import { createMarkedRenderer, toMarkdownHtml as toHtml } from '@opensumi/ide-components/lib/utils';

import { IOpenerService } from '../opener';

const DATA_SET_COMMAND = 'data-command';

const RenderWrapper = (props: { html: string; opener?: IOpenerService }) => {
  const ref = useRef<HTMLDivElement | undefined>();
  const { html, opener } = props;

  useEffect(() => {
    if (ref && ref.current) {
      ref.current.addEventListener('click', listenClick);
    }
    return () => {
      if (ref && ref.current) {
        ref.current.removeEventListener('click', listenClick);
      }
    };
  }, []);

  /**
   * 拦截 a 标签的点击事件，触发 commands
   */
  const listenClick = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'a' && target.hasAttribute(DATA_SET_COMMAND)) {
      const dataCommand = target.getAttribute(DATA_SET_COMMAND);
      if (dataCommand && opener) {
        opener.open(dataCommand);
      }
    }
  };

  return <div dangerouslySetInnerHTML={{ __html: html }} ref={ref as unknown as RefObject<HTMLDivElement>}></div>;
};

export const toMarkdown = (message: string | React.ReactNode, opener?: IOpenerService): React.ReactNode =>
  typeof message === 'string' ? (
    <RenderWrapper opener={opener} html={toMarkdownHtml(message)}></RenderWrapper>
  ) : (
    message
  );

export const toMarkdownHtml = (message: string): string => {
  const renderer = createMarkedRenderer();

  renderer.link = (href, title, text) =>
    `<a rel="noopener" ${DATA_SET_COMMAND}="${href}" title="${title ?? href}">${text}</a>`;

  return toHtml(message, {
    gfm: true,
    breaks: false,
    pedantic: false,
    smartLists: true,
    smartypants: false,
    renderer,
  });
};
