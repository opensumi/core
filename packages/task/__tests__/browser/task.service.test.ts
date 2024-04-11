import { IJSONSchemaRegistry, ISchemaStore, PreferenceService, QuickOpenService } from '@opensumi/ide-core-browser';
import { FileUri, Uri } from '@opensumi/ide-core-common';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { IDocPersistentCacheProvider } from '@opensumi/ide-editor';
import {
  EmptyDocCacheImpl,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/src/browser';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '@opensumi/ide-editor/src/browser/doc-model/main';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import { schema, taskSchemaUri } from '@opensumi/ide-task/lib/browser/task.schema';
import { TaskService } from '@opensumi/ide-task/lib/browser/task.service';
import { TerminalTaskSystem } from '@opensumi/ide-task/lib/browser/terminal-task-system';
import { ITaskProvider, ITaskService, ITaskSystem } from '@opensumi/ide-task/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockWalkThroughSnippetSchemeDocumentProvider } from '../../../file-scheme/__mocks__/browser/file-doc';
import { LayoutService } from '../../../main-layout/src/browser/layout.service';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';
import { MonacoService } from '../../../monaco/lib/index';
import { SchemaRegistry, SchemaStore } from '../../../monaco/src/browser/schema-registry';
import { MockQuickOpenService } from '../../../quick-open/src/common/mocks/quick-open.service';

const path = require('path');

const preferences: Map<string, any> = new Map();

const mockedPreferenceService: any = {
  get: (k) => preferences.get(k),
  set: (k, v) => {
    preferences.set(k, v);
  },
  onPreferenceChanged: (listener) => ({
    dispose: () => {},
  }),
};

describe('TaskService Test Suite', () => {
  const injector = createBrowserInjector([]);
  let taskService: ITaskService;
  let workspace: MockWorkspaceService;
  injector.addProviders(
    ...[
      {
        token: QuickOpenService,
        useClass: MockQuickOpenService,
      },

      {
        token: PreferenceService,
        useValue: mockedPreferenceService,
      },
      {
        token: MonacoService,
        useClass: MockedMonacoService,
      },
      {
        token: IEditorDocumentModelContentRegistry,
        useClass: EditorDocumentModelContentRegistryImpl,
      },
      {
        token: IHashCalculateService,
        useClass: HashCalculateServiceImpl,
      },
      {
        token: IEditorDocumentModelService,
        useClass: EditorDocumentModelServiceImpl,
      },
      {
        token: ITaskService,
        useClass: TaskService,
      },
      {
        token: ITaskSystem,
        useClass: TerminalTaskSystem,
      },
      {
        token: ISchemaStore,
        useClass: SchemaStore,
      },
      {
        token: IJSONSchemaRegistry,
        useClass: SchemaRegistry,
      },
      {
        token: IMainLayoutService,
        useClass: LayoutService,
      },
      {
        token: OutputPreferences,
        useValue: {
          'output.logWhenNoPanel': true,
        },
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: IDocPersistentCacheProvider,
        useClass: EmptyDocCacheImpl,
      },
    ],
  );

  beforeAll(async () => {
    injector.overrideProviders({
      token: PreferenceService,
      useValue: {
        onPreferenceChanged: jest.fn(() => ({ dispose: () => {} })),
        get: () => ({
          version: '2.0.0',
          tasks: [
            {
              type: 'shell',
              label: 'Echo Hello',
              command: 'echo',
              args: ["'hello'"],
              options: {
                cwd: '${workspaceFolder}',
              },
            },
          ],
        }),
      },
    });
    const documentRegistry = injector.get<IEditorDocumentModelContentRegistry>(IEditorDocumentModelContentRegistry);
    documentRegistry.registerEditorDocumentModelContentProvider(
      injector.get(MockWalkThroughSnippetSchemeDocumentProvider),
    );
    taskService = injector.get<ITaskService>(ITaskService);
    workspace = injector.get<MockWorkspaceService>(IWorkspaceService);
    const schemaRegistry: IJSONSchemaRegistry = injector.get(IJSONSchemaRegistry);

    schemaRegistry.registerSchema(taskSchemaUri, schema, ['tasks.json']);
    const rootPath = path.resolve(__dirname);
    const rootUri = FileUri.create(rootPath).toString();
    workspace.setWorkspace({
      uri: rootUri,
      isDirectory: true,
      lastModification: 0,
    });
  });
  it('registerTaskProider should be work', () => {
    const provider: ITaskProvider = {
      provideTasks: () => Promise.resolve({ tasks: [] }),
      resolveTask: (task) => Promise.resolve(undefined),
    };
    const disposable = taskService.registerTaskProvider(provider, 'test-suite-provider');
    expect(typeof disposable.dispose).toBe('function');
  });

  it('get all tasks should be work', async () => {
    const tasks = await taskService.tasks({ type: 'test-suite-provider' });
    expect(tasks.length).toBe(0);
  });

  it('getWorkspaceTask should be work', async () => {
    const task = await taskService.getTask(Uri.file(path.resolve(__dirname)), 'Echo Hello');
    expect(task).toBeDefined();
    expect(task?._label).toBe('Echo Hello');
  });

  it('runtask command should be work', (done) => {
    injector.mock(QuickOpenService, 'open', (model) => {
      done();
    });
    taskService.runTaskCommand();
  });
});
