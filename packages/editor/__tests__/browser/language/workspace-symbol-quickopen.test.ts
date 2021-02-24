import { MockInjector, mockService } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { WorkspaceSymbolQuickOpenHandler } from '../../../src/browser/language/workspace-symbol-quickopen';
import { ILanguageService, WorkspaceSymbolProvider, WorkspaceSymbolParams, WorkbenchEditorService } from '../../../src/common';
import { SymbolInformation, Location } from 'vscode-languageserver-types';
import { SymbolKind } from '@ali/ide-core-common';
import { IWorkspaceService } from '@ali/ide-workspace';

class MockWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
  provideWorkspaceSymbols(params: WorkspaceSymbolParams, token): Thenable<SymbolInformation[]> {
    return Promise.resolve([{
      name: 'test',
      kind: SymbolKind.Function,
      location: Location.create('', {
        start: { line: 5, character: 23 },
        end : { line: 6, character : 0 },
      }),
    }]);
  }
  resolveWorkspaceSymbol(symbol: SymbolInformation, token): Thenable<SymbolInformation> {
    return Promise.resolve({
      name: 'test',
      kind: SymbolKind.Function,
      location: Location.create('', {
        start: { line: 5, character: 23 },
        end : { line: 6, character : 0 },
      }),
    });
  }
}

describe('workspace-symbol-quickopen', () => {

  let injector: MockInjector;
  let workspaceSymbolQuickOpenHandler: WorkspaceSymbolQuickOpenHandler;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      WorkspaceSymbolQuickOpenHandler,
      {
        token: ILanguageService,
        useValue: mockService({
          workspaceSymbolProviders: [
            new MockWorkspaceSymbolProvider(),
          ],
        }),
      },
      {
        token: IWorkspaceService,
        useValue: mockService({
          asRelativePath: () => '',
        }),
      },
      {
        token: WorkbenchEditorService,
        useValue: mockService({}),
      },
    );
    workspaceSymbolQuickOpenHandler = injector.get(WorkspaceSymbolQuickOpenHandler);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('onType', (done) => {
    const model = workspaceSymbolQuickOpenHandler.getModel();
    model.onType('test', (item) => {
      if (item.length) {
        expect(item[0].getLabel()).toBe('test');
        expect(item[0].getIconClass()).toBe('codicon codicon-symbol-function');
        done();
      }
    });
  });
});
