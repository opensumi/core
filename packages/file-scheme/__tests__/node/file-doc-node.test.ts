import { statSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { ensureDir, readFile, writeFile } from 'fs-extra';

import { URI, iconvDecode, iconvEncode } from '@opensumi/ide-core-common';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { FileStat, IFileService } from '@opensumi/ide-file-service';

import { IFileSchemeDocNodeService } from '../../src/common';
import { FileSchemeNodeModule } from '../../src/node';
import { FileSchemeDocNodeServiceImpl } from '../../src/node/file-scheme-doc.service';

describe('node file doc service test', () => {
  const injector = createNodeInjector([FileSchemeNodeModule]);
  injector.addProviders(
    ...[
      {
        token: IFileService,
        useValue: {},
      },
      {
        token: IHashCalculateService,
        useClass: HashCalculateServiceImpl,
      },
    ],
  );
  const hashCalculateService: IHashCalculateService = injector.get(IHashCalculateService);

  beforeAll(async () => {
    await hashCalculateService.initialize();
  });

  it('file doc node service', async () => {
    injector.addProviders({
      token: IFileSchemeDocNodeService,
      useClass: FileSchemeDocNodeServiceImpl,
    });

    injector.mock(
      IFileService,
      'getFileStat',
      jest.fn((uriString: string) => {
        if (uriString.indexOf('notexist') > -1) {
          return undefined;
        }
        const fsPath = new URI(uriString).codeUri.fsPath;
        let lastModification = Date.now();
        try {
          lastModification = statSync(fsPath).mtime.getTime();
        } catch {
          // virtual file, use Date.now()
        }
        const stat: FileStat = {
          uri: uriString,
          isDirectory: false,
          lastModification,
        };
        return stat;
      }),
    );

    injector.mock(
      IFileService,
      'resolveContent',
      jest.fn(async (uriString: string, options?: { encoding?: string }) => {
        const fsPath = new URI(uriString).codeUri.fsPath;
        let content: string;
        try {
          const buf = await readFile(fsPath);
          content =
            options?.encoding && options.encoding !== 'utf8' && options.encoding !== 'utf-8'
              ? iconvDecode(buf, options.encoding)
              : buf.toString('utf8');
        } catch {
          content = 'current content';
        }
        return { stat: { uri: uriString, isDirectory: false, lastModification: Date.now() }, content };
      }),
    );

    injector.mock(
      IFileService,
      'access',
      jest.fn((uri: string) => uri.indexOf('notexist') === -1),
    );

    injector.mock(IFileService, 'createFile', jest.fn());
    injector.mock(
      IFileService,
      'setContent',
      jest.fn(async (stat: FileStat, content: string, options?: { encoding?: string }) => {
        const fsPath = new URI(stat.uri).codeUri.fsPath;
        try {
          const buf =
            options?.encoding && options.encoding !== 'utf8' && options.encoding !== 'utf-8'
              ? iconvEncode(content, options.encoding)
              : Buffer.from(content, 'utf8');
          await writeFile(fsPath, buf);
        } catch {
          // virtual file, no-op
        }
        return stat;
      }),
    );

    const fileDocNodeService: IFileSchemeDocNodeService = injector.get(FileSchemeDocNodeServiceImpl);
    const fileService: IFileService = injector.get(IFileService);

    expect(fileDocNodeService).toBeDefined();

    const currentMd5 = hashCalculateService.calculate('current content');

    expect(await fileDocNodeService.$getMd5('file:///anyFile')).toBe(currentMd5);
    expect(await fileDocNodeService.$getMd5('file:///anyFilenotexist')).toBe(undefined);

    const res = await fileDocNodeService.$saveByContent('file:///anyFile', {
      baseMd5: currentMd5,
      content: 'next content',
    });

    expect(res.state).toBe('success');

    expect(fileService.setContent).toHaveBeenCalledTimes(1);

    // diff 情况
    const res2 = await fileDocNodeService.$saveByContent('file:///anyFile', {
      baseMd5: hashCalculateService.calculate('old content'),
      content: 'next content',
    });

    expect(res2.state).toBe('diff');

    expect(fileService.setContent).toHaveBeenCalledTimes(1);

    const res3 = await fileDocNodeService.$saveByContent(
      'file:///anyFile',
      {
        baseMd5: hashCalculateService.calculate('old content'),
        content: 'next content',
      },
      'utf-8',
      true,
    );

    expect(res3.state).toBe('success');

    expect(fileService.setContent).toHaveBeenCalledTimes(2);

    const res4 = await fileDocNodeService.$saveByContent('file:///anyFilenotexist', {
      baseMd5: hashCalculateService.calculate(''),
      content: 'next content for new File',
    });

    expect(res4.state).toBe('success');

    expect(fileService.createFile).toHaveBeenCalledTimes(1);

    const file1 = await createFixtureFile();
    await writeFile(file1, '\n\n2', 'utf8');

    const res5 = await fileDocNodeService.$saveByChange(URI.file(file1).toString(), {
      baseMd5: hashCalculateService.calculate('\n\n2'),
      changes: [
        {
          changes: [
            {
              range: {
                startColumn: 1,
                startLineNumber: 1,
                endColumn: 1,
                endLineNumber: 1,
              },
              text: 'test',
            },
          ],
        },
      ],
      eol: '\n',
    });

    expect(res5.state).toBe('success');

    expect(await readFile(file1, 'utf8')).toBe('test\n\n2');

    const res6 = await fileDocNodeService.$saveByChange(URI.file(file1).toString(), {
      baseMd5: hashCalculateService.calculate('old md5'),
      changes: [
        {
          changes: [
            {
              range: {
                startColumn: 1,
                startLineNumber: 1,
                endColumn: 1,
                endLineNumber: 1,
              },
              text: 'test',
            },
          ],
        },
      ],
      eol: '\n',
    });

    expect(res6.state).toBe('diff');

    const file2 = await createFixtureFile();
    await writeFile(file2, iconvEncode('\n\n测试', 'gbk'));

    const res7 = await fileDocNodeService.$saveByChange(
      URI.file(file2).toString(),
      {
        baseMd5: hashCalculateService.calculate('\n\n测试'),
        changes: [
          {
            changes: [
              {
                range: {
                  startColumn: 1,
                  startLineNumber: 1,
                  endColumn: 1,
                  endLineNumber: 1,
                },
                text: '测试',
              },
            ],
          },
        ],
        eol: '\n',
      },
      'gbk',
    );

    expect(res7.state).toBe('success');

    expect(iconvDecode(await readFile(file2), 'gbk')).toBe('测试\n\n测试');
  });
});

async function createFixtureFile(): Promise<string> {
  const fixtureFile = join(
    tmpdir(),
    `_test_/file-scheme-fixture-${new Date().getTime()}-${Math.floor(1000 * Math.random())}`,
    'tempFile.js',
  );
  await ensureDir(dirname(fixtureFile));
  return fixtureFile;
}
