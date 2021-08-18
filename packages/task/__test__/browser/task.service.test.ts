import * as path from 'path';
import { ITaskService, ITaskSystem, ITaskProvider } from '@ali/ide-task/lib/common';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { LayoutService } from '@ali/ide-main-layout/lib/browser/layout.service';
import { OutputPreferences } from '@ali/ide-output/lib/browser/output-preference';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { FileUri, Uri } from '@ali/ide-core-common';
import { MonacoService } from '../../../monaco';
import { PreferenceService, ISchemaRegistry, ISchemaStore, QuickOpenService } from '@ali/ide-core-browser';
import { SchemaRegistry, SchemaStore } from '../../../monaco/src/browser/schema-registry';
import { taskSchemaUri, schema } from '@ali/ide-task/lib/browser/task.schema';
import { TaskService } from '@ali/ide-task/lib/browser/task.service';
import { TerminalTaskSystem } from '@ali/ide-task/lib/browser/terminal-task-system';
import { MockQuickOpenService } from '@ali/ide-quick-open/lib/common/mocks/quick-open.service';
import { IEditorDocumentModelService } from '@ali/ide-editor/src/browser';
import { EditorDocumentModelServiceImpl } from '@ali/ide-editor/src/browser/doc-model/main';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';

const preferences: Map<string, any> = new Map();

const mockedPreferenceService: any = {
  get: (k) => {
    return preferences.get(k);
  },
  set: (k, v) => {
    preferences.set(k, v);
  },
  onPreferenceChanged: (listener) => {
    return {
      dispose: () => {},
    };
  },
};

describe('TaskService Test Suite', () => {
  const injector = createBrowserInjector([]);
  let taskService: ITaskService;
  let workspace: MockWorkspaceService;
  injector.addProviders(...[
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
      token: ISchemaRegistry,
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
  ]);

  beforeAll(async () => {
    const monacoService = injector.get(MonacoService);
    await monacoService.loadMonaco();
    injector.overrideProviders({
      token: PreferenceService,
      useValue: {
        onPreferenceChanged: jest.fn(() => ({dispose: () => {}})),
        get: () => {
          return {
            'version': '2.0.0',
            'tasks': [
              {
                'type': 'shell',
                'label': 'Echo Hello',
                'command': 'echo',
                'args': [
                  "'hello'",
                ],
                'options': {
                  'cwd': '${workspaceFolder}',
                },
              },
            ],
          };
        },
      },
    });
    taskService = injector.get<ITaskService>(ITaskService);
    workspace = injector.get<MockWorkspaceService>(IWorkspaceService);
    const schemaRegistry: ISchemaRegistry = injector.get(ISchemaRegistry);
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
      provideTasks: () => {
        return Promise.resolve({ tasks: [] });
      },
      resolveTask: (task) => {
        return Promise.resolve(undefined);
      },
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
