import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { URI } from '@ali/ide-core-common';
import { FileServiceClientModule } from '../../src/browser';
import { FileServicePath } from '../../src';
import { FileResourceResolver } from '../../src/browser/file-service-contribution';
import { FileResource } from '../../src/browser/file-service-contribution';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';

describe('FileService Contribution should be work', () => {
  let injector: MockInjector;
  const mockFileService = {
    resolveContent: jest.fn(),
    exists: jest.fn(() => true),
    getFileStat: jest.fn(),
    setContent: jest.fn(),
    createFile: jest.fn(),
    updateContent: jest.fn(),
    watchFileChanges: jest.fn(),
  };
  let fileResourceResolver;
  const testUri = new URI('file://userhome/test.ts');
  beforeEach(() => {
    injector = createBrowserInjector([FileServiceClientModule]);
    injector.addProviders({
      token: FileServicePath,
      useValue: mockFileService,
    });
    fileResourceResolver = injector.get(FileResourceResolver);
    mockFileService.resolveContent.mockResolvedValue({
      stat: {},
      content: '',
    });
  });

  afterEach(() => {
    for (const key of Object.keys(mockFileService)) {
      if (mockFileService.hasOwnProperty(key)) {
        mockFileService[key].mockReset();
      }
    }
    injector.disposeAll();
  });

  it('file scheme path can be resolve correctly', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    expect(resource).toBeDefined();
    done();
  });

  it('content of file can be read', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    await (resource as FileResource).readContents();
    expect(mockFileService.resolveContent).toBeCalledWith(testUri.toString(), undefined);
    done();
  });

  it('can set content to the file', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    const content = 'test';
    const stat = {};
    mockFileService.getFileStat.mockResolvedValueOnce(stat);
    mockFileService.exists.mockResolvedValue(true);
    await (resource as FileResource).saveContents(content);
    expect(mockFileService.setContent).toBeCalledWith(stat, content, undefined);
    // while file does not exist, create file
    mockFileService.exists.mockResolvedValue(false);
    await (resource as FileResource).saveContents(content, {});
    expect(mockFileService.createFile).toBeCalledWith(testUri.toString(), {content});
    done();
  });

  it('save content change should be work', async (done) => {
    const resource = await fileResourceResolver.resolve(testUri);
    const change = [];
    await (resource as FileResource).readContents();
    await (resource as FileResource).saveContentChanges(change);
    expect(mockFileService.updateContent).toBeCalledWith({}, change, undefined);
    done();
  });

});
