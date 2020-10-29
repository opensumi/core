import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ContextKeyExprType, IContextKeyService, KeybindingContribution, KeybindingRegistry, KeybindingRegistryImpl, KeyboardLayoutService, Logger, CommandRegistry } from '@ali/ide-core-browser';
import { IStatusBarService } from '../../src/services';

describe('KeybindingRegistry should be work', () => {
  let keybindingRegistry: KeybindingRegistry;
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([], new MockInjector([{
      token: KeybindingRegistry,
      useClass: KeybindingRegistryImpl,
    }]));

    // mock used instance
    injector.overrideProviders(
      {
        token: KeyboardLayoutService,
        useValue: {},
      },
      {
        token: KeybindingContribution,
        useValue: {},
      },
      {
        token: CommandRegistry,
        useValue: {},
      },
      {
        token: Logger,
        useValue: {},
      },
      {
        token: IContextKeyService,
        useValue: {},
      },
      {
        token: IStatusBarService,
        useValue: {},
      },
    );

    keybindingRegistry = injector.get(KeybindingRegistry);
  });

  describe('01 #Init', () => {
    it('should ready to work after init', async (done) => {

      expect(typeof keybindingRegistry.onStart).toBe('function');
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
      expect(typeof keybindingRegistry.convertMonacoWhen).toBe('function');
      expect(typeof keybindingRegistry.onKeybindingsChanged).toBe('function');
      done();
    });
  });

  describe('02 #API should be work', () => {

    it('convertMonacoWhen method should be work', () => {
      let keybinding = {
        command: 'test.command',
        keybinding: 'cmd+c',
        when: 'focus' as any,
      };
      let result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(keybinding.when);

      keybinding = {
        ...keybinding,
        when: '',
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(keybinding.when);

      const defined = {
        getType: () => ContextKeyExprType.Defined,
        key: 'definedKey',
      };
      keybinding = {
        ...keybinding,
        when: defined,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(defined.key);

      const equals = {
        getType: () => ContextKeyExprType.Equals,
        getValue: () => 'true',
        key: 'notEqualsKey',
      };
      keybinding = {
        ...keybinding,
        when: equals,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`${equals.key} == 'true'`);

      const notEquals = {
        getType: () => ContextKeyExprType.NotEquals,
        getValue: () => 'true',
        key: 'equalsKey',
      };
      keybinding = {
        ...keybinding,
        when: notEquals,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`${notEquals.key} != 'true'`);

      const not = {
        getType: () => ContextKeyExprType.Not,
        key: 'notKey',
      };
      keybinding = {
        ...keybinding,
        when: not,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`!${not.key}`);

      const regex = {
        getType: () => ContextKeyExprType.Regex,
        regexp: {
          source: 'regexKey',
          ignoreCase: true,
        },
        key: 'regexKey',
      };
      keybinding = {
        ...keybinding,
        when: regex,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`${regex.key} =~ /${regex.regexp.source}/${regex.regexp.ignoreCase ? 'i' : ''}`);

      const and = {
        getType: () => ContextKeyExprType.And,
        expr: [{
          serialize: () => 'a',
        }, {
          serialize: () => 'b',
        }],
      };
      keybinding = {
        ...keybinding,
        when: and,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`a && b`);

      const or = {
        getType: () => ContextKeyExprType.Or,
        expr: [{
          serialize: () => 'a',
        }, {
          serialize: () => 'b',
        }],
      };
      keybinding = {
        ...keybinding,
        when: or,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`a || b`);

      const expr = {
        getType: () => ContextKeyExprType.Or,
        expr: [and],
      };
      keybinding = {
        ...keybinding,
        when: expr,
      };
      result =  keybindingRegistry.convertMonacoWhen(keybinding.when);
      expect(result).toBe(`a && b`);
    });
  });
});
