import ReactDom from 'react-dom';

import {
  CommandRegistryImpl,
  CommandRegistry,
  IPreferenceSettingsService,
  PreferenceScope,
  KeybindingRegistryImpl,
  KeybindingRegistry,
} from '@opensumi/ide-core-browser';
import { IToolbarRegistry } from '@opensumi/ide-core-browser/lib/toolbar';
import { IMenuRegistry, MenuRegistryImpl, IMenuItem } from '@opensumi/ide-core-browser/src/menu/next';
import { NextToolbarRegistryImpl } from '@opensumi/ide-core-browser/src/toolbar/toolbar.registry';
import { IActivationEventService, ExtensionBeforeActivateEvent } from '@opensumi/ide-extension/lib/browser/types';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { TabbarService } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';
import { PreferenceSettingsService } from '@opensumi/ide-preferences/lib/browser/preference-settings.service';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { IThemeService, getColorRegistry } from '@opensumi/ide-theme/lib/common';

import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { AbstractExtInstanceManagementService } from '../../../src/browser/types';
import {
  ExtensionService,
  IExtCommandManagement,
  AbstractExtensionManagementService,
  IRequireInterceptorService,
} from '../../../src/common';

import { MOCK_EXTENSIONS, setupExtensionServiceInjector } from './extension-service-mock-helper';

