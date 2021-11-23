import path from 'path';
import { Emitter, FileUri, ILoggerManagerClient, LogServiceForClientPath, LogLevel, ITaskDefinitionRegistry, TaskDefinitionRegistryImpl } from '@ide-framework/ide-core-common';
import { Injectable } from '@ide-framework/common-di';
import { RPCProtocol } from '@ide-framework/ide-connection/lib/common/rpcProtocol';
import { ExtHostTasks, createTaskApiFactory } from '@ide-framework/ide-extension/lib/hosted/api/vscode/tasks/ext.host.tasks';
import { MainthreadTasks } from '@ide-framework/ide-extension/lib/browser/vscode/api/main.thread.tasks';
import { TaskService } from '@ide-framework/ide-task/lib/browser/task.service';
import { ExtHostTerminal } from '@ide-framework/ide-extension/lib/hosted/api/vscode/ext.host.terminal';
import { ExtHostWorkspace } from '@ide-framework/ide-extension/lib/hosted/api/vscode/ext.host.workspace';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@ide-framework/ide-extension/lib/common/vscode';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtHostMessage } from '@ide-framework/ide-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtensionDocumentDataManagerImpl } from '@ide-framework/ide-extension/lib/hosted/api/vscode/doc';
import { ExtensionService } from '@ide-framework/ide-extension';
import { ExtensionServiceImpl } from '@ide-framework/ide-extension/lib/browser/extension.service';
import { mockExtensions } from '../../__mocks__/extensions';
import { ITaskService, ITaskSystem } from '@ide-framework/ide-task/lib/common';
import { IMainLayoutService } from '@ide-framework/ide-main-layout';
import { LayoutService } from '@ide-framework/ide-main-layout/lib/browser/layout.service';
import { OutputPreferences } from '@ide-framework/ide-output/lib/browser/output-preference';
import { TerminalTaskSystem } from '@ide-framework/ide-task/lib/browser/terminal-task-system';
import { Task, ShellExecution } from '@ide-framework/ide-extension/lib/common/vscode/ext-types';
import { IWorkspaceService } from '@ide-framework/ide-workspace';
import { MockWorkspaceService } from '@ide-framework/ide-workspace/lib/common/mocks';
import { LoggerManagerClient } from '@ide-framework/ide-logs/lib/browser/log-manage';
import { MainThreadWorkspace } from '@ide-framework/ide-extension/lib/browser/vscode/api/main.thread.workspace';
import { IExtensionStorageService } from '@ide-framework/ide-extension-storage/lib/common';
import { ExtHostStorage } from '@ide-framework/ide-extension/lib/hosted/api/vscode/ext.host.storage';
import { VariableModule } from '@ide-framework/ide-variable/lib/browser';
import { ITerminalInternalService, ITerminalController } from '@ide-framework/ide-terminal-next';
import { TerminalInternalService } from '@ide-framework/ide-terminal-next/lib/browser/terminal.service';
import { TerminalController } from '@ide-framework/ide-terminal-next/lib/browser/terminal.controller';
import { MonacoService } from '@ide-framework/ide-monaco';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';
import { IEditorDocumentModelService } from '@ide-framework/ide-editor/src/browser';
import { EditorDocumentModelServiceImpl } from '@ide-framework/ide-editor/src/browser/doc-model/main';

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
    return [
      new Task({ type: 'test-taskprovider' }, 2, 'Echo Task', 'echo', new ShellExecution('echo')),
    ];
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

@Injectable()
class MockLogServiceForClient {
  private level: LogLevel;

  hasDisposeAll: boolean = false;

  async setGlobalLogLevel(level) {
    this.level = level;
  }

  async getGlobalLogLevel() {
    return this.level;
  }

  async verbose() {
    //
  }

  async disposeAll() {
    this.hasDisposeAll = true;
  }
}

describe('MainThreadTask Test Suite', () => {
  const injector = createBrowserInjector([VariableModule]);
  injector.addProviders(...[
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
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
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
      token: ILoggerManagerClient,
      useClass: LoggerManagerClient,
    },
    {
      token: IExtensionStorageService,
      useValue: {
        whenReady: Promise.resolve(true),
        extensionStoragePath: {},
        set() { },
        get() { },
        getAll() { },
        reConnectInit() { },
      },
    },
    {
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    },
    {
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    }]);
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
    await monacoService.loadMonaco();
    const extHostMessage = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocolExt));
    const extHostDocs = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostDocuments, injector.get(ExtensionDocumentDataManagerImpl, [rpcProtocolExt]));
    const extHostTerminal = new ExtHostTerminal(rpcProtocolExt);
    const extHostWorkspace = new ExtHostWorkspace(rpcProtocolExt, extHostMessage, extHostDocs);
    extHostTask = new ExtHostTasks(rpcProtocolExt, extHostTerminal, extHostWorkspace);
    mainthreadTask = injector.get(MainthreadTasks, [rpcProtocolMain]);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostWorkspace, extHostWorkspace);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTasks, extHostTask);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStorage, new ExtHostStorage(rpcProtocolExt));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTasks, mainthreadTask);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWorkspace, injector.get(MainThreadWorkspace, [rpcProtocolMain]));
    extHostTaskApi = createTaskApiFactory(extHostTask, mockExtensions[0]);
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

    it('registerTaskProvider should be work', async (done) => {
      await workspaceService.setWorkspace({
        uri: rootUri,
        isDirectory: true,
        lastModification: 0,
      });
      const disposable = extHostTaskApi.registerTaskProvider('test-taskprovider', testProvider);
      expect(typeof disposable.dispose).toBe('function');
      done();
    });

    it('fetchTasks should be work', async (done) => {
      const tasks = await extHostTaskApi.fetchTasks({ type: 'test-taskprovider' });
      expect(tasks.length).toBe(1);
      expect(tasks[0].name).toBe('Echo Task');
      done();
    });

    it.skip('executeTask should be work', async (done) => {
      const tasks = await extHostTaskApi.fetchTasks({ type: 'test-taskprovider' });
      const execution = await extHostTaskApi.executeTask(tasks[0]);
      expect(execution.task.name).toBe('Echo Task');
      expect(typeof execution).toBe('object');
    });

  });
});
