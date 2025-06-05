import { marked } from 'marked';
import React, { ReactNode } from 'react';

import { HeadingLevels, MarkdownReactRenderer } from './render';

import type { Token, Tokens } from 'marked';

/**
 * 这里通过重新实现 marked.Renderer 的所有方法，实现一个能直接渲染 React 的 Markdown 渲染器
 */
export class MarkdownReactParser extends marked.Renderer {
  private renderer: MarkdownReactRenderer;

  constructor(options: { renderer: MarkdownReactRenderer }) {
    super();

    this.renderer = options.renderer;
  }

  parse(tokens: Token[]): ReactNode[] {
    return tokens.map((token, index) => {
      const element = (() => {
        switch (token.type) {
          case 'html': {
            const htmlToken = token as Tokens.HTML;
            return this.renderer.html(htmlToken.text);
          }

          case 'space': {
            return null;
          }

          case 'heading': {
            const headingToken = token as Tokens.Heading;
            const level = headingToken.depth as HeadingLevels;
            return this.renderer.heading(this.parseInline(headingToken.tokens), level);
          }

          case 'paragraph': {
            const paragraphToken = token as Tokens.Generic;
            return this.renderer.paragraph(this.parseInline(paragraphToken.tokens));
          }

          case 'text': {
            const textToken = token as Tokens.Text;
            return textToken.tokens ? this.parseInline(textToken.tokens) : textToken.text;
          }

          case 'blockquote': {
            const blockquoteToken = token as Tokens.Blockquote;
            const quote = this.parse(blockquoteToken.tokens);
            return this.renderer.blockquote(quote);
          }

          case 'list': {
            const listToken = token as Tokens.List;

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

            return this.renderer.list(children, listToken.ordered);
          }

          case 'code': {
            const codeToken = token as Tokens.Code;
            // 检查是否是 mermaid 代码块
            if (codeToken.lang === 'mermaid') {
              // 返回特殊的 mermaid 标记，在渲染器中处理
              return this.renderer.mermaid?.(codeToken.text) || this.renderer.code(codeToken.text, codeToken.lang);
            }
            return this.renderer.code(codeToken.text, codeToken.lang);
          }

          case 'table': {
            const tableToken = token as Tokens.Table;
            const headerCells = tableToken.header.map((cell, cellIndex) =>
              React.cloneElement(
                this.renderer.tableCell(this.parseInline(cell.tokens), {
                  header: true,
                  align: tableToken.align[cellIndex],
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
                    align: tableToken.align[cellIndex],
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

  parseInline(tokens: Token[] = []): ReactNode[] {
    return tokens.map((token) => {
      switch (token.type) {
        case 'text': {
          const textToken = token as Tokens.Text;
          const text = htmlUnescape(textToken.text);
          return this.renderer.text(text);
        }

        case 'strong': {
          const strongToken = token as Tokens.Strong;
          return this.renderer.strong(this.parseInline(strongToken.tokens));
        }

        case 'em': {
          const emToken = token as Tokens.Em;
          return this.renderer.em(this.parseInline(emToken.tokens));
        }

        case 'del': {
          const delToken = token as Tokens.Del;
          return this.renderer.del(this.parseInline(delToken.tokens));
        }

        case 'codespan': {
          const codespanToken = token as Tokens.Codespan;
          return this.renderer.codespan(htmlUnescape(codespanToken.text));
        }

        case 'link': {
          const linkToken = token as Tokens.Link;
          return this.renderer.link(linkToken.href, this.parseInline(linkToken.tokens));
        }

        case 'image': {
          const imageToken = token as Tokens.Image;
          return this.renderer.image(imageToken.href, imageToken.text, imageToken.title);
        }

        case 'html': {
          const htmlToken = token as Tokens.HTML;
          return this.renderer.html(htmlToken.text);
        }

        case 'br': {
          return this.renderer.br();
        }

        case 'escape': {
          const escapeToken = token as Tokens.Escape;
          return this.renderer.text(escapeToken.text);
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
