import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { URI } from '@ali/ide-core-common';
import { FileServiceClientModule } from '../../src/browser';
import { DiskFileServicePath } from '../../src';
import { FileResourceResolver } from '../../src/browser/file-service-contribution';
import { FileResource } from '../../src/browser/file-service-contribution';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';
import { MockFsProvider } from '../../src/common/mocks';
import { BinaryBuffer } from '@ali/ide-core-common/lib/utils/buffer';

describe('FileService Contribution should be work', () => {
  let injector: MockInjector;

  let fileResourceResolver;
  let fsProvider: MockFsProvider;
  const testUri = new URI('file://userhome/test.ts');
  beforeEach(async () => {
    injector = createBrowserInjector([FileServiceClientModule]);
    injector.addProviders({
      token: DiskFileServicePath,
      useClass: MockFsProvider,
    });
    fileResourceResolver = injector.get(FileResourceResolver);
    await fileResourceResolver.initialize();
    fsProvider = injector.get(DiskFileServicePath);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('file scheme path can be resolve correctly', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    expect(resource).toBeDefined();
    done();
  });

  it('content of file can be read', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    const content = await (resource as FileResource).readContents();
    expect(content).toEqual('mock content');
    done();
  });

  it('can set content to the file', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    const content = 'test';

    await (resource as FileResource).saveContents(content);
    expect(BinaryBuffer.wrap(Uint8Array.from(fsProvider.mockContent.get(testUri.toString()))).toString()).toEqual(content);
    done();
  });

  it('save content change should be work', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    const change = [];
    await (resource as FileResource).readContents();
    await (resource as FileResource).saveContentChanges(change);
    // expect(mockFileService.updateContent).toBeCalledWith({}, change, undefined);
    done();
  });

});
