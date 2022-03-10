import path from 'path';

import { RPCProtocol } from '@opensumi/ide-connection';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { MockedStorageProvider } from '@opensumi/ide-core-browser/__mocks__/storage';
import {
  Emitter as EventEmitter,
  Disposable,
  ILoggerManagerClient,
  StorageProvider,
  Uri,
  IFileServiceClient,
} from '@opensumi/ide-core-common';
import { ITaskDefinitionRegistry, TaskDefinitionRegistryImpl } from '@opensumi/ide-core-common/lib/task-definition';
import { IEditorDocumentModelService, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { ExtensionDocumentDataManagerImpl } from '@opensumi/ide-extension/lib/hosted/api/vscode/doc';
import { ExtHostMessage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtHostWorkspace } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.workspace';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common/main-layout.defination';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import { TaskService } from '@opensumi/ide-task/lib/browser/task.service';
import { TerminalTaskSystem } from '@opensumi/ide-task/lib/browser/terminal-task-system';
import { ITaskService, ITaskSystem } from '@opensumi/ide-task/lib/common';
import {
  ITerminalApiService,
  ITerminalClientFactory,
  ITerminalController,
  ITerminalGroupViewService,
  ITerminalInternalService,
  ITerminalProfileService,
  ITerminalService,
  ITerminalTheme,
} from '@opensumi/ide-terminal-next';
import { TerminalClientFactory } from '@opensumi/ide-terminal-next/lib/browser/terminal.client';
import { TerminalController } from '@opensumi/ide-terminal-next/lib/browser/terminal.controller';
import { TerminalInternalService } from '@opensumi/ide-terminal-next/lib/browser/terminal.internal.service';
import { TerminalPreference } from '@opensumi/ide-terminal-next/lib/browser/terminal.preference';
import { TerminalProfileService } from '@opensumi/ide-terminal-next/lib/browser/terminal.profile';
import { TerminalGroupViewService } from '@opensumi/ide-terminal-next/lib/browser/terminal.view';
import { ITerminalPreference } from '@opensumi/ide-terminal-next/lib/common/preference';
import { IVariableResolverService } from '@opensumi/ide-variable';
import { VariableResolverService } from '@opensumi/ide-variable/lib/browser/variable-resolver.service';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common/workspace-defination';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import {
  MockMainLayoutService,
  MockSocketService,
  MockTerminalThemeService,
} from '../../../../../terminal-next/__tests__/browser/mock.service';
import { mockExtensionProps } from '../../../../__mocks__/extensions';
import { MainthreadTasks } from '../../../../src/browser/vscode/api/main.thread.tasks';
import { MainThreadTerminal } from '../../../../src/browser/vscode/api/main.thread.terminal';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostTerminal } from '../../../../src/hosted/api/vscode/ext.host.terminal';
import { ExtHostTasks } from '../../../../src/hosted/api/vscode/tasks/ext.host.tasks';


import { CustomBuildTaskProvider } from './__mock__/taskProvider';


const extension = mockExtensionProps;

const emitterA = new EventEmitter<any>();
const emitterB = new EventEmitter<any>();

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

let extHostTask: ExtHostTasks;
let extHostTerminal: ExtHostTerminal;
let mainThreadTerminal: MainThreadTerminal;
let mainThreadTask: MainthreadTasks;

