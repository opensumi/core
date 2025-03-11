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
    return tokens.map((token, index) => {
      const element = (() => {
        switch (token.type) {
          case 'html': {
            return this.renderer.html(token.text);
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

            const children = listToken.items.map((item, itemIndex) => {
              const listItemChildren: ReactNode[] = [];

              if (item.task) {
                listItemChildren.push(this.renderer.checkbox(item.checked ?? false));
              }

              listItemChildren.push(this.parse(item.tokens));

              return React.cloneElement(this.renderer.listItem(listItemChildren) as React.ReactElement, {
                key: `list-item-${itemIndex}`,
              });
            });

            return this.renderer.list(children, token.ordered);
          }

          case 'code': {
            return this.renderer.code(token.text, token.lang);
          }

          case 'table': {
            const tableToken = token as marked.Tokens.Table;
            const headerCells = tableToken.header.map((cell, cellIndex) =>
              React.cloneElement(
                this.renderer.tableCell(this.parseInline(cell.tokens), {
                  header: true,
                  align: token.align[cellIndex],
                }) as React.ReactElement,
                { key: `header-cell-${cellIndex}` },
              ),
            );

            const headerRow = React.cloneElement(this.renderer.tableRow(headerCells) as React.ReactElement, {
              key: 'header-row',
            });
            const header = this.renderer.tableHeader(headerRow);

            const bodyChilren = tableToken.rows.map((row, rowIndex) => {
              const rowChildren = row.map((cell, cellIndex) =>
                React.cloneElement(
                  this.renderer.tableCell(this.parseInline(cell.tokens), {
                    header: false,
                    align: token.align[cellIndex],
                  }) as React.ReactElement,
                  { key: `body-cell-${rowIndex}-${cellIndex}` },
                ),
              );

              return React.cloneElement(this.renderer.tableRow(rowChildren) as React.ReactElement, {
                key: `body-row-${rowIndex}`,
              });
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
      })();

      if (React.isValidElement(element)) {
        return React.cloneElement(element, { key: `token-${index}` });
      }
      return element;
    });
  }

  parseInline(tokens: marked.Token[] = []): ReactNode[] {
    return tokens.map((token) => {
      switch (token.type) {
        case 'text': {
          const text = htmlUnescape(token.text);
          return this.renderer.text(text);
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

function htmlUnescape(htmlStr) {
  return htmlStr
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}
