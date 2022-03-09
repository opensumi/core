import {
  ILogger,
  GlobalBrowserStorageService,
  KeyboardNativeLayoutService,
  Key,
  KeyboardLayoutService,
  KeyCode,
  ILinuxKeyboardLayoutInfo,
  isOSX,
} from '@opensumi/ide-core-browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockLogger } from '../../__mocks__/logger';
import { KeyboardLayoutContribution } from '../../src/keyboard/layouts/_.contribution';

describe('KeyboardLayoutService should be work', () => {
  let keyboardLayoutService: KeyboardLayoutService;
  let injector: MockInjector;

  const storage = {};
  const mockGlobalBrowserStorageService = {
    setData: (key, value) => {
      storage[key] = value;
    },
    getData: (key) => storage[key],
  };

  beforeAll(async (done) => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: GlobalBrowserStorageService,
          useValue: mockGlobalBrowserStorageService,
        },
        {
          token: ILogger,
          useClass: MockLogger,
        },
      ]),
    );

    keyboardLayoutService = injector.get(KeyboardLayoutService);

    await keyboardLayoutService.initialize();
    done();
  });

  afterAll(() => {
    injector.disposeAll();
  });

  describe('#init', () => {
    it('API should be init', () => {
      expect(typeof keyboardLayoutService.initialize).toBe('function');
      expect(typeof keyboardLayoutService.resolveKeyCode).toBe('function');
      expect(typeof keyboardLayoutService.resolveKeyCode).toBe('function');
      expect(typeof keyboardLayoutService.getKeyboardCharacter).toBe('function');
      expect(typeof keyboardLayoutService.validateKeyCode).toBe('function');
      expect(typeof keyboardLayoutService.onKeyboardLayoutChanged).toBe('function');
    });
  });

  describe('#method should be work', () => {
    it('initialize & onKeyboardLayoutChanged', async (done) => {
      const disposable = keyboardLayoutService.onKeyboardLayoutChanged(() => {
        disposable.dispose();
        done();
      });
      await keyboardLayoutService.initialize();
    });

    it('resolveKeyCode & getKeyboardCharacter', async (done) => {
      require('../../src/keyboard/layouts/en.linux.ts');
      const keyboardLayoutProvider: KeyboardNativeLayoutService = injector.get(KeyboardNativeLayoutService);
      const layout = KeyboardLayoutContribution.INSTANCE.layoutInfos.find(
        (info) => (info.layout as ILinuxKeyboardLayoutInfo).model === 'pc105',
      );
      const disposable = keyboardLayoutService.onKeyboardLayoutChanged(() => {
        const toggleComment = keyboardLayoutService.resolveKeyCode(KeyCode.createKeyCode('Slash+M1'));
        expect(toggleComment.toString()).toBe(`${isOSX ? '⌘' : 'Ctrl'}+/`);
        expect(keyboardLayoutService.getKeyboardCharacter(toggleComment.key!)).toBe('/');
        const indentLine = keyboardLayoutService.resolveKeyCode(KeyCode.createKeyCode('BracketRight+M1'));
        expect(indentLine.toString()).toBe(`${isOSX ? '⌘' : 'Ctrl'}+]`);
        expect(keyboardLayoutService.getKeyboardCharacter(indentLine.key!)).toBe(']');
        disposable.dispose();
        done();
      });
      await keyboardLayoutProvider.setLayoutData(layout as any);
    });

    it('validateKeyCode', (done) => {
      // 需要重新设置为 autodetect 才能让 validateKeyCode 生效
      const keyboardLayoutProvider: KeyboardNativeLayoutService = injector.get(KeyboardNativeLayoutService);
      keyboardLayoutProvider.setLayoutData('autodetect');
      const disposable = keyboardLayoutService.onKeyboardLayoutChanged((info) => {
        disposable.dispose();
        done();
      });
      keyboardLayoutService.validateKeyCode({ key: Key.QUOTE, character: 'ä' } as any);
    });
  });
});
