import { ElementType, ReactElement, ReactNode, createElement } from 'react';

import { joinBase } from './helpers';

export type HeadingLevels = 1 | 2 | 3 | 4 | 5 | 6;
export interface TableFlags {
  header?: boolean;
  align?: 'center' | 'left' | 'right' | null;
}

export type CustomReactRenderer = Partial<MarkdownReactRenderer>;
export type RendererMethods = keyof MarkdownReactRenderer;

export interface ReactRendererOptions {
  baseURL?: string;
  openLinksInNewTab?: boolean;
  langPrefix?: string;
  renderer?: CustomReactRenderer;
}

export class MarkdownReactRenderer {
  private uid = 0;
  private options: ReactRendererOptions;

  constructor(options: ReactRendererOptions = {}) {
    this.options = options;
  }

  private node<T extends ElementType>(el: T, children: ReactNode = null, props = {}): ReactElement {
    const elProps = {
      key: `marked-react-${this.uid}`,
    };

    this.incrementUID();
    return createElement(el, { ...props, ...elProps }, children);
  }

  private incrementUID() {
    this.uid += 1;
  }

  heading(children: ReactNode, level: HeadingLevels) {
    return this.node(`h${level}`, children);
  }

  paragraph(children: ReactNode) {
    return this.node('p', children);
  }

  link(href: string, text: ReactNode) {
    const url = joinBase(href, this.options.baseURL);
    const target = this.options.openLinksInNewTab ? '_blank' : null;
    return this.node('a', text, { href: url, target });
  }

  image(src: string, alt: string, title: string | null = null) {
    const url = joinBase(src, this.options.baseURL);
    return this.node('img', null, { src: url, alt, title });
  }

  codespan(code: ReactNode, lang: string | null = null) {
    const className = lang ? `${this.options.langPrefix}${lang}` : null;
    return this.node('code', code, { className });
  }

  code(code: ReactNode | string, lang: string | undefined) {
    return this.node('pre', this.codespan(code, lang));
  }

  blockquote(children: ReactNode) {
    return this.node('blockquote', children);
  }

  list(children: ReactNode, ordered: boolean) {
    return this.node(ordered ? 'ol' : 'ul', children);
  }

  listItem(children: ReactNode[]) {
    return this.node('li', children);
  }

  checkbox(checked: ReactNode) {
    return this.node('input', null, { type: 'checkbox', disabled: true, checked });
  }

  table(children: ReactNode[]) {
    return this.node('table', children);
  }

  tableHeader(children: ReactNode) {
    return this.node('thead', children);
  }

  tableBody(children: ReactNode[]) {
    return this.node('tbody', children);
  }

  tableRow(children: ReactNode[]) {
    return this.node('tr', children);
  }

  tableCell(children: ReactNode[], flags: TableFlags) {
    const tag = flags.header ? 'th' : 'td';
    return this.node(tag, children, { align: flags.align });
  }

  strong(children: ReactNode) {
    return this.node('strong', children);
  }

  em(children: ReactNode) {
    return this.node('em', children);
  }

  del(children: ReactNode) {
    return this.node('del', children);
  }

  text(text: ReactNode) {
    return text;
  }

  html(html: ReactNode) {
    return html;
  }

  hr() {
    return this.node('hr');
  }

  br() {
    return this.node('br');
  }
}

export default MarkdownReactRenderer;
