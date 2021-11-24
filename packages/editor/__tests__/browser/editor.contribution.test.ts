import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { EditorModule } from '@opensumi/ide-editor/lib/browser';
import { EditorContribution } from '@opensumi/ide-editor/lib/browser/editor.contribution';

describe('Editor contribution should be work', () => {
  let mockInjector: MockInjector;

  beforeEach(() => {
    mockInjector = createBrowserInjector([
      EditorModule,
    ]);
  });

  describe('01 #contribution should be work', () => {
    it('should registerCommands be work', () => {
      const contribution = mockInjector.get(EditorContribution);
      const register = jest.fn();
      contribution.registerCommands({ registerCommand: register } as any);
      expect(register).toBeCalled();
    });

  });

});
