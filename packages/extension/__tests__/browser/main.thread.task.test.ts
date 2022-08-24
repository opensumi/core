import path from 'path';

import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Emitter, FileUri, ITaskDefinitionRegistry, TaskDefinitionRegistryImpl } from '@opensumi/ide-core-common';
import { DebugConsoleInputDocumentProvider } from '@opensumi/ide-debug/lib/browser/view/console/debug-console.service';
import { addEditorProviders } from '@opensumi/ide-dev-tool/src/injector-editor';
import { IEditorDocumentModelContentRegistry } from '@opensumi/ide-editor/src/browser';
import { EditorDocumentModelContentRegistryImpl } from '@opensumi/ide-editor/src/browser/doc-model/main';
import { ExtensionService } from '@opensumi/ide-extension';
import { IExtensionStorageService } from '@opensumi/ide-extension-storage/lib/common';
import { ExtensionServiceImpl } from '@opensumi/ide-extension/lib/browser/extension.service';
import { MainthreadTasks } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.tasks';
import { MainThreadWorkspace } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.workspace';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { Task, ShellExecution } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { ExtensionDocumentDataManagerImpl } from '@opensumi/ide-extension/lib/hosted/api/vscode/doc';
import { ExtHostMessage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtHostStorage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.storage';
import { ExtHostTerminal } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.terminal';
import { ExtHostWorkspace } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.workspace';
import { ExtHostTasks, createTaskApiFactory } from '@opensumi/ide-extension/lib/hosted/api/vscode/tasks/ext.host.tasks';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { MonacoService } from '@opensumi/ide-monaco';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import { TaskService } from '@opensumi/ide-task/lib/browser/task.service';
import { TerminalTaskSystem } from '@opensumi/ide-task/lib/browser/terminal-task-system';
import { ITaskService, ITaskSystem } from '@opensumi/ide-task/lib/common';
import { ITerminalInternalService, ITerminalController } from '@opensumi/ide-terminal-next';
import { TerminalController } from '@opensumi/ide-terminal-next/lib/browser/terminal.controller';
import { TerminalInternalService } from '@opensumi/ide-terminal-next/lib/browser/terminal.internal.service';
import { VariableModule } from '@opensumi/ide-variable/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';
import { MockDebugConsoleInputDocumentProvider } from '../../__mocks__/debugConsoleInputDocumentProvider';
import { mockExtensions } from '../../__mocks__/extensions';
import { MockExtensionStorageService } from '../hosted/__mocks__/extensionStorageService';

const extension = Object.assign({}, mockExtensions[0], {
  packageJSON: {
    ...mockExtensions[0].packageJSON,
    contributes: {
      taskDefinitions: [
        {
          type: 'test-taskprovider',
          properties: {
            script: {
              type: 'string',
              description: 'Cli script',
            },
          },
          required: ['script'],
        },
      ],
    },
  },
});

class TestTaskProvider {
  provideTasks(token) {
    return [new Task({ type: 'test-taskprovider' }, 2, 'Echo Task', 'echo', new ShellExecution('echo'))];
  }
  resolveTask(task, token) {
    return undefined;
  }
}

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);
const rpcProtocolMain = new RPCProtocol(mockClientB);

