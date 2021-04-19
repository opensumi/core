import type { IBulkEditOptions } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import type { WorkspaceEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { WorkbenchEditorService, IEditorGroup } from '@ali/ide-editor';
import { URI } from '@ali/ide-core-browser';
import { IWorkspaceEditService, IResourceFileEdit, IWorkspaceFileService} from '../src/common';
import { IFileServiceClient, FileSystemError } from '@ali/ide-file-service/lib/common';
import { WorkspaceEditModule } from '../src/browser';
import { MonacoBulkEditService } from '../src/browser/bulk-edit.service';

function mockService(target) {
  return new Proxy(target, {
    get: (t, p) => {
      if (p === 'hasOwnProperty') {
        return t[p];
      }
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
  injector.addProviders({
    token: IEditorDocumentModelService,
    useValue: mockService({
      createModelReference: jest.fn((uri) => {
        return {
          instance: {
            getMonacoModel: jest.fn(() => monaco.editor!.createModel!('', undefined, monaco.Uri!.parse(uri.toString()))),
            updateContent: jest.fn(),
            dispose: jest.fn(),
            save: jest.fn(),
          },
          dispose: jest.fn(),
        };
      }),
      getModelReference: jest.fn((uri) => {
        return {
          instance: {
            getMonacoModel: jest.fn(() => monaco.editor!.createModel!('', undefined, monaco.Uri!.parse(uri.toString()))),
            updateContent: jest.fn(),
            dispose: jest.fn(),
          },
          dispose: jest.fn(),
        };
      }),
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
      access: (uri: URI) => {
        return true;
      },
      createFile: jest.fn((uri: string, options: {overwrite?: boolean} = {}) => {
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
  });

  it('resource edit tests', async (done) => {

    const service: IWorkspaceEditService = injector.get(IWorkspaceEditService);
    await service.apply({
      edits: [
        {
          resource: new URI('file:///test.ts'),
          edit: {
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
          edit: {
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
          edit: {
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

    const model = monaco.editor!.getModel(monaco.Uri!.parse('file:///test.ts'))!;
    expect(model.pushEditOperations).toBeCalled();
    expect(model.pushStackElement).toBeCalled();

    expect(injector.get(WorkbenchEditorService).open).toBeCalled();

    done();
  });

  it('file edit tests', async (done) => {

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
      newUri: new URI('file:///newTest.ts'),
      oldUri: new URI('file:///oldTest.ts'),
      options: {
        overwrite: true,
      },
    };

    const createEdit: IResourceFileEdit = {
      newUri: new URI('file:///createTest.ts'),
      options: {
        overwrite: true,
        showInEditor: true,
      },
    };

    const deleteEdit: IResourceFileEdit = {
      oldUri: new URI('file:///deleteTest.ts'),
      options: {
        overwrite: true,
      },
    };

    injector.mock(IFileServiceClient, 'exists', jest.fn((uri: URI) => {
      return true;
    }));

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
      edits: [
        moveEdit,
        createEdit,
        deleteEdit,
      ],
    });

    expect(fileServiceClient.move).toHaveBeenLastCalledWith(moveEdit.oldUri!.toString(), moveEdit.newUri!.toString(), expect.objectContaining({
      overwrite: true,
    }));

    expect(fileServiceClient.createFile).toHaveBeenLastCalledWith(createEdit.newUri!.toString(), expect.objectContaining({
      content: '',
      overwrite: true,
    }));

    expect(fileServiceClient.delete).toHaveBeenLastCalledWith(deleteEdit.oldUri!.toString(), expect.objectContaining({}));

    expect(mockParticipant).toBeCalledTimes(3);
    expect(mockWillCall).toBeCalledTimes(3);
    expect(mockDidCall).toBeCalledTimes(3);

    // 已存在的文件，不添加 ignoreIfExists 和 overwrite 选项， 应该抛出文件已存在的问题
    const createEdit2: IResourceFileEdit = {
      newUri: new URI('file:///createTest.ts'),
      options: {
      },
    };

    let error: Error | undefined;
    await service.apply({
      edits: [
        createEdit2,
      ],
    }).catch((err) => {
      error = err;
    });

    expect(FileSystemError.FileExists.is(error)).toBe(true);

    // 添加 ignoreIfExists 应该正常执行不抛出错误
    const createEdit3: IResourceFileEdit = {
      newUri: new URI('file:///createTest.ts'),
      options: {
        ignoreIfExists: true,
      },
    };
    error = undefined;
    await service.apply({
      edits: [
        createEdit3,
      ],
    });

    done();
  });

  it('monaco bulk edit test', async (done) => {

    const monacoBulkEditService: MonacoBulkEditService = injector.get(MonacoBulkEditService);
    const fileServiceClient = injector.get<IFileServiceClient>(IFileServiceClient);

    await monacoBulkEditService.apply({
      edits: [
        {
          resource: monaco.Uri!.parse('file:///monaco-test.ts'),
          edit: {
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
          newUri: monaco.Uri!.parse('file:///monaco.newTest.ts'),
          oldUri: monaco.Uri!.parse('file:///monaco.oldTest.ts'),
          options: {
            overwrite: true,
          },
        },
      ],
    });

    expect(fileServiceClient.move).toHaveBeenLastCalledWith('file:///monaco.oldTest.ts', 'file:///monaco.newTest.ts', expect.objectContaining({
      overwrite: true,
    }));

    const model = monaco.editor!.getModel(monaco.Uri!.parse('file:///monaco-test.ts'))!;
    expect(model.pushEditOperations).toBeCalled();
    expect(model.pushStackElement).toBeCalled();

    expect(injector.get(WorkbenchEditorService).open).toBeCalled();

    done();
  });

  it('monaco bulk edit preview test', async (done) => {
    const mockedPreviewFn = jest.fn((edit: WorkspaceEdit, options?: IBulkEditOptions): Promise<WorkspaceEdit> => {
      return Promise.resolve(edit);
    });
    const monacoBulkEditService: MonacoBulkEditService = injector.get(MonacoBulkEditService);
    monacoBulkEditService.setPreviewHandler(mockedPreviewFn);

    await monacoBulkEditService.apply({
      edits: [
        {
          resource: monaco.Uri!.parse('file:///monaco-test-2.ts'),
          edit: {
            range: {
              startColumn: 1,
              endColumn: 1,
              startLineNumber: 1,
              endLineNumber: 1,
            },
            text: 'test1',
          },
        },
      ],
    }, { showPreview: true });

    const model = monaco.editor!.getModel(monaco.Uri!.parse('file:///monaco-test-2.ts'))!;
    expect(model.pushEditOperations).toBeCalled();
    expect(model.pushStackElement).toBeCalled();

    expect(injector.get(WorkbenchEditorService).open).toBeCalled();

    expect(mockedPreviewFn).toBeCalled();
    done();
  });
});
