import path from 'path';
import { Emitter, FileUri, ILoggerManagerClient, LogServiceForClientPath, LogLevel, ITaskDefinitionRegistry, TaskDefinitionRegistryImpl } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { ExtHostTasks, createTaskApiFactory } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/tasks/ext.host.tasks';
import { MainthreadTasks } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.tasks';
import { TaskService } from '@ali/ide-task/lib/browser/task.service';
import { ExtHostTerminal } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.terminal';
import { ExtHostWorkspace } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.workspace';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtHostMessage } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtensionDocumentDataManagerImpl } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/doc';
import { ExtensionService } from '@ali/ide-kaitian-extension';
import { ExtensionServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/extension.service';
import { mockExtensions } from '../../__mocks__/extensions';
import { ITaskService, ITaskSystem } from '@ali/ide-task/lib/common';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { LayoutService } from '@ali/ide-main-layout/lib/browser/layout.service';
import { OutputPreferences } from '@ali/ide-output/lib/browser/output-preference';
import { TerminalTaskSystem } from '@ali/ide-task/lib/browser/terminal-task-system';
import { Task, ShellExecution } from '@ali/ide-kaitian-extension/lib/common/vscode/ext-types';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { LoggerManagerClient } from '@ali/ide-logs/lib/browser/log-manage';
import { MainThreadWorkspace } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.workspace';
import { IExtensionStorageService } from '@ali/ide-extension-storage/lib/common';
import { ExtHostStorage } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.storage';
import { VariableModule } from '@ali/ide-variable/lib/browser';
import { ITerminalInternalService, ITerminalController } from '@ali/ide-terminal-next';
import { TerminalInternalService } from '@ali/ide-terminal-next/lib/browser/terminal.service';
import { TerminalController } from '@ali/ide-terminal-next/lib/browser/terminal.controller';
import { MonacoService } from '@ali/ide-monaco';
import { MockedMonacoService } from '../../../monaco/__mocks__/monaco.service.mock';
import { IEditorDocumentModelService } from '@ali/ide-editor/src/browser';
import { EditorDocumentModelServiceImpl } from '@ali/ide-editor/src/browser/doc-model/main';

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
              description: 'Kaitian Cli script',
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
        description: 'Kaitian Cli script',
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