describe('MainThreadTask Test Suite', () => {
  const injector = createBrowserInjector([VariableModule]);
  injector.addProviders(
    ...[
      {
        token: ITerminalInternalService,
        useClass: TerminalInternalService,
      },
      {
        token: ITerminalController,
        useClass: TerminalController,
      },
      {
        token: ITaskDefinitionRegistry,
        useClass: TaskDefinitionRegistryImpl,
      },
      {
        token: MonacoService,
        useClass: MockedMonacoService,
      },
      {
        token: ITaskSystem,
        useClass: TerminalTaskSystem,
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: ITaskService,
        useClass: TaskService,
      },
      {
        token: OutputPreferences,
        useValue: {
          'output.logWhenNoPanel': true,
        },
      },
      {
        token: IMainLayoutService,
        useClass: LayoutService,
      },
      {
        token: IExtensionStorageService,
        useValue: MockExtensionStorageService,
      },
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: DebugConsoleInputDocumentProvider,
        useValue: MockDebugConsoleInputDocumentProvider,
      },
    ],
  );

  addEditorProviders(injector);

  const testProvider = new TestTaskProvider();
  let extHostTask: ExtHostTasks;
  let mainthreadTask: MainthreadTasks;
  let extHostTaskApi: ReturnType<typeof createTaskApiFactory>;
  const workspaceService = injector.get<MockWorkspaceService>(IWorkspaceService);

  const rootPath = path.resolve(__dirname);
  const rootUri = FileUri.create(rootPath).toString();
  workspaceService.setWorkspace({
    uri: rootUri,
    isDirectory: true,
    lastModification: 0,
  });

  const taskDefinition = injector.get<TaskDefinitionRegistryImpl>(ITaskDefinitionRegistry);
  taskDefinition.register('test-taskprovider', {
    taskType: 'test-taskprovider',
    properties: {
      script: {
        type: 'string',
        description: 'Cli script',
      },
    },
    required: ['script'],
    extensionId: extension.id,
  });
  beforeAll(async () => {
    const monacoService = injector.get(MonacoService);
    const extHostMessage = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocolExt));
    const extHostDocs = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostDocuments,
      injector.get(ExtensionDocumentDataManagerImpl, [rpcProtocolExt]),
    );
    const extHostTerminal = new ExtHostTerminal(rpcProtocolExt);
    const extHostWorkspace = new ExtHostWorkspace(rpcProtocolExt, extHostMessage, extHostDocs);
    extHostTask = new ExtHostTasks(rpcProtocolExt, extHostTerminal, extHostWorkspace);
    mainthreadTask = injector.get(MainthreadTasks, [rpcProtocolMain]);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostWorkspace, extHostWorkspace);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTasks, extHostTask);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStorage, new ExtHostStorage(rpcProtocolExt));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTasks, mainthreadTask);
    rpcProtocolMain.set(
      MainThreadAPIIdentifier.MainThreadWorkspace,
      injector.get(MainThreadWorkspace, [rpcProtocolMain]),
    );
    extHostTaskApi = createTaskApiFactory(extHostTask, mockExtensions[0]);
    (
      injector.get(IEditorDocumentModelContentRegistry) as EditorDocumentModelContentRegistryImpl
    ).registerEditorDocumentModelContentProvider(injector.get(DebugConsoleInputDocumentProvider));
  });

  describe('ExtHostTask API should be work', () => {
    it('should have enough tasks api', () => {
      expect(typeof extHostTaskApi.fetchTasks).toBe('function');
      expect(typeof extHostTaskApi.executeTask).toBe('function');
      expect(typeof extHostTaskApi.onDidEndTask).toBe('function');
      expect(typeof extHostTaskApi.onDidEndTaskProcess).toBe('function');
      expect(typeof extHostTaskApi.onDidStartTask).toBe('function');
      expect(typeof extHostTaskApi.onDidStartTaskProcess).toBe('function');
      expect(typeof extHostTaskApi.registerTaskProvider).toBe('function');
      expect(Array.isArray(extHostTaskApi.taskExecutions)).toBeTruthy();
    });

    it('registerTaskProvider should be work', async () => {
      await workspaceService.setWorkspace({
        uri: rootUri,
        isDirectory: true,
        lastModification: 0,
      });
      const disposable = extHostTaskApi.registerTaskProvider('test-taskprovider', testProvider);
      expect(typeof disposable.dispose).toBe('function');
    });

    it('fetchTasks should be work', async () => {
      const tasks = await extHostTaskApi.fetchTasks({ type: 'test-taskprovider' });
      expect(tasks.length).toBe(1);
      expect(tasks[0].name).toBe('Echo Task');
    });

    it.skip('executeTask should be work', async () => {
      const tasks = await extHostTaskApi.fetchTasks({ type: 'test-taskprovider' });
      const execution = await extHostTaskApi.executeTask(tasks[0]);
      expect(execution.task.name).toBe('Echo Task');
      expect(typeof execution).toBe('object');
    });
  });
});
