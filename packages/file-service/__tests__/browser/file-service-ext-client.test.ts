import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { FileServiceClientModule } from '../../src/browser';
import { FileServiceExtClient } from '../../src/browser/file-service-ext-client';

describe('file service client', () => {
  const mockInjector = createBrowserInjector([FileServiceClientModule]);
  const fileServiceExtClient: FileServiceExtClient = mockInjector.get(FileServiceExtClient);
  const calledMap: Map<string, any[]> = new Map();

  const MockClient = {
    runProviderMethod(...args) {
      calledMap.set('runProviderMethod', args);
      return true;
    },

    stat(...args) {
      calledMap.set('stat', args);
      return true;
    },
  };

  fileServiceExtClient.setExtFileSystemClient(MockClient);

  it('Should Run method with args', async () => {
    expect(await fileServiceExtClient.runExtFileSystemProviderMethod('test', 'stat', ['test'])).toBe(true);
    expect(calledMap.get('runProviderMethod')).toEqual(['test', 'stat', ['test']]);

    expect(await fileServiceExtClient.runExtFileSystemClientMethod('stat', ['test'])).toBe(true);
    expect(calledMap.get('stat')).toEqual(['test']);
  });
});
