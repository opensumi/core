import { KeymapService } from '../../src/browser/keymaps.service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { KeymapsParser } from '../../src/browser/keymaps-parser';
import { ResourceProvider, KeybindingRegistry, CommandService, KeybindingService, URI, KeybindingScope, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { UserStorageUri } from '@ali/ide-userstorage/lib/browser';
import { KEYMAPS_FILE_NAME } from '../../src';

describe('KeymapsService should be work', () => {
  let keymapsService: KeymapService;
  let injector: MockInjector;
  let keybindingContent;
  let resourceProvider;

  let onKeybindingsChanged;
  let setKeymap;
  beforeEach(() => {
    injector = createBrowserInjector([]);

    // mock used instance
    injector.overrideProviders(
      {
        token: KeymapsParser,
        useClass: KeymapsParser,
      },
      {
        token: ResourceProvider,
        useValue: {},
      },
      {
        token: KeybindingService,
        useValue: {},
      },
      {
        token: KeybindingRegistry,
        useValue: {},
      },
    );

    injector.addProviders({
      token: KeymapService,
      useClass: KeymapService,
    });

    keybindingContent = '{}';
    resourceProvider = jest.fn(() => ({
      readContents: () => keybindingContent,
    }));
    injector.overrideProviders({
      token: ResourceProvider,
      useValue: resourceProvider,
    });
    onKeybindingsChanged = jest.fn();
    setKeymap = jest.fn();
    injector.mock(KeybindingRegistry, 'onKeybindingsChanged', onKeybindingsChanged);
    injector.mock(KeybindingRegistry, 'setKeymap', setKeymap);

    keymapsService = injector.get(KeymapService);

  });

  afterEach(async () => {
    injector.disposeAll();
  });

  describe('01 #Init', () => {

    it('should ready to work after init', () => {

      expect(resourceProvider).toBeCalledWith(new URI().withScheme(UserStorageUri.SCHEME).withPath(KEYMAPS_FILE_NAME));
      expect(setKeymap).toBeCalledWith(KeybindingScope.USER, []);

      expect(typeof keymapsService.init).toBe('function');
      expect(typeof keymapsService.dispose).toBe('function');
      expect(typeof keymapsService.reconcile).toBe('function');
      expect(typeof keymapsService.setKeybinding).toBe('function');
      expect(typeof keymapsService.covert).toBe('function');
      expect(typeof keymapsService.removeKeybinding).toBe('function');
      expect(typeof keymapsService.getKeybindings).toBe('function');
      expect(typeof keymapsService.open).toBe('function');
      expect(typeof keymapsService.getWhen).toBe('function');
      expect(typeof keymapsService.getScope).toBe('function');
      expect(typeof keymapsService.getKeybindingItems).toBe('function');
      expect(typeof keymapsService.searchKeybindings).toBe('function');
      expect(typeof keymapsService.validateKeybinding).toBe('function');
      expect(typeof keymapsService.getRaw).toBe('function');
    });
  });

  describe('02 #API should be work', () => {

    it('open should be work', async (done) => {
      const open = jest.fn();
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, open);
      await keymapsService.open();
      expect(open).toBeCalledTimes(1);
      done();
    });
  });
});
