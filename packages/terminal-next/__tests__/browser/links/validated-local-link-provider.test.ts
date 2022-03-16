import { Terminal, ILink } from 'xterm';

import { URI } from '@opensumi/ide-core-common';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { TerminalValidatedLocalLinkProvider } from '../../../src/browser/links/validated-local-link-provider';

const unixLinks = ['/foo', '~/foo', './foo', '../foo', '/foo/bar', '/foo/bar+more', 'foo/bar', 'foo/bar+more'];

const windowsLinks = [
  'c:\\foo',
  '\\\\?\\c:\\foo',
  'c:/foo',
  '.\\foo',
  './foo',
  '..\\foo',
  '~\\foo',
  '~/foo',
  'c:/foo/bar',
  'c:\\foo\\bar',
  'c:\\foo\\bar+more',
  'c:\\foo/bar\\baz',
  'foo/bar',
  'foo/bar',
  'foo\\bar',
  'foo\\bar+more',
];

interface LinkFormatInfo {
  urlFormat: string;
  line?: string;
  column?: string;
}

const supportedLinkFormats: LinkFormatInfo[] = [
  { urlFormat: '{0}' },
  { urlFormat: '{0} on line {1}', line: '5' },
  { urlFormat: '{0} on line {1}, column {2}', line: '5', column: '3' },
  { urlFormat: '{0}:line {1}', line: '5' },
  { urlFormat: '{0}:line {1}, column {2}', line: '5', column: '3' },
  { urlFormat: '{0}({1})', line: '5' },
  { urlFormat: '{0} ({1})', line: '5' },
  { urlFormat: '{0}({1},{2})', line: '5', column: '3' },
  { urlFormat: '{0} ({1},{2})', line: '5', column: '3' },
  { urlFormat: '{0}({1}, {2})', line: '5', column: '3' },
  { urlFormat: '{0} ({1}, {2})', line: '5', column: '3' },
  { urlFormat: '{0}:{1}', line: '5' },
  { urlFormat: '{0}:{1}:{2}', line: '5', column: '3' },
  { urlFormat: '{0}[{1}]', line: '5' },
  { urlFormat: '{0} [{1}]', line: '5' },
  { urlFormat: '{0}[{1},{2}]', line: '5', column: '3' },
  { urlFormat: '{0} [{1},{2}]', line: '5', column: '3' },
  { urlFormat: '{0}[{1}, {2}]', line: '5', column: '3' },
  { urlFormat: '{0} [{1}, {2}]', line: '5', column: '3' },
  { urlFormat: '{0}",{1}', line: '5' },
];

function format(pattern: string, ...args: any[]) {
  return pattern.replace(/\{(\d+)\}/g, (m, g) => args[g] || '');
}

describe('Workbench - TerminalValidatedLocalLinkProvider', () => {
  const injector = createBrowserInjector([]);

  async function assertLink(text: string, isWindows: boolean, expected: { text: string; range: [number, number][] }[]) {
    const xterm = new Terminal();
    const client = { os: isWindows ? OperatingSystem.Windows : OperatingSystem.Linux } as any;
    const provider = injector.get(TerminalValidatedLocalLinkProvider, [
      xterm,
      client,
      () => {},
      (() => {}) as any,
      () => ({
        dispose: () => {},
      }),
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

  describe('Linux/macOS', () => {
    const isWindows = false;
    unixLinks.forEach((baseLink) => {
      describe(`Link: ${baseLink}`, () => {
        for (const linkFormat of supportedLinkFormats) {
          test(`Format: ${linkFormat.urlFormat}`, async () => {
            const formattedLink = format(linkFormat.urlFormat, baseLink, linkFormat.line, linkFormat.column);
            await assertLink(formattedLink, isWindows, [
              {
                text: formattedLink,
                range: [
                  [1, 1],
                  [formattedLink.length, 1],
                ],
              },
            ]);
            await assertLink(` ${formattedLink} `, isWindows, [
              {
                text: formattedLink,
                range: [
                  [2, 1],
                  [formattedLink.length + 1, 1],
                ],
              },
            ]);
            await assertLink(`(${formattedLink})`, isWindows, [
              {
                text: formattedLink,
                range: [
                  [2, 1],
                  [formattedLink.length + 1, 1],
                ],
              },
            ]);
            await assertLink(`[${formattedLink}]`, isWindows, [
              {
                text: formattedLink,
                range: [
                  [2, 1],
                  [formattedLink.length + 1, 1],
                ],
              },
            ]);
          });
        }
      });
    });
    test('Git diff links', async () => {
      await assertLink('diff --git a/foo/bar b/foo/bar', isWindows, [
        {
          text: 'foo/bar',
          range: [
            [14, 1],
            [20, 1],
          ],
        },
        {
          text: 'foo/bar',
          range: [
            [24, 1],
            [30, 1],
          ],
        },
      ]);
      await assertLink('--- a/foo/bar', isWindows, [
        {
          text: 'foo/bar',
          range: [
            [7, 1],
            [13, 1],
          ],
        },
      ]);
      await assertLink('+++ b/foo/bar', isWindows, [
        {
          text: 'foo/bar',
          range: [
            [7, 1],
            [13, 1],
          ],
        },
      ]);
    });
  });

  describe('Windows', () => {
    const isWindows = true;
    windowsLinks.forEach((baseLink) => {
      describe(`Link "${baseLink}"`, () => {
        for (const linkFormat of supportedLinkFormats) {
          test(`Format: ${linkFormat.urlFormat}`, async () => {
            const formattedLink = format(linkFormat.urlFormat, baseLink, linkFormat.line, linkFormat.column);
            await assertLink(formattedLink, isWindows, [
              {
                text: formattedLink,
                range: [
                  [1, 1],
                  [formattedLink.length, 1],
                ],
              },
            ]);
            await assertLink(` ${formattedLink} `, isWindows, [
              {
                text: formattedLink,
                range: [
                  [2, 1],
                  [formattedLink.length + 1, 1],
                ],
              },
            ]);
            await assertLink(`(${formattedLink})`, isWindows, [
              {
                text: formattedLink,
                range: [
                  [2, 1],
                  [formattedLink.length + 1, 1],
                ],
              },
            ]);
            await assertLink(`[${formattedLink}]`, isWindows, [
              {
                text: formattedLink,
                range: [
                  [2, 1],
                  [formattedLink.length + 1, 1],
                ],
              },
            ]);
          });
        }
      });
    });
    test('Git diff links', async () => {
      await assertLink('diff --git a/foo/bar b/foo/bar', isWindows, [
        {
          text: 'foo/bar',
          range: [
            [14, 1],
            [20, 1],
          ],
        },
        {
          text: 'foo/bar',
          range: [
            [24, 1],
            [30, 1],
          ],
        },
      ]);
      await assertLink('--- a/foo/bar', isWindows, [
        {
          text: 'foo/bar',
          range: [
            [7, 1],
            [13, 1],
          ],
        },
      ]);
      await assertLink('+++ b/foo/bar', isWindows, [
        {
          text: 'foo/bar',
          range: [
            [7, 1],
            [13, 1],
          ],
        },
      ]);
    });
  });

  test('should support multiple link results', async () => {
    await assertLink('./foo ./bar', false, [
      {
        range: [
          [1, 1],
          [5, 1],
        ],
        text: './foo',
      },
      {
        range: [
          [7, 1],
          [11, 1],
        ],
        text: './bar',
      },
    ]);
  });
});
