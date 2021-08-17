import { WorkspaceContribution } from '@ali/ide-workspace/lib/browser/workspace-contribution';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI } from '@ali/ide-core-common';
import { WorkspaceModule } from '../../src/browser';
import { IContextKeyService, CommandService, WORKSPACE_COMMANDS } from '@ali/ide-core-browser';
import { IWindowDialogService } from '@ali/ide-overlay';
import { MockContextKeyService } from '@ali/ide-core-browser/__mocks__/context-key';

describe('WorkspaceContribution should be work', () => {
  let workspaceContribution: WorkspaceContribution;
  let injector: MockInjector;
  const mockWorkspaceService = {
    getWorkspaceRootUri: jest.fn(),
    whenReady: Promise.resolve(),
    onWorkspaceChanged: jest.fn(),
    onWorkspaceLocationChanged: jest.fn(),
    save: jest.fn(),
    addRoot: jest.fn(),
    init: jest.fn(),
    tryGetRoots: jest.fn(() => []),
    isMultiRootWorkspaceOpened: true,
  };

  const mockCommandService = {
    executeCommand: jest.fn(),
  };
  const mockWindowDialogService = {
    showOpenDialog: jest.fn(() => [URI.file('/userhome/folder').toString()]),
    showSaveDialog: jest.fn(() => URI.file('/userhome/folder').toString()),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([
      WorkspaceModule,
    ]);
    injector.overrideProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    });
    injector.overrideProviders({
      token: CommandService,
      useValue: mockCommandService,
    });
    injector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });
    injector.overrideProviders({
      token: IWindowDialogService,
      useValue: mockWindowDialogService,
    });

    workspaceContribution = injector.get(WorkspaceContribution);
    done();
  });

  afterEach(() => {
    injector.disposeAll();
    mockWorkspaceService.getWorkspaceRootUri.mockReset();
  });

  it('ClientAppContribution should be work', async (done) => {
    await workspaceContribution.onStart();
    expect(mockWorkspaceService.onWorkspaceLocationChanged).toBeCalledTimes(1);
    done();
  });

  it('CommandContribution should be work', async (done) => {
    const mockRegistry = {
      registerCommand: jest.fn(async (command, {execute}) => {
        if (command.id === WORKSPACE_COMMANDS.ADD_WORKSPACE_FOLDER.id) {
          await execute();
          expect(mockWorkspaceService.addRoot).toBeCalledTimes(1);
        } else if (command.id === WORKSPACE_COMMANDS.SAVE_WORKSPACE_AS_FILE.id) {
          await execute();
          expect(mockWorkspaceService.save).toBeCalledTimes(1);
          done();
        }
      }),
    };
    workspaceContribution.registerCommands(mockRegistry as any);
    expect(mockRegistry.registerCommand).toBeCalledTimes(2);
  });

  it('FsProviderContribution should be work', () => {
    workspaceContribution.onFileServiceReady();
    expect(mockWorkspaceService.init).toBeCalledTimes(1);
  });
});
