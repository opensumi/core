import {
  IContextKeyService,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingRegistryImpl,
  Keybinding,
  KeybindingScope,
  ILogger,
  BrowserKeyboardLayoutImpl,
  KeybindingService,
  SpecialCases,
} from '@opensumi/ide-core-browser';
import {
  KeyboardLayoutChangeNotifierService,
  KeyboardNativeLayoutService,
} from '@opensumi/ide-core-common/lib/keyboard/keyboard-layout-provider';
import {
  ContextKeyDefinedExpr,
  ContextKeyEqualsExpr,
  ContextKeyNotEqualsExpr,
  ContextKeyNotExpr,
  ContextKeyRegexExpr,
  ContextKeyExpr,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockLogger } from '../../__mocks__/logger';
import { KeybindingsResultCollection } from '../../src';
import { KeyboardLayoutService } from '../../src/keyboard/keyboard-layout-service';
import { GlobalBrowserStorageService, IStatusBarService } from '../../src/services';

describe('KeybindingRegistry', () => {
  let keybindingRegistry: KeybindingRegistry;
  let injector: MockInjector;

  const storage = {};
  const mockGlobalBrowserStorageService = {
    setData: (key, value) => {
      storage[key] = value;
    },
    getData: (key) => storage[key],
  };

  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: GlobalBrowserStorageService,
          useValue: mockGlobalBrowserStorageService,
        },
        {
          token: KeyboardNativeLayoutService,
          useClass: BrowserKeyboardLayoutImpl,
        },
        {
          token: KeyboardLayoutChangeNotifierService,
          useClass: BrowserKeyboardLayoutImpl,
        },
        {
          token: KeyboardLayoutService,
          useClass: KeyboardLayoutService,
        },
        {
          token: KeybindingRegistry,
          useClass: KeybindingRegistryImpl,
        },
      ]),
    );

    // mock used instance
    injector.overrideProviders(
      {
        token: KeybindingContribution,
        useValue: {},
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
      {
        token: IContextKeyService,
        useValue: {
          match: () => true,
        },
      },
      {
        token: IStatusBarService,
        useValue: {
          removeElement: () => {},
          addElement: () => {},
        },
      },
    );

    keybindingRegistry = injector.get(KeybindingRegistry);
  });

  describe('01 #Init', () => {
    test('should ready to work after init', async (done) => {
      expect(typeof keybindingRegistry.initialize).toBe('function');
      expect(typeof keybindingRegistry.registerKeybinding).toBe('function');
      expect(typeof keybindingRegistry.registerKeybindings).toBe('function');
      expect(typeof keybindingRegistry.unregisterKeybinding).toBe('function');
      expect(typeof keybindingRegistry.resolveKeybinding).toBe('function');
      expect(typeof keybindingRegistry.containsKeybinding).toBe('function');
      expect(typeof keybindingRegistry.containsKeybindingInScope).toBe('function');
      expect(typeof keybindingRegistry.acceleratorFor).toBe('function');
      expect(typeof keybindingRegistry.acceleratorForSequence).toBe('function');
      expect(typeof keybindingRegistry.acceleratorForKeyCode).toBe('function');
      expect(typeof keybindingRegistry.acceleratorForKey).toBe('function');
      expect(typeof keybindingRegistry.getKeybindingsForKeySequence).toBe('function');
      expect(typeof keybindingRegistry.getKeybindingsForCommand).toBe('function');
      expect(typeof keybindingRegistry.getScopedKeybindingsForCommand).toBe('function');
      expect(typeof keybindingRegistry.isEnabled).toBe('function');
      expect(typeof keybindingRegistry.isPseudoCommand).toBe('function');
      expect(typeof keybindingRegistry.resetKeybindings).toBe('function');
      expect(typeof keybindingRegistry.onKeybindingsChanged).toBe('function');
      done();
    });
  });

  describe('02 #API should be work', () => {
    test('registerKeybinding/unregisterKeybinding', () => {
      const keybinding = {
        command: 'test.command',
        keybinding: 'ctrl+c',
        when: 'focus',
      };
      injector.mockCommand('test.command', () => {});
      const res = keybindingRegistry.registerKeybinding(keybinding, KeybindingScope.USER);
      expect(keybindingRegistry.getKeybindingsForCommand(keybinding.command).length).toBe(1);
      expect(res.dispose).toBeDefined();
      res.dispose();
      expect(keybindingRegistry.getKeybindingsForCommand(keybinding.command).length).toBe(0);
    });

    test('acceleratorForKeyString', () => {
      const keybinding = {
        command: 'test.acceleratorForKeyString',
        keybinding: 'ctrl+o',
      };
      injector.mockCommand('test.command', () => {});
      keybindingRegistry.registerKeybinding(keybinding, KeybindingScope.USER);
      expect(keybindingRegistry.acceleratorForKeyString(keybinding.keybinding, '+')).toBe(
        `${SpecialCases.CTRL.replace(/^\S/, (key) => key.toUpperCase())}+O`,
      );
    });

    test('containsKeybinding', () => {
      const keybinding1 = {
        command: 'test.command',
        keybinding: 'ctrl+c',
        when: 'focus',
      };
      let res = keybindingRegistry.containsKeybinding([keybinding1], keybinding1);
      expect(res).toBeTruthy();
      const keybinding2 = {
        command: 'test.command',
        keybinding: 'ctrl+c ctrl+d',
        when: 'focus',
      };
      res = keybindingRegistry.containsKeybinding([keybinding2], keybinding1);
      expect(res).toBeTruthy();
      res = keybindingRegistry.containsKeybinding([keybinding1], keybinding2);
      expect(res).toBeTruthy();
    });

    test('getScopedKeybindingsForCommand', () => {
      const keybinding = {
        command: 'test.command',
        keybinding: 'ctrl+s',
        when: 'focus',
      };
      const testFn = jest.fn();
      injector.mockCommand('test.command', testFn);
      const handle = keybindingRegistry.registerKeybinding(keybinding, KeybindingScope.USER);
      const keybinds = keybindingRegistry.getScopedKeybindingsForCommand(KeybindingScope.USER, keybinding.command);
      expect(keybinds.length).toBe(1);
      handle.dispose();
    });

    test('validateKeybindingInScope', () => {
      const keybinding = {
        command: 'test.command',
        keybinding: 'ctrl+c',
        when: 'focus',
      };
      const res = keybindingRegistry.registerKeybinding(keybinding, KeybindingScope.USER);

      const isInScoped = keybindingRegistry.validateKeybindingInScope(keybinding, KeybindingScope.USER);
      expect(isInScoped).toBe('');
      res.dispose();
    });

    test('validateKeybinding', () => {
      const keybinding1 = {
        command: 'test.command',
        keybinding: 'ctrl+c',
        when: 'focus',
      };
      let res = keybindingRegistry.validateKeybinding([keybinding1], keybinding1);
      expect(res).toBe('');
      const keybinding2 = {
        command: 'test.command',
        keybinding: 'ctrl+c ctrl+d',
        when: 'focus',
      };
      res = keybindingRegistry.validateKeybinding([keybinding2], keybinding1);
      expect(res).toBe('');
      res = keybindingRegistry.validateKeybinding([keybinding1], keybinding2);
      expect(res).toBe('');
    });
  });

  describe('03 #Namespace function', () => {
    describe('Keybinding', () => {
      test('stringify', () => {
        const keybinding = {
          keybinding: 'ctrl+c',
          command: 'copy',
          when: 'editorFocus',
        };
        const str = Keybinding.stringify(keybinding);
        const parsed = JSON.parse(str);
        expect(parsed.keybinding).toBe(keybinding.keybinding);
        expect(parsed.command).toBe(keybinding.command);
        expect(parsed.when).toBeUndefined();
      });

      test('is', () => {
        const keybinding = {
          keybinding: 'ctrl+c',
          command: 'copy',
          when: 'editorFocus',
        };
        expect(Keybinding.is(keybinding)).toBeTruthy();
        expect(Keybinding.is({ command: 'copy' })).toBeFalsy();
        expect(Keybinding.is({ keybinding: 'ctrl+c' })).toBeFalsy();
      });
    });

    describe('KeybindingsResultCollection', () => {
      it('merge', () => {
        const result1 = new KeybindingsResultCollection.KeybindingsResult();
        result1.full = [
          {
            keybinding: 'ctrl+c',
            command: 'copy',
            when: 'editorFocus',
          },
        ];
        const result2 = new KeybindingsResultCollection.KeybindingsResult();
        result2.full = [
          {
            keybinding: 'ctrl+c',
            command: 'cut',
            when: 'editorFocus',
          },
        ];
        expect(result1.merge(result2).full.length).toBe(2);
      });

      it('filter', () => {
        const result1 = new KeybindingsResultCollection.KeybindingsResult();
        result1.full = [
          {
            keybinding: 'ctrl+c',
            command: 'copy',
            when: 'editorFocus',
          },
          {
            keybinding: 'ctrl+c',
            command: 'cut',
          },
        ];
        const result = result1.filter((keybinding) => !!keybinding.when);
        expect(result.full.length).toBe(1);
      });
    });
  });
});

