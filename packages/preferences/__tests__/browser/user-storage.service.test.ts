import { ILogger, getDebugLogger, AppConfig, Disposable, URI } from '@ali/ide-core-browser';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IFileServiceClient } from '@ali/ide-file-service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IUserStorageService, USER_STORAGE_SCHEME } from '@ali/ide-preferences';
import { UserStorageServiceImpl, DEFAULT_USER_STORAGE_FOLDER } from '@ali/ide-preferences/lib/browser/userstorage';

describe('UserStorageService should be work', () => {
  let injector: MockInjector;
  let userStorageService: IUserStorageService;
  const userHomeUri = URI.file('userhome');
  const mockFileServiceClient = {
    getCurrentUserHome: jest.fn(() => ({ uri: userHomeUri.toString()})),
    watchFileChanges: jest.fn(async () => Disposable.create(() => {})),
    onFilesChanged: jest.fn(() => Disposable.create(() => {})),
    access: jest.fn(() => true),
    resolveContent: jest.fn(async () => ''),
    setContent: jest.fn(),
    createFile: jest.fn(),
    createFolder: jest.fn(),
    getFileStat: jest.fn(async () => ({})),
  };

  const mockAppConfig: any = {
    userPreferenceDirName: '.user',
  };

  beforeEach(async (done) => {
    injector = createBrowserInjector([]);

    injector.addProviders({
      token: IFileServiceClient,
      useValue: mockFileServiceClient,
    });

    injector.addProviders({
      token: ILogger,
      useValue: getDebugLogger(),
    });

    injector.overrideProviders({
      token: AppConfig,
      useValue: mockAppConfig,
    });

    injector.addProviders({
      token: IUserStorageService,
      useClass: UserStorageServiceImpl,
    });

    userStorageService = injector.get(IUserStorageService);

    await userStorageService.whenReady;

    done();
  });

  afterEach(async () => {
    injector.disposeAll();
  });

  describe('01 #Init', () => {

    it('should have enough API', async () => {
      expect(typeof userStorageService.init).toBe('function');
      expect(typeof userStorageService.dispose).toBe('function');
      expect(typeof userStorageService.readContents).toBe('function');
      expect(typeof userStorageService.saveContents).toBe('function');
      expect(typeof userStorageService.getFsPath).toBe('function');
      expect(typeof userStorageService.onUserStorageChanged).toBe('function');

      expect(typeof UserStorageServiceImpl.toUserStorageUri).toBe('function');
      expect(typeof UserStorageServiceImpl.toFilesystemURI).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {
    it('User storage folder path should be right', async (done) => {
      // while has userPreferenceDirName config
      mockFileServiceClient.watchFileChanges.mockClear();
      mockAppConfig['userPreferenceDirName'] = '.user';
      await userStorageService.init();
      expect(await userStorageService.getFsPath(new URI('test').withScheme(USER_STORAGE_SCHEME))).toBe(userHomeUri.resolve(mockAppConfig.userPreferenceDirName).resolve('test').toString());
      // while has not userPreferenceDirName config but preferenceDirName exist
      mockFileServiceClient.watchFileChanges.mockClear();
      mockAppConfig['preferenceDirName'] = '.test';
      await userStorageService.init();
      expect(await userStorageService.getFsPath(new URI('test').withScheme(USER_STORAGE_SCHEME))).toBe(userHomeUri.resolve(mockAppConfig.userPreferenceDirName).resolve('test').toString());
      // while has not userPreferenceDirName and preferenceDirName
      mockFileServiceClient.watchFileChanges.mockClear();
      mockAppConfig['preferenceDirName'] = '';
      mockAppConfig['userPreferenceDirName'] = '';
      await userStorageService.init();
      expect(await userStorageService.getFsPath(new URI('test').withScheme(USER_STORAGE_SCHEME))).toBe(userHomeUri.resolve(DEFAULT_USER_STORAGE_FOLDER).resolve('test').toString());
      done();
    });

    it('readContents method should be work', async (done) => {
      await userStorageService.readContents(new URI('setting.json').withQuery(USER_STORAGE_SCHEME));
      mockFileServiceClient.access.mockClear();
      expect(mockFileServiceClient.resolveContent).toBeCalledTimes(1);
      done();
    });

    it('saveContents method should be work', async (done) => {
      // while file exist
      await userStorageService.saveContents(new URI('setting.json').withQuery(USER_STORAGE_SCHEME), JSON.stringify({test: 'nothing'}));
      expect(mockFileServiceClient.getFileStat).toBeCalledTimes(1);
      expect(mockFileServiceClient.setContent).toBeCalledTimes(1);
      mockFileServiceClient.getFileStat.mockResolvedValue(undefined as any);
      // while file no exist
      await userStorageService.saveContents(new URI('setting.json').withQuery(USER_STORAGE_SCHEME), JSON.stringify({test: 'nothing'}));
      expect(mockFileServiceClient.getFileStat).toBeCalledTimes(2);
      expect(mockFileServiceClient.createFile).toBeCalledTimes(1);
      done();
    });

    it('getFsPath method should be work', async (done) => {
      const fsPath = await userStorageService.getFsPath(new URI('setting.json').withQuery(USER_STORAGE_SCHEME));
      expect(fsPath).toBe(userHomeUri.resolve(DEFAULT_USER_STORAGE_FOLDER).resolve('setting.json').toString());
      done();
    });
  });

});
