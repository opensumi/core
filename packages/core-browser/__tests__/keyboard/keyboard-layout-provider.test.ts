import { enableJSDOM } from '@ali/ide-core-browser/lib/mocks/jsdom';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ILogger, GlobalBrowserStorageService, KeyboardNativeLayoutService, BrowserKeyboardLayoutImpl, Key } from '@ali/ide-core-browser';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';

describe('BrowserKeyboardLayoutService should be work', () => {
  let keyboardNativeLayoutService: BrowserKeyboardLayoutImpl;
  let injector: MockInjector;

  const storage = {};
  const mockGlobalBrowserStorageService = {
    setData: (key, value) => {
      storage[key] = value;
    },
    getData: (key) => {
      return storage[key];
    },
  };

  let disableJSDOM;

  beforeAll(async (done) => {
    disableJSDOM = enableJSDOM();

    injector = createBrowserInjector([], new MockInjector([
      {
        token: GlobalBrowserStorageService,
        useValue: mockGlobalBrowserStorageService,
      },
      {
        token: ILogger,
        useFactory: (injector) => {
          return injector.get(MockLoggerManageClient).getLogger();
        },
      },
    ]));

    keyboardNativeLayoutService = injector.get(KeyboardNativeLayoutService);

    await keyboardNativeLayoutService.whenReady;
    done();
  });

  afterAll(() => {
    injector.disposeAll();
    disableJSDOM();
  });

  describe('#init', () => {
    it('API should be init', () => {
      expect(Array.isArray(keyboardNativeLayoutService.allLayoutData)).toBeTruthy();
      expect(keyboardNativeLayoutService.currentLayoutData).toBeUndefined();
      expect(keyboardNativeLayoutService.currentLayoutSource).toBe('pressed-keys');
      expect(typeof keyboardNativeLayoutService.getNativeLayout).toBe('function');
      expect(typeof keyboardNativeLayoutService.setLayoutData).toBe('function');
      expect(typeof keyboardNativeLayoutService.validateKeyCode).toBe('function');
      expect(typeof keyboardNativeLayoutService.onDidChangeNativeLayout).toBe('function');
    });
  });

  describe('#use keyboard by user choose', () => {

    it('choose first layout as current keyboard layout', async (done) => {
      const firstLayout = keyboardNativeLayoutService.allLayoutData[0];
      const disposable = keyboardNativeLayoutService.onDidChangeNativeLayout((info) => {
        expect(keyboardNativeLayoutService.currentLayoutSource).toBe('user-choice');
        expect(info.layout).toEqual(firstLayout.layout);
        disposable.dispose();
        done();
      });
      await keyboardNativeLayoutService.setLayoutData(firstLayout);
    });

    it('get current layout should be first layout', async () => {
      const firstLayout = keyboardNativeLayoutService.allLayoutData[0];
      const layout = await keyboardNativeLayoutService.getNativeLayout();
      if (layout) {
        expect(layout).toBeDefined();
        expect(layout!.layout).toEqual(firstLayout.layout);
      }
    });
  });

  describe('#validate KeyCode or KeyValidationInput', () => {
    it('source mode should be autodetect', async () => {
      await keyboardNativeLayoutService.setLayoutData('autodetect');
    });

    it('validateKeyCode should be work', (done) => {
      const disposable = keyboardNativeLayoutService.onDidChangeNativeLayout((info) => {
        expect(keyboardNativeLayoutService.currentLayoutSource).toBe('pressed-keys');
        disposable.dispose();
        const subDisposable = keyboardNativeLayoutService.onDidChangeNativeLayout(() => {
          done();
          subDisposable.dispose();
        });
        keyboardNativeLayoutService.validateKeyCode({ key: Key.SEMICOLON, character: 'ö' } as any);
        keyboardNativeLayoutService.validateKeyCode({ key: Key.BRACKET_LEFT, character: 'ü' } as any);
        keyboardNativeLayoutService.validateKeyCode({ key: Key.SEMICOLON, character: 'm' } as any);
      });
      keyboardNativeLayoutService.validateKeyCode({ key: Key.QUOTE, character: 'ä' } as any);
    });
  });
});