describe('KeybindingService', () => {
  let keybindingService: KeybindingService;
  let keybindingRegistry: KeybindingRegistry;
  let injector: MockInjector;

  const storage = {};
  const mockGlobalBrowserStorageService = {
    setData: (key, value) => {
      storage[key] = value;
    },
    getData: (key) => storage[key],
  };

  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: GlobalBrowserStorageService,
          useValue: mockGlobalBrowserStorageService,
        },
        {
          token: KeyboardNativeLayoutService,
          useClass: BrowserKeyboardLayoutImpl,
        },
        {
          token: KeyboardLayoutChangeNotifierService,
          useClass: BrowserKeyboardLayoutImpl,
        },
        {
          token: KeyboardLayoutService,
          useClass: KeyboardLayoutService,
        },
        {
          token: KeybindingService,
          useClass: KeybindingRegistryImpl,
        },
        {
          token: KeybindingRegistry,
          useFactory: (injector) => injector.get(KeybindingService),
        },
      ]),
    );

    // mock used instance
    injector.overrideProviders(
      {
        token: KeybindingContribution,
        useValue: {},
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
      {
        token: IContextKeyService,
        useValue: {
          match: () => true,
        },
      },
      {
        token: IStatusBarService,
        useValue: {
          removeElement: () => {},
          addElement: () => {},
        },
      },
    );
    keybindingRegistry = injector.get(KeybindingRegistry);
    keybindingService = injector.get(KeybindingService);
  });

  describe('01 #Init', () => {
    test('should ready to work after init', async (done) => {
      expect(typeof keybindingService.run).toBe('function');
      expect(typeof keybindingService.convert).toBe('function');
      expect(typeof keybindingService.clearConvert).toBe('function');
      expect(typeof keybindingService.convertMonacoWhen).toBe('function');

      done();
    });
  });

  describe('02 #API should be work', () => {
    test('convertMonacoWhen', () => {
      const getKeybindingByWhen = (when: any) => ({
        command: 'test.command',
        keybinding: 'ctrl+c',
        when,
      });
      const keybinding = getKeybindingByWhen('focus');
      expect(keybindingService.convertMonacoWhen(keybinding.when)).toBe(keybinding.when);

      const emptyKeybinding = getKeybindingByWhen('');
      expect(keybindingService.convertMonacoWhen(emptyKeybinding.when)).toBe(emptyKeybinding.when);

      const defined = {
        key: 'definedKey',
      };
      const contextKeyDefineExprKeybinding = getKeybindingByWhen(ContextKeyDefinedExpr.create(defined.key));
      expect(keybindingService.convertMonacoWhen(contextKeyDefineExprKeybinding.when)).toBe(defined.key);

      const equals = {
        key: 'equalsKey',
      };

      const contextKeyEqualsExprKeybinding = getKeybindingByWhen(ContextKeyEqualsExpr.create(equals.key, 'true'));
      expect(keybindingService.convertMonacoWhen(contextKeyEqualsExprKeybinding.when)).toBe(`${equals.key} == 'true'`);

      const notEquals = {
        key: 'notEqualsKey',
      };
      const contextKeyNotEqualsExprKeybinding = getKeybindingByWhen(
        ContextKeyNotEqualsExpr.create(notEquals.key, 'true'),
      );
      expect(keybindingService.convertMonacoWhen(contextKeyNotEqualsExprKeybinding.when)).toBe(
        `${notEquals.key} != 'true'`,
      );

      const not = {
        key: 'notKey',
      };
      const notKeybinding = getKeybindingByWhen(ContextKeyNotExpr.create(not.key));
      expect(keybindingService.convertMonacoWhen(notKeybinding.when)).toBe(`!${not.key}`);

      const regex = {
        regexp: {
          source: 'regexKey',
        },
        key: 'regexKey',
      };
      const contextKeyAndRegexExprKeybinding = getKeybindingByWhen(
        ContextKeyRegexExpr.create(regex.key, new RegExp(regex.regexp.source, 'i')),
      );
      expect(keybindingService.convertMonacoWhen(contextKeyAndRegexExprKeybinding.when)).toBe(
        `${regex.key} =~ /${regex.regexp.source}/i`,
      );

      const contextKeyAndExprKeybinding = getKeybindingByWhen(
        ContextKeyExpr.and(ContextKeyDefinedExpr.create('a'), ContextKeyDefinedExpr.create('b')),
      );
      expect(keybindingService.convertMonacoWhen(contextKeyAndExprKeybinding.when)).toBe('a && b');

      const contextKeyOrExprKeybinding = getKeybindingByWhen(
        ContextKeyExpr.or(ContextKeyDefinedExpr.create('a'), ContextKeyDefinedExpr.create('b')),
      );
      expect(keybindingService.convertMonacoWhen(contextKeyOrExprKeybinding.when)).toBe('a || b');
    });

    test('convert', () => {
      const event = new window.Event('keydown', { bubbles: true });
      event.initEvent('keydown', true, true);
      (event as any).keyCode = 27;
      (event as any).code = 'Escape';
      (event as any).character = 'Escape';
      (event as any).charCode = 27;
      let text = keybindingService.convert(event as any);
      expect(text).toBe('Escape');
      keybindingService.clearConvert();
      // ctrl + s
      const ctrlSEvent = new window.Event('keydown', { bubbles: true });
      ctrlSEvent.initEvent('keydown', true, true);
      (ctrlSEvent as any).keyCode = 83;
      (ctrlSEvent as any).code = 'KeyS';
      (ctrlSEvent as any).charCode = 83;
      (ctrlSEvent as any).character = 's';
      (ctrlSEvent as any).ctrlKey = true;
      text = keybindingService.convert(ctrlSEvent as any);
      expect(text).toBe(
        `${SpecialCases.CTRL.replace(/^\S/, function (s) {
          return s.toUpperCase();
        })}+S`,
      );
      keybindingService.clearConvert();
      // Numpad_add
      const numpadAddEvent = new window.Event('keydown', { bubbles: true });
      numpadAddEvent.initEvent('keydown', true, true);
      (numpadAddEvent as any).keyCode = 107;
      (numpadAddEvent as any).code = 'NumpadAdd';
      (numpadAddEvent as any).key = '+';
      (numpadAddEvent as any).charCode = 0;
      text = keybindingService.convert(numpadAddEvent as any);
      expect(text).toBe('Numpad_add');
      keybindingService.clearConvert();
    });

    test('run', () => {
      // ctrl + s
      const keybinding = {
        command: 'test.command',
        keybinding: 'ctrl+s',
        when: 'focus',
      };
      const testFn = jest.fn();
      injector.mockCommand('test.command', testFn);
      const handle = keybindingRegistry.registerKeybinding(keybinding, KeybindingScope.USER);
      const ctrlSEvent = new window.Event('keydown', { bubbles: true });
      ctrlSEvent.initEvent('keydown', true, true);
      (ctrlSEvent as any).keyCode = 83;
      (ctrlSEvent as any).easyString = 's';
      (ctrlSEvent as any).code = 'KeyS';
      (ctrlSEvent as any).key = {
        code: 'KeyS',
        easyString: 's',
        keyCode: 83,
      };
      (ctrlSEvent as any).charCode = 83;
      (ctrlSEvent as any).character = 's';
      (ctrlSEvent as any).ctrlKey = true;
      keybindingService.run(ctrlSEvent as any);
      expect(testFn).toBeCalled();
      handle.dispose();
    });
  });
});
