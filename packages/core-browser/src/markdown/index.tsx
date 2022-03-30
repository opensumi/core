import { marked } from 'marked';
import React, { RefObject, useEffect, useRef } from 'react';

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

export const toMarkdown = (message: string | React.ReactNode, opener: IOpenerService): React.ReactNode => {
  const renderer = new marked.Renderer();

  renderer.link = (href, title, text) =>
    `<a rel="noopener" ${DATA_SET_COMMAND}="${href}" href="javascript:void(0)" title="${title}">${text}</a>`;

  return typeof message === 'string' ? (
    <RenderWrapper
      opener={opener}
      html={marked(message, {
        gfm: true,
        breaks: false,
        pedantic: false,
        sanitize: true,
        smartLists: true,
        smartypants: false,
        renderer,
      })}
    ></RenderWrapper>
  ) : (
    message
  );
};
