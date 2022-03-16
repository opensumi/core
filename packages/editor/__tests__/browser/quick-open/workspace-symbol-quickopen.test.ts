import { SymbolInformation, Location } from 'vscode-languageserver-types';

import { IWorkspaceService } from '@opensumi/ide-workspace';
import { SymbolKind as SymbolKindEnum } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector, mockService } from '../../../../../tools/dev-tool/src/mock-injector';
import { WorkspaceSymbolQuickOpenHandler } from '../../../src/browser/quick-open/workspace-symbol-quickopen';
import {
  ILanguageService,
  WorkspaceSymbolProvider,
  WorkspaceSymbolParams,
  WorkbenchEditorService,
} from '../../../src/common';

class MockWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
  provideWorkspaceSymbols(params: WorkspaceSymbolParams, token): Thenable<SymbolInformation[]> {
    return Promise.resolve([
      {
        name: 'test',
        kind: SymbolKindEnum.Function,
        location: Location.create('', {
          start: { line: 5, character: 23 },
          end: { line: 6, character: 0 },
        }),
      },
      {
        name: 'App',
        kind: SymbolKindEnum.Class,
        location: Location.create('', {
          start: { line: 5, character: 23 },
          end: { line: 6, character: 0 },
        }),
      },
    ]);
  }
  resolveWorkspaceSymbol(symbol: SymbolInformation, token): Thenable<SymbolInformation> {
    if (symbol.name === 'test') {
      return Promise.resolve({
        name: 'test',
        kind: SymbolKindEnum.Function,
        location: Location.create('', {
          start: { line: 5, character: 23 },
          end: { line: 6, character: 0 },
        }),
      });
    } else {
      return Promise.resolve({
        name: 'App',
        kind: SymbolKindEnum.Class,
        location: Location.create('', {
          start: { line: 5, character: 23 },
          end: { line: 6, character: 0 },
        }),
      });
    }
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
          workspaceSymbolProviders: [new MockWorkspaceSymbolProvider()],
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

  it('onType for class', (done) => {
    const model = workspaceSymbolQuickOpenHandler.getModel();
    model.onType('#test', (item) => {
      if (item.length) {
        expect(item.length).toBe(1);
        expect(item[0].getLabel()).toBe('App');
        expect(item[0].getIconClass()).toBe('codicon codicon-symbol-class');
        done();
      }
    });
  });
});
