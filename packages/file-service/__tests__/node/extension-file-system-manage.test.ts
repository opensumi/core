import { URI } from '@ali/ide-core-common';
import { ExtensionFileSystemManage } from '../../src/node/extension-file-system-manage';
import { IFileServiceExtClient } from '../../src/common';

describe('ExtensionFileSystemManage', () => {
  const uri = URI.file('/root/test.txt');
  const uri1 = URI.file('/root/test1.txt');
  const calledMap: Map<string, any[]> = new Map();
  const mockFileServiceClient: IFileServiceExtClient = {
    async runExtFileSystemClientMethod(method: string, args: any[]) {
      if (method === 'haveProvider') {
        return true;
      }
      calledMap.set(method, args);
    },

    runExtFileSystemProviderMethod(scheme: string, method: string, args) {
      calledMap.set(method, args);
    },
  }  as any;

  it('Should Run method with args', async () => {
    const extensionFileSystemManage = new ExtensionFileSystemManage(mockFileServiceClient);
    const fsProvider = await extensionFileSystemManage.get('test');

    if (!fsProvider) {
      throw new Error('No provider');
    }

    fsProvider.watch(uri.codeUri, { recursive: true, excludes: []}).dispose();
    expect(calledMap.get('watchFileWithProvider')).toEqual([uri.codeUri.toString(), { recursive: true, excludes: []}]);

    await fsProvider.stat(uri.codeUri);
    expect(calledMap.get('stat')).toEqual([uri.codeUri.toString()]);

    await fsProvider.readDirectory(uri.codeUri);
    expect(calledMap.get('readDirectory')).toEqual([uri.codeUri.toString()]);

    await fsProvider.readFile(uri.codeUri);
    expect(calledMap.get('readFile')).toEqual([uri.codeUri.toString()]);

    await fsProvider.writeFile(uri.codeUri, new Uint8Array(), { create: true, overwrite: true });
    expect(calledMap.get('writeFile')).toEqual([uri.codeUri.toString(), new Uint8Array(), { create: true, overwrite: true }]);

    await fsProvider.delete(uri.codeUri, { recursive: true });
    expect(calledMap.get('delete')).toEqual([uri.codeUri.toString(), { recursive: true }]);

    await fsProvider.rename(uri.codeUri, uri1.codeUri, { overwrite: true });
    expect(calledMap.get('rename')).toEqual([uri.codeUri.toString(), uri1.codeUri.toString(), { overwrite: true }]);

    await fsProvider.copy!(uri.codeUri, uri1.codeUri, { overwrite: true });
    expect(calledMap.get('copy')).toEqual([uri.codeUri.toString(), uri1.codeUri.toString(), { overwrite: true }]);
  });

});