describe('Extension service', () => {
  let extensionService: ExtensionService;
  let extCommandManagement: IExtCommandManagement;
  let extInstanceManagementService: AbstractExtInstanceManagementService;
  let extensionManagementService: AbstractExtensionManagementService;
  let injector: MockInjector;

  beforeAll(() => {
    injector = setupExtensionServiceInjector();
    injector.get(IMainLayoutService).viewReady.resolve();
    extensionService = injector.get(ExtensionService);
    extCommandManagement = injector.get(IExtCommandManagement);
    extInstanceManagementService = injector.get(AbstractExtInstanceManagementService);
    extensionManagementService = injector.get(AbstractExtensionManagementService);
  });

  describe('activate', () => {
    it('should activate extension service.', async (done) => {
      await extensionService.activate();
      done();
    });

    it('emit event before activate', async (done) => {
      // @ts-ignore
      extensionService.eventBus.on(ExtensionBeforeActivateEvent, () => {
        done();
      });

      // @ts-ignore
      await extensionService.doActivate();
    });

    it('emit onStartupFinished activationEvent after activate', async (done) => {
      const activationEventService = injector.get<IActivationEventService>(IActivationEventService);
      activationEventService.onEvent('onStartupFinished', () => {
        done();
      });
      // @ts-ignore
      await extensionService.doActivate();
    });
  });

  describe('get extension', () => {
    it.skip('should return all mock extensions', async () => {
      const exts = await extInstanceManagementService.getExtensionInstances();
      expect(exts).toEqual(MOCK_EXTENSIONS);
    });

    it('should return all mock extensions JSON', async () => {
      const jsons = await extensionManagementService.getAllExtensionJson();
      expect(jsons).toEqual(MOCK_EXTENSIONS.map((e) => e.toJSON()));
    });

    it('should return specified extension props', async () => {
      const extensionMetadata = await extensionManagementService.getExtensionProps(MOCK_EXTENSIONS[0].path, {
        readme: './README.md',
      });
      expect(extensionMetadata?.extraMetadata).toEqual({ readme: './README.md' });
    });

    it('should return extension by extensionId', async () => {
      const extension = extensionManagementService.getExtensionByExtId('test.sumi-extension');
      expect(extension?.extensionId).toBe(MOCK_EXTENSIONS[0].extensionId);
    });
  });

  describe('extension status sync', () => {
    it('should return false when extension is not running', async () => {
      const extension = await extensionManagementService.getExtensionByPath(MOCK_EXTENSIONS[0].path);
      expect(extension?.activated).toBe(false);
    });
  });

  describe('activate extension', () => {
    it('should activate mock browser extension without ext process', async (done) => {
      await extensionService.activeExtension(MOCK_EXTENSIONS[0]);
      const layoutService: IMainLayoutService = injector.get(IMainLayoutService);
      const tabbarService: TabbarService = layoutService.getTabbarService('left');
      const containerInfo = tabbarService.getContainer('test.sumi-extension:Leftview');
      expect(containerInfo?.options?.titleComponent).toBeDefined();
      expect(containerInfo?.options?.titleProps).toBeDefined();
      done();
      // setTimeout(() => {
      // }, 1000);
    });

    it('extension should not repeated activation', async () => {
      const extInstances = await extInstanceManagementService.getExtensionInstances();
      expect(extInstances).toHaveLength(1);
      await extensionManagementService.postChangedExtension(false, MOCK_EXTENSIONS[0].realPath);
      const postExtInstances = await extInstanceManagementService.getExtensionInstances();
      expect(postExtInstances).toHaveLength(1);
    });
  });

  describe('extension contributes', () => {
    it('should register toolbar actions via new toolbar action contribution point', () => {
      const toolbarRegistry: IToolbarRegistry = injector.get(IToolbarRegistry);
      (toolbarRegistry as NextToolbarRegistryImpl).init();
      const groups = toolbarRegistry.getActionGroups('default');
      expect(groups!.length).toBe(1);
      expect(toolbarRegistry.getToolbarActions({ location: 'default', group: groups![0].id })!.actions!.length).toBe(1);
    });

    it('should register shadow command via command contribution point', () => {
      const commandRegistry: CommandRegistryImpl = injector.get(CommandRegistry);
      expect(commandRegistry.getCommand('HelloKaitian')).toBeDefined();
    });

    it('should register menus in editor/title and editor/context position', (done) => {
      const newMenuRegistry: MenuRegistryImpl = injector.get(IMenuRegistry);
      const contextMenu = newMenuRegistry.getMenuItems('editor/context');
      expect(contextMenu.length).toBe(1);
      expect((contextMenu[0] as IMenuItem).command!).toBe('HelloKaitian');
      const actionMenu = newMenuRegistry.getMenuItems('editor/title');
      expect(actionMenu.length).toBe(1);
      expect(actionMenu.findIndex((item) => (item as IMenuItem).command === 'HelloKaitian')).toBeGreaterThan(-1);
      done();
    });

    it('should register viewContainer in activityBar', (done) => {
      const layoutService: LayoutService = injector.get(IMainLayoutService);
      const handler = layoutService.getTabbarHandler('package-explorer');
      expect(handler).toBeDefined();
      const holdHandler = layoutService.getTabbarHandler('hold-container');
      expect(holdHandler).toBeUndefined();
      done();
    });

    it('should register extension configuration', (done) => {
      const preferenceSettingsService: PreferenceSettingsService = injector.get(IPreferenceSettingsService);
      const preferences = preferenceSettingsService.getSections('extension', PreferenceScope.Default);
      expect(preferences.length).toBe(1);
      expect(preferences[0].title).toBe('Mock Extension Config');
      done();
    });

    it('should register browserView', (done) => {
      const layoutService: LayoutService = injector.get(IMainLayoutService);
      const tabbar = layoutService.getTabbarHandler('test.sumi-extension:KaitianViewContribute');
      expect(tabbar).toBeDefined();
      expect(tabbar?.containerId).toBe('test.sumi-extension:KaitianViewContribute');
      done();
    });

    it('should register browserView', (done) => {
      const layoutService: IMainLayoutService = injector.get(IMainLayoutService);
      const tabbar = layoutService.getTabbarHandler('test.sumi-extension:KaitianViewContribute');
      expect(tabbar).toBeDefined();
      done();
    });

    it('should register keybinding for HelloKaitian command', (done) => {
      const keyBinding: KeybindingRegistryImpl = injector.get(KeybindingRegistry);
      const commandKeyBindings = keyBinding.getKeybindingsForCommand('HelloKaitian');
      expect(commandKeyBindings.length).toBe(1);
      expect(typeof commandKeyBindings[0].keybinding).toBe('string');
      done();
    });

    it('should register mock color', async (done) => {
      const themeService: WorkbenchThemeService = injector.get(IThemeService);
      const colorRegister = getColorRegistry();
      const theme = await themeService.getCurrentTheme();
      const color = colorRegister.resolveDefaultColor('mock.superstatus.error', theme);
      expect(color).toBeDefined();
      expect(color?.toString()).toBe('#ff004f');
      done();
    });
  });

  describe('extension host commands', () => {
    it("should define a command in 'node' host.", async (done) => {
      const commandId = 'mock_command';
      const disposable = extCommandManagement.registerExtensionCommandEnv(commandId, 'node');
      const env = extCommandManagement.getExtensionCommandEnv(commandId);
      expect(env).toBe('node');
      disposable.dispose();
      expect(extCommandManagement.getExtensionCommandEnv(commandId)).toBe(undefined);
      done();
    });
  });

  describe('load browser require interceptor contribution', () => {
    it('should get ReactDOM interceptor', async () => {
      // @ts-ignore
      await extensionService.doActivate();
      const requireInterceptorService: IRequireInterceptorService = injector.get(IRequireInterceptorService);
      const interceptor = requireInterceptorService.getRequireInterceptor('ReactDOM');
      const result = interceptor?.load({});
      expect(result).toBe(ReactDom);
    });
  });
});
