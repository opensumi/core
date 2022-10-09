import { CommandRegistry, CommandService, EDITOR_COMMANDS, FILE_COMMANDS, URI } from '@opensumi/ide-core-browser';
import { EditorModule } from '@opensumi/ide-editor/lib/browser';
import {
  EditorAutoSaveEditorContribution,
  EditorContribution,
} from '@opensumi/ide-editor/lib/browser/editor.contribution';

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
      expect(register).toBeCalled();
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
      expect(mockCopyRelativePath).toBeCalledWith(resource.uri);
    });
  });
});
