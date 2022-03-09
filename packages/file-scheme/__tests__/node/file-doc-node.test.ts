
import { tmpdir } from 'os';
import { join, dirname } from 'path';

import { ensureDir, writeFile, readFile } from 'fs-extra';

import { URI } from '@opensumi/ide-core-common';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { IFileService, FileStat } from '@opensumi/ide-file-service';
import { encode, decode } from '@opensumi/ide-file-service/lib/node/encoding';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
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

  beforeAll(async (done) => {
    await hashCalculateService.initialize();
    done();
  });

  it('file doc node service', async (done) => {
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
        const stat: FileStat = {
          uri: uriString,
          isDirectory: false,
          lastModification: Date.now(),
        };
        return stat;
      }),
    );

    injector.mock(
      IFileService,
      'resolveContent',
      jest.fn((stat: FileStat) => ({
        stat,
        content: 'current content',
      })),
    );

    injector.mock(
      IFileService,
      'access',
      jest.fn((uri: string) => uri.indexOf('notexist') === -1),
    );

    injector.mock(IFileService, 'createFile', jest.fn());
    injector.mock(IFileService, 'setContent', jest.fn());

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

    expect(fileService.setContent).toBeCalledTimes(1);

    // diff 情况
    const res2 = await fileDocNodeService.$saveByContent('file:///anyFile', {
      baseMd5: hashCalculateService.calculate('old content'),
      content: 'next content',
    });

    expect(res2.state).toBe('diff');

    expect(fileService.setContent).toBeCalledTimes(1);

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

    expect(fileService.setContent).toBeCalledTimes(2);

    const res4 = await fileDocNodeService.$saveByContent('file:///anyFilenotexist', {
      baseMd5: hashCalculateService.calculate(''),
      content: 'next content for new File',
    });

    expect(res4.state).toBe('success');

    expect(fileService.createFile).toBeCalledTimes(1);

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
    await writeFile(file2, encode('\n\n测试', 'gbk'));

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

    expect(decode(await readFile(file2), 'gbk')).toBe('测试\n\n测试');

    done();
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
