import { marked } from 'marked';
import React, { ReactNode } from 'react';

import { HeadingLevels, MarkdownReactRenderer } from './render';

/**
 * 这里通过重新实现 marked.Renderer 的所有方法，实现一个能直接渲染 React 的 Markdown 渲染器
 */
export class MarkdownReactParser extends marked.Renderer {
  private renderer: MarkdownReactRenderer;

  constructor(options: { renderer: MarkdownReactRenderer }) {
    super();

    this.renderer = options.renderer;
  }

  parse(tokens: marked.Token[]): ReactNode[] {
    return tokens.map((token) => {
      switch (token.type) {
        case 'html': {
          return <div dangerouslySetInnerHTML={{ __html: token.raw }} />;
        }

        case 'space': {
          return null;
        }

        case 'heading': {
          const level = token.depth as HeadingLevels;
          return this.renderer.heading(this.parseInline(token.tokens), level);
        }

        case 'paragraph': {
          return this.renderer.paragraph(this.parseInline(token.tokens));
        }

        case 'text': {
          const textToken = token as marked.Tokens.Text;
          return textToken.tokens ? this.parseInline(textToken.tokens) : token.text;
        }

        case 'blockquote': {
          const blockquoteToken = token as marked.Tokens.Blockquote;
          const quote = this.parse(blockquoteToken.tokens);
          return this.renderer.blockquote(quote);
        }

        case 'list': {
          const listToken = token as marked.Tokens.List;

          const children = listToken.items.map((item) => {
            const listItemChildren: ReactNode[] = [];

            if (item.task) {
              listItemChildren.push(this.renderer.checkbox(item.checked ?? false));
            }

            listItemChildren.push(this.parse(item.tokens));

            return this.renderer.listItem(listItemChildren);
          });

          return this.renderer.list(children, token.ordered);
        }

        case 'code': {
          return this.renderer.code(token.text, token.lang);
        }

        case 'table': {
          const tableToken = token as marked.Tokens.Table;
          const headerCells = tableToken.header.map((cell, index) =>
            this.renderer.tableCell(this.parseInline(cell.tokens), { header: true, align: token.align[index] }),
          );

          const headerRow = this.renderer.tableRow(headerCells);
          const header = this.renderer.tableHeader(headerRow);

          const bodyChilren = tableToken.rows.map((row) => {
            const rowChildren = row.map((cell, index) =>
              this.renderer.tableCell(this.parseInline(cell.tokens), {
                header: false,
                align: token.align[index],
              }),
            );

            return this.renderer.tableRow(rowChildren);
          });

          const body = this.renderer.tableBody(bodyChilren);

          return this.renderer.table([header, body]);
        }

        case 'hr': {
          return this.renderer.hr();
        }

        default: {
          // eslint-disable-next-line no-console
          console.warn(`Token with "${token.type}" type was not found`);
          return null;
        }
      }
    });
  }

  parseInline(tokens: marked.Token[] = []): ReactNode[] {
    return tokens.map((token) => {
      switch (token.type) {
        case 'text': {
          return this.renderer.text(unescape(token.text));
        }

        case 'strong': {
          return this.renderer.strong(this.parseInline(token.tokens));
        }

        case 'em': {
          return this.renderer.em(this.parseInline(token.tokens));
        }

        case 'del': {
          return this.renderer.del(this.parseInline(token.tokens));
        }

        case 'codespan': {
          return this.renderer.codespan(unescape(token.text));
        }

        case 'link': {
          return this.renderer.link(token.href, this.parseInline(token.tokens));
        }

        case 'image': {
          return this.renderer.image(token.href, token.text, token.title);
        }

        case 'html': {
          return this.renderer.html(token.text);
        }

        case 'br': {
          return this.renderer.br();
        }

        case 'escape': {
          return this.renderer.text(token.text);
        }

        default: {
          // eslint-disable-next-line no-console
          console.warn(`Token with "${token.type}" type was not found`);
          return null;
        }
      }
    });
  }
}
