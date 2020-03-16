import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileSchemeNodeModule } from '../../src/node';
import { IFileSchemeDocNodeService } from '../../src/common';
import { IFileService, FileStat } from '@ali/ide-file-service';
import md5 = require('md5');
import { FileSchemeDocNodeServiceImpl } from '../../src/node/file-doc-node';

describe('node file doc service test', () => {

  it('file doc node service', async (done) => {

    const injector = createNodeInjector([FileSchemeNodeModule]);

    injector.addProviders({
      token: IFileService,
      useValue: {},
    });

    injector.addProviders({
      token: IFileSchemeDocNodeService,
      useClass: FileSchemeDocNodeServiceImpl,
    });

    injector.mock(IFileService, 'getFileStat', jest.fn((uriString: string) => {
      if (uriString.indexOf('notexist') > -1) {
        return undefined;
      }
      const stat: FileStat = {
        uri: uriString,
        isDirectory: false,
        lastModification: Date.now(),
      };
      return stat;
    }));

    injector.mock(IFileService, 'resolveContent', jest.fn((stat: FileStat) => {
      return {
        stat,
        content: 'current content',
      };
    }));

    injector.mock(IFileService, 'exists', jest.fn((uri: string) => {
      return uri.indexOf('notexist') === -1;
    }));

    injector.mock(IFileService, 'createFile', jest.fn());
    injector.mock(IFileService, 'updateContent', jest.fn());
    injector.mock(IFileService, 'setContent', jest.fn());

    const fileDocNodeService: IFileSchemeDocNodeService = injector.get(FileSchemeDocNodeServiceImpl);
    const fileService: IFileService = injector.get(IFileService);

    expect(fileDocNodeService).toBeDefined();

    const currentMd5 = md5('current content');

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
      baseMd5: md5('old content'),
      content: 'next content',
    });

    expect(res2.state).toBe('diff');

    expect(fileService.setContent).toBeCalledTimes(1);

    const res3 = await fileDocNodeService.$saveByContent('file:///anyFile', {
      baseMd5: md5('old content'),
      content: 'next content',
    }, 'utf-8', true);

    expect(res3.state).toBe('success');

    expect(fileService.setContent).toBeCalledTimes(2);

    const res4 = await fileDocNodeService.$saveByContent('file:///anyFilenotexist', {
      baseMd5: md5(''),
      content: 'next content for new File',
    });

    expect(res4.state).toBe('success');

    expect(fileService.createFile).toBeCalledTimes(1);

    const res5 = await fileDocNodeService.$saveByChange('file:///anyFile', {
      baseMd5: currentMd5,
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
    });

    expect(res5.state).toBe('success');

    expect(fileService.updateContent).toBeCalledTimes(1);

    const res6 = await fileDocNodeService.$saveByChange('file:///anyFile', {
      baseMd5: md5('old md5'),
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
    });

    expect(res6.state).toBe('diff');

    expect(fileService.updateContent).toBeCalledTimes(1);

    done();
  });

});
