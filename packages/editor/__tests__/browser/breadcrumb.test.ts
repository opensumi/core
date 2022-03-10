import { URI, IEventBus } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IEditorDocumentModelService, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { BreadCrumbServiceImpl } from '@opensumi/ide-editor/lib/browser/breadcrumb';
import {
  DocumentSymbol,
  DocumentSymbolChangedEvent,
} from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';
import * as modes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('breadcrumb test', () => {
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.mockService(IFileServiceClient, {
      getFileStat: (uriString: string) => {
        if (uriString.endsWith('testDir1')) {
          return {
            children: [
              {
                uri: 'file:///testDir1/testDir2',
                isDirectory: true,
              },
              {
                uri: 'file:///testDir1/file1.ts',
                isDirectory: false,
              },
            ],
          };
        } else {
          if (uriString.endsWith('testDir2')) {
            return {
              children: [
                {
                  uri: 'file:///testDir1/testDir2/file2.ts',
                  isDirectory: false,
                },
                {
                  uri: 'file:///testDir1/testDir2/file3.ts',
                  isDirectory: false,
                },
              ],
            };
          }
        }
      },
    });

    injector.mockService(IEditorDocumentModelService, {
      createModelReference: (uri) => ({
        instance: {
          uri,
          getMonacoModel: () => ({
            uri,
            getLanguageIdentifier: () => 'javascript',
          }),
        },
        dispose: jest.fn(),
      }),
    });
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('breadcrumb test', async (done) => {
    injector.mockService(WorkbenchEditorService, {});

    const labelService = injector.get(LabelService);
    labelService.getIcon = () => 'icon';

    injector.mockService(IWorkspaceService, {
      workspace: {
        uri: new URI('file:///'),
      },
    });

    const testDS: DocumentSymbol[] = [
      {
        name: 'test1',
        detail: 'test1Detail',
        tags: [],
        kind: modes.SymbolKind.Class,
        containerName: 'test Class',
        range: {
          startColumn: 1,
          endColumn: 10,
          startLineNumber: 1,
          endLineNumber: 10,
        },
        selectionRange: {
          startColumn: 1,
          endColumn: 10,
          startLineNumber: 1,
          endLineNumber: 10,
        },
        children: [
          {
            name: 'test1Method',
            detail: 'test1MethodDetail',
            kind: modes.SymbolKind.Method,
            containerName: 'test1Method',
            tags: [],
            range: {
              startColumn: 4,
              endColumn: 5,
              startLineNumber: 2,
              endLineNumber: 4,
            },
            selectionRange: {
              startColumn: 4,
              endColumn: 5,
              startLineNumber: 2,
              endLineNumber: 4,
            },
          },
        ],
      },
      {
        name: 'test2',
        detail: 'test2Detail',
        kind: modes.SymbolKind.Class,
        containerName: 'test2 Class',
        tags: [],
        range: {
          startColumn: 1,
          endColumn: 11,
          startLineNumber: 1,
          endLineNumber: 21,
        },
        selectionRange: {
          startColumn: 1,
          endColumn: 11,
          startLineNumber: 1,
          endLineNumber: 21,
        },
        children: [
          {
            name: 'test2Method',
            detail: 'test2MethodDetail',
            kind: modes.SymbolKind.Method,
            containerName: 'test2Method',
            tags: [],
            range: {
              startColumn: 4,
              endColumn: 5,
              startLineNumber: 12,
              endLineNumber: 14,
            },
            selectionRange: {
              startColumn: 4,
              endColumn: 5,
              startLineNumber: 12,
              endLineNumber: 14,
            },
          },
        ],
      },
    ];

    modes.DocumentSymbolProviderRegistry['all'] = () => [
      {
        provideDocumentSymbols: () => testDS,
      },
    ];

    const service: BreadCrumbServiceImpl = injector.get(BreadCrumbServiceImpl);

    const res = service.getBreadCrumbs(new URI('file:///testDir1/testDir2/file2.ts'), null)!;
    expect(res.length).toBe(3);
    expect(res[0].name).toBe('testDir1');
    expect(res[1].name).toBe('testDir2');
    expect(res[2].name).toBe('file2.ts');
    // expect(res[3].name).toBe('...');

    const siblingsForTestDir2 = await res[1].getSiblings!();
    expect(siblingsForTestDir2.parts.length).toBe(2);
    expect(siblingsForTestDir2.currentIndex).toBe(0);

    const childrenForTestDir2 = await res[1].getChildren!();
    expect(childrenForTestDir2.length).toBe(2);

    service.getBreadCrumbs(new URI('file:///testDir1/testDir2/file2.ts'), {
      monacoEditor: {
        getPosition: () => ({
          lineNumber: 3,
          column: 10,
        }),
        onDidDispose: jest.fn(),
      },
    } as any)!;

    const eventBus: IEventBus = injector.get(IEventBus);

    eventBus.on(DocumentSymbolChangedEvent, async () => {
      const res2 = service.getBreadCrumbs(new URI('file:///testDir1/testDir2/file2.ts'), {
        monacoEditor: {
          getPosition: () => ({
            lineNumber: 3,
            column: 10,
          }),
          onDidDispose: jest.fn(),
        },
      } as any)!;
      if (res2.length !== 5) {
        return;
      }
      expect(res2.length).toBe(5);
      expect(res2[3].name).toBe('test1');
      expect(res2[4].name).toBe('test1Method');

      const sib = await res2[3].getSiblings!();
      expect(sib.parts.length).toBe(2);
      expect(sib.currentIndex).toBe(0);

      const c = await sib.parts[1].getChildren!();
      expect(c.length).toBe(1);

      done();
    });
  });
});
