import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';

import { Injectable, Provider } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import {
  AppConfig,
  BrowserModule,
  Disposable,
  EDITOR_COMMANDS,
  FileUri,
  KeybindingRegistry,
  KeybindingScope,
  KeybindingService,
  URI,
  localize,
  runWhenIdle,
} from '@opensumi/ide-core-browser';
import { MockProgressService } from '@opensumi/ide-core-browser/__mocks__/progress-service';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IDiskFileProvider, IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClientModule } from '@opensumi/ide-file-service/lib/browser';
import { FileServiceContribution } from '@opensumi/ide-file-service/lib/browser/file-service-contribution';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { WatcherProcessManagerToken } from '@opensumi/ide-file-service/lib/node/watcher-process-manager';
import { KeymapsModule } from '@opensumi/ide-keymaps/lib/browser';
import { KeymapService } from '@opensumi/ide-keymaps/lib/browser/keymaps.service';
import { IUserStorageService } from '@opensumi/ide-preferences';
import { UserStorageContribution, UserStorageServiceImpl } from '@opensumi/ide-preferences/lib/browser/userstorage';

@Injectable()
export class AddonModule extends BrowserModule {
  providers: Provider[] = [UserStorageContribution];
}

describe('KeymapsService should be work', () => {
  let keymapsService: KeymapService;
  let injector: MockInjector;
  const keybindingContent = [
    {
      when: 'editorFocus && textInputFocus && !editorReadonly',
      command: 'editor.action.deleteLines',
      keybinding: '⌘+⇧+L',
    },
  ];
  const preferenceDirName = '.sumi';

  const mockKeybindingService = {
    convert: jest.fn(),
    clearConvert: jest.fn(),
    convertMonacoWhen: jest.fn((when: any) => {
      if (typeof when === 'string') {
        return when;
      }
      return '';
    }),
  };
  const mockKeybindingRegistry = {
    getKeybindingsForCommand: jest.fn(() => [
      {
        command: 'test.command',
        keybinding: 'cmd+c',
      },
    ]),
    unregisterKeybinding: jest.fn(),
    registerKeybinding: jest.fn(() => Disposable.create(() => {})),
    acceleratorFor: jest.fn(() => ['CMD+C']),
    validateKeybindingInScope: jest.fn(() => true),
  };

  let userhome: URI | null;

  let onKeybindingsChanged;
  beforeAll(async () => {
    userhome = FileUri.create(path.join(os.tmpdir(), 'keymaps-service-test'));

    await fs.createFile(path.join(userhome.path.toString(), preferenceDirName, 'keymaps.json'));
    await fs.writeJSON(path.join(userhome.path.toString(), preferenceDirName, 'keymaps.json'), keybindingContent);

    injector = createBrowserInjector([FileServiceClientModule, AddonModule, KeymapsModule]);

    injector.overrideProviders(
      {
        token: IUserStorageService,
        useClass: UserStorageServiceImpl,
      },
      {
        token: IDiskFileProvider,
        useClass: DiskFileSystemProvider,
      },
      {
        token: KeybindingService,
        useValue: mockKeybindingService,
      },
      {
        token: KeybindingRegistry,
        useValue: mockKeybindingRegistry,
      },
      {
        token: IProgressService,
        useClass: MockProgressService,
      },
      {
        token: WSChannelHandler,
        useValue: {
          clientId: 'test_client_id',
        },
      },
      {
        token: WatcherProcessManagerToken,
        useValue: {
          setClient: () => void 0,
          watch: (() => 1) as any,
          unWatch: () => void 0,
          createProcess: () => void 0,
        },
      },
      {
        token: AppConfig,
        useValue: {
          preferenceDirName,
        },
      },
    );

    // 覆盖文件系统中的getCurrentUserHome方法，便于用户设置测试
    injector.mock(IFileServiceClient, 'getCurrentUserHome', () => ({
      uri: userhome!.toString(),
      isDirectory: true,
      lastModification: new Date().getTime(),
    }));

    onKeybindingsChanged = jest.fn();
    injector.mock(KeybindingRegistry, 'onKeybindingsChanged', onKeybindingsChanged);

    const fileServiceContribution = injector.get(FileServiceContribution);
    const userStorageContribution = injector.get(UserStorageContribution);

    await fileServiceContribution.initialize();
    await userStorageContribution.initialize();

    keymapsService = injector.get(KeymapService);

    await keymapsService.init();
  });

  afterAll(async () => {
    if (userhome) {
      await fs.remove(userhome.path.toString());
    }
    userhome = null;
    await injector.disposeAll();
  });

  describe('01 #Init', () => {
    it('should ready to work after init', async () => {
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
    });
  });

  describe('02 #API should be work', () => {
    it('open method should be work', async () => {
      const open = jest.fn();
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, open);
      await keymapsService.open();
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('openResource method should be work', async () => {
      const openResource = jest.fn();
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openResource);
      await keymapsService.openResource();
      expect(openResource).toHaveBeenCalledTimes(1);
    });

    it('fix method should be work', async () => {
      const open = jest.fn();
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, open);
      await keymapsService.fixed();
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('covert method should be work', async () => {
      await keymapsService.covert({} as any);
      expect(mockKeybindingService.convert).toHaveBeenCalledTimes(1);
    });

    it('clearConvert method should be work', async () => {
      await keymapsService.clearCovert();
      expect(mockKeybindingService.clearConvert).toHaveBeenCalledTimes(1);
    });

    it('reconcile method should be work', async () => {
      mockKeybindingRegistry.registerKeybinding.mockClear();
      mockKeybindingRegistry.unregisterKeybinding.mockClear();
      mockKeybindingRegistry.getKeybindingsForCommand.mockClear();
      const keybindings = [
        {
          command: 'test.command',
          key: 'cmd+c',
        },
      ];
      await keymapsService.reconcile(keybindings);
      runWhenIdle(() => {
        expect(mockKeybindingRegistry.getKeybindingsForCommand).toHaveBeenCalledTimes(1);
        expect(mockKeybindingRegistry.unregisterKeybinding).toHaveBeenCalledTimes(1);
        expect(mockKeybindingRegistry.registerKeybinding).toHaveBeenCalledTimes(1);
      });
    });

    it('setKeybinding method should be work', async () => {
      mockKeybindingRegistry.registerKeybinding.mockClear();
      const rawkeybinding = {
        command: 'test.command',
        keybinding: 'cmd+shift+c',
      };
      const keybinding = {
        command: 'test.command',
        keybinding: 'cmd+c',
      };
      await keymapsService.setKeybinding(rawkeybinding, keybinding);
      expect(mockKeybindingRegistry.registerKeybinding).toHaveBeenCalledTimes(1);
    });

    it('getKeybindings method should be work', async () => {
      const list = await keymapsService.getKeybindings();
      expect(list?.length).toBeGreaterThan(0);
    });

    it('resetKeybinding method should be work', async () => {
      mockKeybindingRegistry.registerKeybinding.mockClear();
      const keybinding = {
        command: 'test.command',
        keybinding: 'cmd+c',
      };
      await keymapsService.resetKeybinding(keybinding);
      expect(mockKeybindingRegistry.registerKeybinding).toHaveBeenCalledTimes(1);
    });

    it('getWhen method should be work', () => {
      const keybinding = {
        command: 'test.command',
        keybinding: 'cmd+c',
        when: 'focus' as any,
      };
      mockKeybindingService.convertMonacoWhen.mockClear();
      const result = keymapsService.getWhen(keybinding);
      expect(result).toBe(keybinding.when);
      expect(mockKeybindingService.convertMonacoWhen).toHaveBeenCalledTimes(1);
    });

    it('getScope method should be work', () => {
      expect(keymapsService.getScope(KeybindingScope.DEFAULT)).toBe(localize('keymaps.source.default'));
      expect(keymapsService.getScope(KeybindingScope.USER)).toBe(localize('keymaps.source.user'));
      expect(keymapsService.getScope(KeybindingScope.WORKSPACE)).toBe(localize('keymaps.source.workspace'));
    });

    it('getKeybindingItems method should be work', () => {
      const items = keymapsService.getKeybindingItems();
      expect(items.length).toBe(1);
    });

    it('validateKeybinding method should be work', () => {
      const items = keymapsService.getKeybindingItems();
      keymapsService.validateKeybinding(items[0], 'cmd+c');
      expect(mockKeybindingRegistry.validateKeybindingInScope).toHaveBeenCalledTimes(1);
    });

    it('detectKeybindings method should be work', () => {
      const items = keymapsService.getKeybindingItems();
      const detectKeybindings = keymapsService.detectKeybindings(
        {
          ...items[0],
          keybinding: 'CMD+D',
        },
        'CMD+C',
      );
      expect(detectKeybindings.length).toBe(1);
    });

    it('filter monaco.editor from storeKeybindings', () => {
      keymapsService.storeKeybindings = [
        {
          command: 'monaco.editor.action.quickCommand',
          key: 'cmd+c',
        },
      ];
      expect(keymapsService.storeKeybindings[0].command === 'editor.action.quickCommand');
    });
  });
});
