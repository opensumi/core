import { IContextKeyService, CommandService } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { URI } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceVariableContribution } from '@opensumi/ide-workspace/lib/browser/workspace-variable-contribution';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { WorkspaceModule } from '../../src/browser';


describe('WorkspaceVariableContribution should be work', () => {
  let workspaceVariableContribution: WorkspaceVariableContribution;
  let injector: MockInjector;
  const mockWorkspaceService = {
    getWorkspaceRootUri: jest.fn(),
  };
  const mockCommandSetvice = {
    executeCommand: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([WorkspaceModule]);
    injector.overrideProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    });
    injector.overrideProviders({
      token: CommandService,
      useValue: mockCommandSetvice,
    });
    injector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });

    workspaceVariableContribution = injector.get(WorkspaceVariableContribution);
    done();
  });

  afterEach(() => {
    injector.disposeAll();
    mockWorkspaceService.getWorkspaceRootUri.mockReset();
  });

  it('registerVariables contribution point should be work', async (done) => {
    const variables = {
      registerVariable: jest.fn((variable) => {
        variable.resolve();
      }),
    };
    workspaceVariableContribution.registerVariables(variables as any);
    expect(variables.registerVariable).toBeCalledTimes(11);
    done();
  });

  it('getWorkspaceRootUri method should be work', async (done) => {
    const workspaceUri = new URI('file://userhome/');
    workspaceVariableContribution.getWorkspaceRootUri(workspaceUri);
    expect(mockWorkspaceService.getWorkspaceRootUri).toBeCalledWith(workspaceUri);
    done();
  });

  it('getResourceUri method should be work', async (done) => {
    await workspaceVariableContribution.getResourceUri();
    expect(mockCommandSetvice.executeCommand).toBeCalledWith('editor.getCurrentResource');
    done();
  });

  it('getWorkspaceRelativePath method should be work', async (done) => {
    const workspaceUri = new URI('file://userhome/');
    workspaceVariableContribution.getWorkspaceRelativePath(workspaceUri);
    expect(mockWorkspaceService.getWorkspaceRootUri).toBeCalledWith(workspaceUri);
    done();
  });
});
