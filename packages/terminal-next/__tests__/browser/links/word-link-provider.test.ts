import { ILink, Terminal } from '@xterm/xterm';

import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { TerminalWordLinkProvider } from '../../../src/browser/links/word-link-provider';

describe('Workbench - TerminalWordLinkProvider', () => {
  const injector = createBrowserInjector([]);

  async function assertLink(text: string, isWindows: boolean, expected: { text: string; range: [number, number][] }[]) {
    const xterm = new Terminal({ allowProposedApi: true });
    const provider = injector.get(TerminalWordLinkProvider, [
      xterm,
      (link: string, callback: (result: { uri: URI; isDirectory: boolean } | undefined) => void) => {},
      (_: string, cb: (result: { uri: URI; isDirectory: boolean } | undefined) => void) => {
        cb({ uri: URI.file('/'), isDirectory: false });
      },
    ]);

    // Write the text and wait for the parser to finish
    await new Promise<void>((r) => xterm.write(text, r));

    // Ensure all links are provided
    const links = (await new Promise<ILink[] | undefined>((r) => provider.provideLinks(1, r)))!;
    expect(links.length).toStrictEqual(expected.length);
    const actual = links.map((e) => ({
      text: e.text,
      range: e.range,
    }));
    const expectedVerbose = expected.map((e) => ({
      text: e.text,
      range: {
        start: { x: e.range[0][0], y: e.range[0][1] },
        end: { x: e.range[1][0], y: e.range[1][1] },
      },
    }));

    expect(actual).toEqual(expectedVerbose);
  }

  test('parse word link', async () => {
    const text = '000000.mp4       dist             dsada            dsadas';
    await assertLink(text, false, [
      {
        text: '000000.mp4',
        range: [
          [1, 1],
          [10, 1],
        ],
      },
      {
        text: 'dist',
        range: [
          [18, 1],
          [21, 1],
        ],
      },
      {
        text: 'dsada',
        range: [
          [35, 1],
          [39, 1],
        ],
      },
      {
        text: 'dsadas',
        range: [
          [52, 1],
          [57, 1],
        ],
      },
    ]);
  });
});
