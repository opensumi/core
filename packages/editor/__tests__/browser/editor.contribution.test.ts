import { CommandRegistry, CommandService, EDITOR_COMMANDS, FILE_COMMANDS, URI } from '@opensumi/ide-core-browser';
import { MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { EditorModule } from '@opensumi/ide-editor/lib/browser';
import {
  EditorAutoSaveEditorContribution,
  EditorContribution,
} from '@opensumi/ide-editor/lib/browser/editor.contribution';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('Editor contribution should be work', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([EditorModule]);
  });

  describe('01 #contribution should be work', () => {
    it('should registerCommands be work', () => {
      const contribution = injector.get(EditorContribution);
      const register = jest.fn();
      contribution.registerCommands({ registerCommand: register } as any);
      expect(register).toHaveBeenCalled();
    });

    it('should recive correct command arguments', async () => {
      const contribution = injector.get(EditorAutoSaveEditorContribution);
      const mockCopyRelativePath = jest.fn();
      injector.mockCommand(FILE_COMMANDS.COPY_RELATIVE_PATH.id, mockCopyRelativePath);
      const registry = injector.get<CommandRegistry>(CommandRegistry);
      contribution.registerCommands(registry);
      const commandService = injector.get<CommandService>(CommandService);
      const resource = {
        uri: new URI('/test.js'),
      };
      await commandService.executeCommand(EDITOR_COMMANDS.COPY_RELATIVE_PATH.id, resource);
      expect(mockCopyRelativePath).toHaveBeenCalledWith(resource.uri);
    });

    it('should toggle the active pinned tab and protect keyboard close', async () => {
      const uri = new URI('test://pin/command');
      const group = {
        currentResource: { uri },
        togglePinTab: jest.fn(),
        pinPreviewed: jest.fn(),
        isPinned: jest.fn(() => true),
        activateFirstUnpinned: jest.fn(async () => true),
        close: jest.fn(),
      };
      injector.mockService(WorkbenchEditorService, { currentEditorGroup: group });
      const contribution = injector.get(EditorContribution);
      const registry = injector.get<CommandRegistry>(CommandRegistry);
      contribution.registerCommands(registry);
      const commandService = injector.get<CommandService>(CommandService);

      await commandService.executeCommand(EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id);
      expect(group.togglePinTab).toHaveBeenCalledWith(uri);

      await commandService.executeCommand(EDITOR_COMMANDS.PIN_CURRENT.id);
      expect(group.pinPreviewed).toHaveBeenCalled();

      await commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id);
      expect(group.activateFirstUnpinned).toHaveBeenCalled();
      expect(group.close).not.toHaveBeenCalled();

      const explicitUri = new URI('test://pin/explicit-command');
      await commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, explicitUri);
      expect(group.close).toHaveBeenCalledWith(explicitUri);

      await commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, { group, uri });
      expect(group.close).toHaveBeenCalledWith(uri);

      const keybindings = { registerKeybinding: jest.fn() };
      contribution.registerKeybindings(keybindings as any);
      expect(keybindings.registerKeybinding).toHaveBeenCalledWith({
        command: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id,
        keybinding: 'ctrlcmd+k shift+enter',
      });

      const menus = { registerMenuItem: jest.fn() };
      contribution.registerMenus(menus as any);
      expect(menus.registerMenuItem).toHaveBeenCalledWith(
        MenuId.EditorTitleContext,
        expect.objectContaining({
          command: expect.objectContaining({ id: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id }),
          when: '!editorTabPinned',
        }),
      );
      expect(menus.registerMenuItem).toHaveBeenCalledWith(
        MenuId.EditorTitleContext,
        expect.objectContaining({
          command: expect.objectContaining({ id: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id }),
          when: 'editorTabPinned',
        }),
      );
    });

    it('should toggle the clicked inactive tab without activating it', async () => {
      const activeUri = new URI('test://pin/active');
      const clickedUri = new URI('test://pin/clicked');
      const currentResource = { uri: activeUri };
      const group = {
        currentResource,
        togglePinTab: jest.fn(),
        open: jest.fn(),
        focus: jest.fn(),
      };
      const workbenchOpen = jest.fn();
      injector.mockService(WorkbenchEditorService, { currentEditorGroup: group, open: workbenchOpen });
      const contribution = injector.get(EditorContribution);
      const registry = injector.get<CommandRegistry>(CommandRegistry);
      contribution.registerCommands(registry);

      await injector
        .get<CommandService>(CommandService)
        .executeCommand(EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id, { group, uri: clickedUri });

      expect(group.togglePinTab).toHaveBeenCalledWith(clickedUri);
      expect(group.open).not.toHaveBeenCalled();
      expect(group.focus).not.toHaveBeenCalled();
      expect(workbenchOpen).not.toHaveBeenCalled();
      expect(group.currentResource).toBe(currentResource);
    });

    it('should keep the pinned resource open when no ordinary tab can be activated', async () => {
      const uri = new URI('test://pin/only-pinned');
      const currentResource = { uri };
      const group = {
        currentResource,
        isPinned: jest.fn(() => true),
        activateFirstUnpinned: jest.fn(async () => false),
        close: jest.fn(),
      };
      injector.mockService(WorkbenchEditorService, { currentEditorGroup: group });
      const contribution = injector.get(EditorContribution);
      const registry = injector.get<CommandRegistry>(CommandRegistry);
      contribution.registerCommands(registry);

      await injector.get<CommandService>(CommandService).executeCommand(EDITOR_COMMANDS.CLOSE.id);

      expect(group.activateFirstUnpinned).toHaveBeenCalledTimes(1);
      expect(group.close).not.toHaveBeenCalled();
      expect(group.currentResource).toBe(currentResource);
    });
  });
});
