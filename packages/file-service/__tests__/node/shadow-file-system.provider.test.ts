import { URI } from '@ali/ide-core-common';
import { ShadowFileSystemProvider } from '../../src/node/shadow-file-system.provider';

describe('ShadowFileSystemProvider', () => {
  const shadowFileSystemProvider = new ShadowFileSystemProvider();
  const uri = URI.file('/root/test.txt');
  const error = new Error('Method not implemented.');

  it('Should throw error', () => {
    expect(shadowFileSystemProvider.watch).toThrow(error);
    expect(shadowFileSystemProvider.readDirectory).toThrow(error);
    expect(shadowFileSystemProvider.createDirectory).toThrow(error);
    expect(shadowFileSystemProvider.delete).toThrow(error);
    expect(shadowFileSystemProvider.rename).toThrow(error);
    expect(shadowFileSystemProvider.copy!).toThrow(error);
    expect(shadowFileSystemProvider.exists!).toThrow(error);
    expect(shadowFileSystemProvider.access!).toThrow(error);
  });

  it('Should work', async () => {
    expect(await shadowFileSystemProvider.stat(uri.codeUri)).toEqual({ uri: uri.codeUri.toString(), lastModification: 0 });

    await shadowFileSystemProvider.writeFile(uri.codeUri, Buffer.alloc(10, 'a'), { create: true, overwrite: true });

    expect(shadowFileSystemProvider.readFile(uri.codeUri)).toEqual(Buffer.alloc(10, 'a'));
  });

});
