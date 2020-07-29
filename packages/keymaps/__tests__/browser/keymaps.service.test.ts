import { KeymapService } from '@ali/ide-keymaps/lib/browser/keymaps.service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { KeymapsParser } from '@ali/ide-keymaps/lib/browser/keymaps-parser';
import { ResourceProvider, KeybindingRegistry, KeybindingService, URI, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { KEYMAPS_FILE_NAME } from '@ali/ide-keymaps';
import { USER_STORAGE_SCHEME } from '@ali/ide-preferences';
import { KeymapsModule } from '@ali/ide-keymaps/lib/browser';

describe('KeymapsService should be work', () => {
  let keymapsService: KeymapService;
  let injector: MockInjector;
  let keybindingContent;
  let resourceProvider;

  let onKeybindingsChanged;
  beforeEach(() => {
    injector = createBrowserInjector([
      KeymapsModule,
    ]);

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

    keybindingContent = '{}';
    resourceProvider = jest.fn(() => ({
      readContents: () => keybindingContent,
    }));
    injector.overrideProviders({
      token: ResourceProvider,
      useValue: resourceProvider,
    });
    onKeybindingsChanged = jest.fn();
    injector.mock(KeybindingRegistry, 'onKeybindingsChanged', onKeybindingsChanged);

    keymapsService = injector.get(KeymapService);

    keymapsService.init();

  });

  afterEach(async () => {
    injector.disposeAll();
  });

  describe('01 #Init', () => {

    it('should ready to work after init', async (done) => {

      expect(resourceProvider).toBeCalledWith(new URI().withScheme(USER_STORAGE_SCHEME).withPath(KEYMAPS_FILE_NAME));

      expect(typeof keymapsService.init).toBe('function');
      expect(typeof keymapsService.dispose).toBe('function');
      expect(typeof keymapsService.reconcile).toBe('function');
      expect(typeof keymapsService.setKeybinding).toBe('function');
      expect(typeof keymapsService.covert).toBe('function');
      expect(typeof keymapsService.resetKeybinding).toBe('function');
      expect(typeof keymapsService.getKeybindings).toBe('function');
      expect(typeof keymapsService.open).toBe('function');
      expect(typeof keymapsService.getWhen).toBe('function');
      expect(typeof keymapsService.getScope).toBe('function');
      expect(typeof keymapsService.getKeybindingItems).toBe('function');
      expect(typeof keymapsService.searchKeybindings).toBe('function');
      expect(typeof keymapsService.validateKeybinding).toBe('function');
      expect(typeof keymapsService.getRaw).toBe('function');
      done();
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
