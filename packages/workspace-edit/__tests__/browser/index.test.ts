import { URI } from '@opensumi/ide-core-browser';
import { IEditorGroup, WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { FileSystemError, IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { Uri } from '@opensumi/ide-monaco';
import { createMockedMonaco } from '@opensumi/ide-monaco/__mocks__/monaco';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { WorkspaceEditModule } from '../../src/browser';
import { MonacoBulkEditService } from '../../src/browser/bulk-edit.service';
import { IResourceFileEdit, IWorkspaceEditService, IWorkspaceFileService } from '../../src/common';

import type {
  IBulkEditOptions,
  ResourceEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';

function mockService(target) {
  return new Proxy(target, {
    get: (t, p) => {
      if (p === 'hasOwnProperty') {
        return t[p];
      }
      // eslint-disable-next-line no-prototype-builtins
      if (!t.hasOwnProperty(p)) {
        t[p] = jest.fn();
      }
      return t[p];
    },
  });
}

describe('workspace edit tests', () => {
  const monaco = createMockedMonaco();

  beforeAll(() => {
    (global as any).monaco = monaco;
  });

  afterAll(() => {
    (global as any).monaco = undefined;
  });

  const injector = createBrowserInjector([WorkspaceEditModule]);
  const editorGroups: IEditorGroup[] = [];
  const files = new Set<string>();
  injector.addProviders(
    {
      token: IEditorDocumentModelService,
      useValue: mockService({
        createModelReference: jest.fn((uri) => ({
          instance: {
            getMonacoModel: jest.fn(() => monaco.editor.createModel!('', undefined, Uri.parse(uri.toString()))),
            updateContent: jest.fn(),
            dispose: jest.fn(),
            save: jest.fn(),
          },
          dispose: jest.fn(),
        })),
        getModelReference: jest.fn((uri) => ({
          instance: {
            getMonacoModel: jest.fn(() => monaco.editor.createModel!('', undefined, Uri.parse(uri.toString()))),
            updateContent: jest.fn(),
            dispose: jest.fn(),
          },
          dispose: jest.fn(),
        })),
      }),
    },
    {
      token: WorkbenchEditorService,
      useValue: mockService({
        currentEditor: undefined,
        editorGroups,
      }),
    },
    {
      token: IFileServiceClient,
      useValue: mockService({
        access: (uri: URI) => true,
        createFile: jest.fn((uri: string, options: { overwrite?: boolean } = {}) => {
          if (files.has(uri)) {
            if (options.overwrite) {
              return {
                uri,
              };
            } else {
              throw FileSystemError.FileExists(uri);
            }
          } else {
            files.add(uri);
          }
        }),
      }),
    },
  );

  it('resource edit tests', async () => {
    const service: IWorkspaceEditService = injector.get(IWorkspaceEditService);
    await service.apply({
      edits: [
        {
          resource: new URI('file:///test.ts'),
          textEdit: {
            range: {
              startColumn: 1,
              endColumn: 1,
              startLineNumber: 1,
              endLineNumber: 1,
            },
            text: 'test',
          },
        },
        {
          resource: new URI('file:///test.ts'),
          textEdit: {
            range: {
              startColumn: 1,
              endColumn: 1,
              startLineNumber: 1,
              endLineNumber: 1,
            },
            text: 'test2',
          },
        },
        {
          resource: new URI('file:///test2.ts'),
          textEdit: {
            range: {
              startColumn: 1,
              endColumn: 1,
              startLineNumber: 1,
              endLineNumber: 1,
            },
            text: 'test2',
          },
          options: {
            openDirtyInEditor: true,
          },
        },
      ],
    });

    const model = monaco.editor.getModel(Uri.parse('file:///test.ts'))!;
    expect(model.pushEditOperations).toHaveBeenCalled();
    expect(model.pushStackElement).toHaveBeenCalled();

    expect(injector.get(WorkbenchEditorService).open).toHaveBeenCalled();
  });

  it('file edit tests', async () => {
    const service: IWorkspaceEditService = injector.get(IWorkspaceEditService);
    const fileServiceClient = injector.get<IFileServiceClient>(IFileServiceClient);
    const workspaceFileService: IWorkspaceFileService = injector.get(IWorkspaceFileService);

    editorGroups.splice(0, editorGroups.length);
    editorGroups.push({
      resources: [
        {
          uri: new URI('file:///oldTest.ts'),
          name: 'oldTest.ts',
          icon: '',
        },
      ],
      open: jest.fn(),
      close: jest.fn(),
    } as any);

    const moveEdit: IResourceFileEdit = {
      newResource: new URI('file:///newTest.ts'),
      oldResource: new URI('file:///oldTest.ts'),
      options: {
        overwrite: true,
      },
    };

    const createEdit: IResourceFileEdit = {
      newResource: new URI('file:///createTest.ts'),
      options: {
        overwrite: true,
        showInEditor: true,
      },
    };

    const deleteEdit: IResourceFileEdit = {
      oldResource: new URI('file:///deleteTest.ts'),
      options: {
        overwrite: true,
      },
    };

    injector.mock(
      IFileServiceClient,
      'exists',
      jest.fn((uri: URI) => true),
    );

    const mockParticipant = jest.fn();
    const mockWillCall = jest.fn();
    const mockDidCall = jest.fn();
    workspaceFileService.registerFileOperationParticipant({
      participate: async (files, operation, progress, timeout, token) => {
        mockParticipant();
      },
    });
    workspaceFileService.onWillRunWorkspaceFileOperation(mockWillCall);
    workspaceFileService.onDidRunWorkspaceFileOperation(mockDidCall);

    await service.apply({
      edits: [moveEdit, createEdit, deleteEdit],
    });

    expect(fileServiceClient.move).toHaveBeenLastCalledWith(
      moveEdit.oldResource!.toString(),
      moveEdit.newResource!.toString(),
      expect.objectContaining({
        overwrite: true,
      }),
    );

    expect(fileServiceClient.createFile).toHaveBeenLastCalledWith(
      createEdit.newResource!.toString(),
      expect.objectContaining({
        content: '',
        overwrite: true,
      }),
    );

    expect(fileServiceClient.delete).toHaveBeenLastCalledWith(
      deleteEdit.oldResource!.toString(),
      expect.objectContaining({}),
    );

    expect(mockParticipant).toHaveBeenCalledTimes(3);
    expect(mockWillCall).toHaveBeenCalledTimes(3);
    expect(mockDidCall).toHaveBeenCalledTimes(3);

    // 已存在的文件，不添加 ignoreIfExists 和 overwrite 选项， 应该抛出文件已存在的问题
    const createEdit2: IResourceFileEdit = {
      newResource: new URI('file:///createTest.ts'),
      options: {},
    };

    let error: Error | undefined;
    await service
      .apply({
        edits: [createEdit2],
      })
      .catch((err) => {
        error = err;
      });

    expect(error).toBeDefined();
    expect(FileSystemError.FileExists.is(error as any)).toBe(true);

    // 添加 ignoreIfExists 应该正常执行不抛出错误
    const createEdit3: IResourceFileEdit = {
      newResource: new URI('file:///createTest.ts'),
      options: {
        ignoreIfExists: true,
      },
    };
    error = undefined;
    await service.apply({
      edits: [createEdit3],
    });
  });

  it('monaco bulk edit test', async () => {
    const monacoBulkEditService: MonacoBulkEditService = injector.get(MonacoBulkEditService);
    const fileServiceClient = injector.get<IFileServiceClient>(IFileServiceClient);

    await monacoBulkEditService.apply([
      {
        resource: Uri.parse('file:///monaco-test.ts'),
        textEdit: {
          range: {
            startColumn: 1,
            endColumn: 1,
            startLineNumber: 1,
            endLineNumber: 1,
          },
          text: 'test',
        },
      },
      {
        newResource: Uri.parse('file:///monaco.newTest.ts'),
        oldResource: Uri.parse('file:///monaco.oldTest.ts'),
        options: {
          overwrite: true,
        },
      },
    ] as unknown as ResourceEdit[]);

    expect(fileServiceClient.move).toHaveBeenLastCalledWith(
      'file:///monaco.oldTest.ts',
      'file:///monaco.newTest.ts',
      expect.objectContaining({
        overwrite: true,
      }),
    );

    const model = monaco.editor.getModel(Uri.parse('file:///monaco-test.ts'))!;

    expect(model.pushEditOperations).toHaveBeenCalled();
    expect(model.pushStackElement).toHaveBeenCalled();
  });

  it('monaco bulk edit preview test', async () => {
    const mockedPreviewFn = jest.fn(
      (edits: ResourceEdit[], options?: IBulkEditOptions): Promise<ResourceEdit[]> => Promise.resolve(edits),
    );
    const monacoBulkEditService: MonacoBulkEditService = injector.get(MonacoBulkEditService);
    monacoBulkEditService.setPreviewHandler(mockedPreviewFn);

    await monacoBulkEditService.apply(
      [
        {
          resource: Uri.parse('file:///monaco-test-2.ts'),
          textEdit: {
            range: {
              startColumn: 1,
              endColumn: 1,
              startLineNumber: 1,
              endLineNumber: 1,
            },
            text: 'test1',
          },
        },
      ] as unknown as ResourceEdit[],
      { showPreview: true },
    );

    const model = monaco.editor.getModel(Uri.parse('file:///monaco-test-2.ts'))!;
    expect(model.pushEditOperations).toHaveBeenCalled();
    expect(model.pushStackElement).toHaveBeenCalled();

    expect(injector.get(WorkbenchEditorService).open).toHaveBeenCalled();

    expect(mockedPreviewFn).toHaveBeenCalled();
  });

  it('monaco bulk edit metadata needsConfirmation test', async () => {
    const mockedPreviewFn = jest.fn(
      (edits: ResourceEdit[], options?: IBulkEditOptions): Promise<ResourceEdit[]> => Promise.resolve(edits),
    );
    const monacoBulkEditService: MonacoBulkEditService = injector.get(MonacoBulkEditService);
    monacoBulkEditService.setPreviewHandler(mockedPreviewFn);

    await monacoBulkEditService.apply([
      {
        resource: Uri.parse('file:///monaco-test-3.ts'),
        textEdit: {
          range: {
            startColumn: 1,
            endColumn: 1,
            startLineNumber: 1,
            endLineNumber: 1,
          },
          text: 'test1',
        },
        metadata: {
          needsConfirmation: true,
        },
      },
    ] as unknown as ResourceEdit[]);

    const model = monaco.editor.getModel(Uri.parse('file:///monaco-test-3.ts'))!;
    expect(model.pushEditOperations).toHaveBeenCalled();
    expect(model.pushStackElement).toHaveBeenCalled();

    expect(injector.get(WorkbenchEditorService).open).toHaveBeenCalled();

    expect(mockedPreviewFn).toHaveBeenCalled();
  });
});