describe('ExtHostTask API', () => {
  const injector = createBrowserInjector([]);

  injector.addProviders(
    {
      token: ITerminalApiService,
      useValue: mockService({
        terminals: [],
        onDidChangeActiveTerminal: () => Disposable.NULL,
        onDidCloseTerminal: () => Disposable.NULL,
        onDidOpenTerminal: () => Disposable.NULL,
        createTerminal: (options) => ({
          id: options.name,
        }),
      }),
    },
    {
      token: ITerminalService,
      useValue: new MockSocketService(),
    },
    {
      token: ITerminalInternalService,
      useClass: TerminalInternalService,
    },
    {
      token: ITerminalProfileService,
      useClass: TerminalProfileService,
    },
    {
      token: StorageProvider,
      useValue: MockedStorageProvider,
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
      token: ILoggerManagerClient,
      useClass: MockLoggerManageClient,
    },
    {
      token: ITerminalClientFactory,
      useFactory:
        (injector) =>
        (widget, options = {}) =>
          TerminalClientFactory.createClient(injector, widget, options),
    },
    {
      token: IVariableResolverService,
      useClass: VariableResolverService,
    },
    {
      token: ITerminalGroupViewService,
      useClass: TerminalGroupViewService,
    },
    {
      token: OutputPreferences,
      useValue: {
        'output.logWhenNoPanel': true,
      },
    },
    {
      token: IWorkspaceService,
      useValue: {
        tryGetRoots: () => [{ uri: __dirname }],
        getWorkspaceName: () => 'Test Workspace',
        getWorkspaceFolder: (uri) => ({ uri, name: 'Test Workspace' }),
      },
    },
    {
      token: ITaskDefinitionRegistry,
      useClass: TaskDefinitionRegistryImpl,
    },
    {
      token: WorkbenchEditorService,
      useValue: {},
    },
    {
      token: IFileServiceClient,
      useClass: MockFileServiceClient,
    },
    {
      token: ITerminalTheme,
      useValue: new MockTerminalThemeService(),
    },
    {
      token: ITerminalPreference,
      useClass: TerminalPreference,
    },
    {
      token: ITerminalController,
      useClass: TerminalController,
    },
    {
      token: IEditorDocumentModelService,
      useValue: {
        getModelReference: jest.fn(() => ({
          instance: {
            dirty: false,
          },
          dispose: () => {},
        })),
        createModelReference: (uri) =>
          Promise.resolve({
            instance: {
              uri,
              getMonacoModel: () => ({
                onDidChangeContent: new EventEmitter().event,
                uri,
                setValue: () => {},
              }),
            },
            dispose: jest.fn(),
          }),
      },
    },
    {
      token: IMainLayoutService,
      useValue: new MockMainLayoutService(),
    },
  );

  const extHostMessage = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocolExt));
  const extHostDocs = rpcProtocolExt.set(
    ExtHostAPIIdentifier.ExtHostDocuments,
    injector.get(ExtensionDocumentDataManagerImpl, [rpcProtocolExt]),
  );
  const extHostWorkspace = new ExtHostWorkspace(rpcProtocolExt, extHostMessage, extHostDocs);

  extHostTerminal = new ExtHostTerminal(rpcProtocolExt);
  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTerminal, extHostTerminal);
  extHostTask = new ExtHostTasks(rpcProtocolExt, extHostTerminal, extHostWorkspace);
  mainThreadTerminal = injector.get(MainThreadTerminal, [rpcProtocolMain]);
  mainThreadTask = injector.get(MainthreadTasks, [rpcProtocolMain]);

  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTasks, extHostTask);
  rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTerminal, mainThreadTerminal);
  rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTasks, mainThreadTask);
  extHostTask.registerTaskProvider(
    'custombuildscript',
    new CustomBuildTaskProvider(path.join(__dirname, 'test')),
    extension,
  );

  const taskService: ITaskService = injector.get(ITaskService);
  const taskDefinition: ITaskDefinitionRegistry = injector.get(ITaskDefinitionRegistry);
  taskDefinition.register('custombuildscript', {
    extensionId: extension.id,
    taskType: 'custombuildscript',
    required: [],
    properties: {},
  });

  extHostWorkspace['folders'] = [{ uri: Uri.file(__dirname), name: 'Test Workspace', index: 0 }];

  it('register custombuildscript taskProvider', async (done) => {
    expect(mainThreadTask['providers'].size).toBe(1);
    const taskHandler = mainThreadTask['providers'].get(1);
    expect(taskHandler).toBeDefined();
    done();
  });

  it('provide tasks', async (done) => {
    const taskHandler = mainThreadTask['providers'].get(1);
    const taskSet = await taskHandler?.provider.provideTasks({ custombuildscript: true });
    expect(taskSet).toBeDefined();
    expect(taskSet?.type).toBe('custombuildscript');
    expect(taskSet?.tasks.length).toBe(6);
    done();
  });

  it('run custombuild task', async (done) => {
    const taskSet = await taskService['getGroupedTasks']();
    taskService.run(taskSet[0].tasks[0]);
    extHostTask.onDidStartTask((e) => {
      expect(e.execution.task.definition.type).toBe('custombuildscript');
      expect(e.execution.task.name).toBe('32 watch incremental');
      done();
    });
  }, 5000);
});
