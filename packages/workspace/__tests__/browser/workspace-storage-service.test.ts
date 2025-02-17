import { CommandService, IContextKeyService } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceVariableContribution } from '@opensumi/ide-workspace/lib/browser/workspace-variable-contribution';

import { WorkspaceModule } from '../../src/browser';

describe('WorkspaceContribution should be work', () => {
  let workspaceVariableContribution: WorkspaceVariableContribution;
  let injector: MockInjector;
  const mockWorkspaceService = {
    getWorkspaceRootUri: jest.fn(),
  };
  const mockContextKeyService = {
    getContextKeyValue: jest.fn(),
  };
  const mockCommandService = {
    executeCommand: jest.fn(),
  };
  beforeEach(async () => {
    injector = createBrowserInjector([WorkspaceModule]);
    injector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
    });
    injector.overrideProviders({
      token: CommandService,
      useValue: mockCommandService,
    });
    injector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });

    workspaceVariableContribution = injector.get(WorkspaceVariableContribution);
  });

  afterEach(async () => {
    await injector.disposeAll();
    mockWorkspaceService.getWorkspaceRootUri.mockReset();
    mockContextKeyService.getContextKeyValue.mockReset();
  });

  it('registerVariables contribution point should be work', async () => {
    const variables = {
      registerVariable: jest.fn((variable) => {
        variable.resolve();
      }),
    };
    workspaceVariableContribution.registerVariables(variables as any);
    expect(variables.registerVariable).toHaveBeenCalledTimes(11);
  });

  it('getWorkspaceRootUri method should be work', async () => {
    const workspaceUri = new URI('file://userhome/');
    workspaceVariableContribution.getWorkspaceRootUri(workspaceUri);
    expect(mockWorkspaceService.getWorkspaceRootUri).toHaveBeenCalledWith(workspaceUri);
  });

  it('getResourceUri method should be work', async () => {
    await workspaceVariableContribution.getResourceUri();
    expect(mockCommandService.executeCommand).toHaveBeenCalledWith('editor.getCurrentResource');
  });

  it('getWorkspaceRelativePath method should be work', async () => {
    const workspaceUri = new URI('file://userhome/');
    workspaceVariableContribution.getWorkspaceRelativePath(workspaceUri);
    expect(mockWorkspaceService.getWorkspaceRootUri).toHaveBeenCalledWith(workspaceUri);
  });
});
