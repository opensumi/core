import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI } from '@ali/ide-core-common';
import { WorkspaceModule } from '../../src/browser';
import { IContextKeyService } from '@ali/ide-core-browser';
import { WorkspaceVariableContribution } from '@ali/ide-workspace/lib/browser/workspace-variable-contribution';

describe('WorkspaceVariableContribution should be work', () => {
  let workspaceVariableContribution: WorkspaceVariableContribution;
  let injector: MockInjector;
  const mockWorkspaceService = {
    getWorkspaceRootUri: jest.fn(),
  };
  const mockContextKeyService = {
    getContextValue: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([
      WorkspaceModule,
    ]);
    injector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
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
    mockContextKeyService.getContextValue.mockReset();
  });

  it('registerVariables contribution point should be work', async (done) => {
    const variables = {
      registerVariable: jest.fn((variable) => {
        variable.resolve();
      }),
    };
    workspaceVariableContribution.registerVariables(variables as any);
    expect(variables.registerVariable).toBeCalledTimes(10);
    done();
  });

  it('getWorkspaceRootUri method should be work', async (done) => {
    const workspaceUri = new URI('file://userhome/');
    workspaceVariableContribution.getWorkspaceRootUri(workspaceUri);
    expect(mockWorkspaceService.getWorkspaceRootUri).toBeCalledWith(workspaceUri);
    done();
  });

  it('getResourceUri method should be work', async (done) => {
    workspaceVariableContribution.getResourceUri();
    expect(mockContextKeyService.getContextValue).toBeCalledWith('resource');
    done();
  });

  it('getWorkspaceRelativePath method should be work', async (done) => {
    const workspaceUri = new URI('file://userhome/');
    workspaceVariableContribution.getWorkspaceRelativePath(workspaceUri);
    expect(mockWorkspaceService.getWorkspaceRootUri).toBeCalledWith(workspaceUri);
    done();
  });
});
