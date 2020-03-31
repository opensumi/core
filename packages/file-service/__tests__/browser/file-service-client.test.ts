import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { URI } from '@ali/ide-core-common';
import { FileServiceClientModule } from '../../src/browser';
import { IFileServiceClient, FileServicePath } from '../../src';

describe('file service client', () => {
  const mockInjector = createBrowserInjector([FileServiceClientModule]);
  const fileServiceClient: IFileServiceClient = mockInjector.get(IFileServiceClient);
  const calledMap: Map<string, any[]> = new Map();
  const uri = URI.file('/root/test.txt');
  const uri1 = URI.file('/root/test1.txt');

  const MockFileService = new Proxy({}, {
    get: (target, propKey, receiver) => {
      return (...args) => {
        calledMap.set(String(propKey), args);
      };
    },
  });

  mockInjector.addProviders({
    token: FileServicePath,
    useValue: MockFileService,
  });

  it('Should Run method with args', () => {
    fileServiceClient.resolveContent(uri.toString(), { encoding: 'utf8' });
    expect(calledMap.get('resolveContent')).toEqual([uri.toString(), { encoding: 'utf8' }]);

    fileServiceClient.getFileStat(uri.toString());
    expect(calledMap.get('getFileStat')).toEqual([uri.toString()]);

    fileServiceClient.getFileType(uri.toString());
    expect(calledMap.get('getFileType')).toEqual([uri.toString()]);

    fileServiceClient.setContent({ uri: uri.toString(), lastModification: 0, isDirectory: false}, 'test', { encoding: 'utf8' });
    expect(calledMap.get('setContent')).toEqual([{ uri: uri.toString(), lastModification: 0, isDirectory: false}, 'test', { encoding: 'utf8' }]);

    fileServiceClient.createFile(uri.toString(), { encoding: 'utf8' });
    expect(calledMap.get('createFile')).toEqual([uri.toString(), { encoding: 'utf8' }]);

    fileServiceClient.access(uri.toString(), 1);
    expect(calledMap.get('access')).toEqual([uri.toString(), 1]);

    fileServiceClient.move(uri.toString(), uri1.toString(), { overwrite: true});
    expect(calledMap.get('move')).toEqual([uri.toString(), uri1.toString(), { overwrite: true}]);

    fileServiceClient.copy(uri.toString(), uri1.toString(), { overwrite: true});
    expect(calledMap.get('copy')).toEqual([uri.toString(), uri1.toString(), { overwrite: true}]);

    fileServiceClient.getCurrentUserHome();
    expect(calledMap.get('getCurrentUserHome')).toEqual([]);

    fileServiceClient.getFsPath(uri.toString());
    expect(calledMap.get('getFsPath')).toEqual([uri.toString()]);

    fileServiceClient.watchFileChanges(uri, ['test']);
    expect(calledMap.get('watchFileChanges')).toEqual([uri.toString(), { excludes: ['test']}]);

    fileServiceClient.setWatchFileExcludes(['test']);
    expect(calledMap.get('setWatchFileExcludes')).toEqual([['test']]);

    fileServiceClient.setWorkspaceRoots(['test']);
    expect(calledMap.get('setWorkspaceRoots')).toEqual([['test']]);

    fileServiceClient.unwatchFileChanges(1);
    expect(calledMap.get('unwatchFileChanges')).toEqual([1]);

    fileServiceClient.delete(uri.toString(), { moveToTrash: true });
    expect(calledMap.get('delete')).toEqual([uri.toString(), { moveToTrash: true }]);

    fileServiceClient.exists(uri.toString());
    expect(calledMap.get('exists')).toEqual([uri.toString()]);

    fileServiceClient.getEncoding(uri.toString());
    expect(calledMap.get('getEncoding')).toEqual([uri.toString()]);

    fileServiceClient.getEncodingInfo('test');
    expect(calledMap.get('getEncodingInfo')).toEqual(['test']);
  });
});
