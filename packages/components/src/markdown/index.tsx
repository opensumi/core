import { marked, Renderer } from 'marked';
import React from 'react';

import { DATA_SET_COMMAND, IOpenerShape, RenderWrapper } from './render';

interface IMarkdownProps {
  value: string;
  renderer: marked.Renderer;
  opener?: IOpenerShape;
}

export const linkify = (href: string | null, title: string | null, text: string) =>
  `<a rel="noopener" ${DATA_SET_COMMAND}="${href}" title="${title ?? href}">${text}</a>`;

export class DefaultMarkedRenderer extends Renderer {
  link(href: string | null, title: string | null, text: string): string {
    return linkify(href, title, text);
  }
}

export function Markdown(props: IMarkdownProps) {
  const parseMarkdown = (text: string, renderer: any) => marked.parse(text, { renderer });

  const [htmlContent, setHtmlContent] = React.useState(parseMarkdown(props.value, props.renderer));

  React.useEffect(() => {
    setHtmlContent(parseMarkdown(props.value, props.renderer));
  }, [props.renderer, props.value]);

  return <RenderWrapper opener={props.opener} html={htmlContent}></RenderWrapper>;
}
