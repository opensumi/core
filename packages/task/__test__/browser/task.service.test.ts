import path from 'path';

import { PreferenceService, IJSONSchemaRegistry, ISchemaStore, QuickOpenService } from '@opensumi/ide-core-browser';
import { FileUri, Uri } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/src/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/src/browser/doc-model/main';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import { MockQuickOpenService } from '@opensumi/ide-quick-open/lib/common/mocks/quick-open.service';
import { taskSchemaUri, schema } from '@opensumi/ide-task/lib/browser/task.schema';
import { TaskService } from '@opensumi/ide-task/lib/browser/task.service';
import { TerminalTaskSystem } from '@opensumi/ide-task/lib/browser/terminal-task-system';
import { ITaskService, ITaskSystem, ITaskProvider } from '@opensumi/ide-task/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MonacoService } from '../../../monaco';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';
import { SchemaRegistry, SchemaStore } from '../../../monaco/src/browser/schema-registry';


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
    ],
  );

  beforeAll(async () => {
    const monacoService = injector.get(MonacoService);
    await monacoService.loadMonaco();
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

  it('runtask command should be work', async (done) => {
    injector.mock(QuickOpenService, 'open', (model) => {
      done();
    });
    taskService.runTaskCommand();
  });
});
