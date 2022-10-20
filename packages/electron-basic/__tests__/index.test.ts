import {
  AppConfig,
  SlotLocation,
  ComponentRegistry,
  CommandRegistry,
  KeybindingRegistry,
  arrays,
  electronEnv,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { WorkbenchEditorService, ResourceService } from '@opensumi/ide-editor';
import { EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { createElectronBasicInjector } from '../__mocks__';
import { mockService } from '../__mocks__/utils';
import { ElectronBasicContribution } from '../src/browser';
import { ElectronNativeDialogService } from '../src/browser/dialog';
import { WelcomeContribution } from '../src/browser/welcome/contribution';

const { addElement } = arrays;

describe('electron basic contribution test', () => {
  const injector = createElectronBasicInjector();
  beforeAll(() => {
    (global as any).electronEnv = (global as any).electronEnv || {};
  });

  it('component resgiter', () => {
    const contribution = injector.get(ElectronBasicContribution);
    const registry: ComponentRegistry = {
      register: jest.fn(),
      getComponentRegistryInfo: jest.fn(),
    };
    contribution.registerComponent(registry);

    const appConfig = injector.get(AppConfig) as AppConfig;
    expect(appConfig.layoutConfig[SlotLocation.top].modules[0]).toBe('electron-header');

    expect(registry.register).toBeCalledTimes(1);
  });

  it('menu register', () => {
    const contribution = injector.get(ElectronBasicContribution);
    const menuItems: any[] = [];
    const registry: IMenuRegistry = {
      registerMenuItem: jest.fn((item) => {
        menuItems.push(item);
      }),
      registerMenuItems: jest.fn(),
      registerMenubarItem: jest.fn(),
    } as any;

    contribution.registerMenus(registry);

    expect(registry.registerMenuItem).toBeCalled();
  });

  it('command register', async () => {
    const contribution = injector.get(ElectronBasicContribution);
    const commands: { command: any; handler: { execute: () => any } }[] = [];
    const registry: CommandRegistry = {
      registerCommand: jest.fn((command, handler) => {
        commands.push({
          command,
          handler,
        });
        return {
          dispose: () => undefined,
        };
      }),
    } as any;

    contribution.registerCommands(registry);

    expect(registry.registerCommand).toBeCalled();

    await Promise.all(
      commands.map(async (c) => {
        await c.handler.execute();
      }),
    );
  });

  it('keyBinding register', () => {
    const contribution = injector.get(ElectronBasicContribution);
    const keybindings: any[] = [];
    const registry: KeybindingRegistry = {
      registerKeybinding: jest.fn((keybinding) => addElement(keybindings, keybinding)),
    } as any;

    contribution.registerKeybindings(registry);

    expect(registry.registerKeybinding).toBeCalled();
  });
});

describe('native dialog test', () => {
  const injector = createBrowserInjector([]);
  injector.addProviders({
    token: IElectronMainUIService,
    useValue: mockService({}),
  });

  it('should pass arguments to electron main service', () => {
    const windowId = Math.floor(Math.random() * 100);
    electronEnv.currentWindowId = windowId;
    const dialogService = injector.get(ElectronNativeDialogService);
    const optionA = {};
    dialogService.showOpenDialog(optionA);
    expect(injector.get(IElectronMainUIService).showOpenDialog).toBeCalledWith(windowId, optionA);

    const optionB = {};
    dialogService.showSaveDialog(optionB);
    expect(injector.get(IElectronMainUIService).showSaveDialog).toBeCalledWith(windowId, optionB);
  });
});

describe('welcomeContribution test', () => {
  const injector = createBrowserInjector([]);
  injector.addProviders(
    {
      token: IWorkspaceService,
      useValue: mockService({ workspace: undefined }),
    },
    {
      token: WorkbenchEditorService,
      useValue: mockService({}),
    },
  );
  it('basic register', () => {
    const contribution = injector.get(WelcomeContribution) as WelcomeContribution;

    const editorComponentRegistry: EditorComponentRegistry = mockService({});
    const resourceService: ResourceService = mockService({});

    contribution.registerEditorComponent(editorComponentRegistry);
    expect(editorComponentRegistry.registerEditorComponent).toBeCalled();
    expect(editorComponentRegistry.registerEditorComponentResolver).toBeCalled();

    contribution.registerResource(resourceService);
    expect(resourceService.registerResourceProvider).toBeCalled();

    contribution.onDidStart();
    expect(injector.get(WorkbenchEditorService).open).toBeCalled();
  });
});
