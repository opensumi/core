import { Renderer, marked } from 'marked';
import React from 'react';

import { DATA_SET_COMMAND, IOpenerShape, RenderWrapper } from './render';

import type { Tokens } from 'marked';

interface IMarkdownProps {
  value?: string;
  renderer: Renderer;
  opener?: IOpenerShape;
}

export const linkify = (href: string | null, title: string | null, text: string) =>
  `<a rel="noopener" ${DATA_SET_COMMAND}="${href}" title="${title ?? href}">${text}</a>`;

export class DefaultMarkedRenderer extends Renderer {
  link({ href, title, text }: Tokens.Link): string {
    return linkify(href, title || null, text);
  }
}

export function Markdown(props: IMarkdownProps) {
  const parseMarkdown = (text: string, renderer: any) => {
    const result = marked.parse(text, { renderer, async: false });
    return typeof result === 'string' ? result : '';
  };

  const [htmlContent, setHtmlContent] = React.useState(parseMarkdown(props.value || '', props.renderer));

  React.useEffect(() => {
    setHtmlContent(parseMarkdown(props.value || '', props.renderer));
  }, [props.renderer, props.value]);

  return <RenderWrapper opener={props.opener} html={htmlContent}></RenderWrapper>;
}
