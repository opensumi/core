import { Autowired } from '@opensumi/di';
import {
  VariableContribution,
  VariableRegistry,
  Domain,
  URI,
  CommandService,
  EDITOR_COMMANDS,
  COMMON_COMMANDS,
} from '@opensumi/ide-core-browser';

import { IWorkspaceService } from '../common';

@Domain(VariableContribution)
export class WorkspaceVariableContribution implements VariableContribution {
  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  registerVariables(variables: VariableRegistry): void {
    variables.registerVariable({
      name: 'workspaceRoot',
      description: 'The path of the workspace root folder',
      resolve: (context?: URI) => {
        const uri = this.getWorkspaceRootUri(context);
        return uri && uri.path.toString();
      },
    });
    variables.registerVariable({
      name: 'workspaceFolder',
      description: 'The path of the workspace root folder',
      resolve: (context?: URI) => {
        const uri = this.getWorkspaceRootUri(context);
        return uri && uri.path.toString();
      },
    });
    variables.registerVariable({
      name: 'workspaceFolderBasename',
      description: 'The name of the workspace root folder',
      resolve: (context?: URI) => {
        const uri = this.getWorkspaceRootUri(context);
        return uri && uri.displayName;
      },
    });
    variables.registerVariable({
      name: 'cwd',
      description: 'The path of the current working directory',
      resolve: (context?: URI) => {
        const uri = this.getWorkspaceRootUri(context);
        return (uri && uri.path.toString()) || '';
      },
    });
    variables.registerVariable({
      name: 'file',
      description: 'The path of the currently opened file',
      resolve: async () => {
        const uri = await this.getResourceUri();
        return uri && uri.path.toString();
      },
    });
    variables.registerVariable({
      name: 'fileBasename',
      description: 'The basename of the currently opened file',
      resolve: async () => {
        const uri = await this.getResourceUri();
        return uri && uri.path.base;
      },
    });
    variables.registerVariable({
      name: 'fileBasenameNoExtension',
      description: "The currently opened file's name without extension",
      resolve: async () => {
        const uri = await this.getResourceUri();
        return uri && uri.path.name;
      },
    });
    variables.registerVariable({
      name: 'fileDirname',
      description: "The name of the currently opened file's directory",
      resolve: async () => {
        const uri = await this.getResourceUri();
        return uri && uri.path.dir.toString();
      },
    });
    variables.registerVariable({
      name: 'fileExtname',
      description: 'The extension of the currently opened file',
      resolve: async () => {
        const uri = await this.getResourceUri();
        return uri && uri.path.ext;
      },
    });
    variables.registerVariable({
      name: 'relativeFile',
      description: "The currently opened file's path relative to the workspace root",
      resolve: async () => {
        const uri = await this.getResourceUri();
        return uri && this.getWorkspaceRelativePath(uri);
      },
    });
    variables.registerVariable({
      name: 'env',
      resolve: async () => {
        const envVariable = await this.commandService.executeCommand<{ [x: string]: string | undefined }>(
          COMMON_COMMANDS.ENVIRONMENT_VARIABLE.id,
        );
        return envVariable;
      },
    });
  }

  getWorkspaceRootUri(uri?: URI): URI | undefined {
    return this.workspaceService.getWorkspaceRootUri(uri);
  }

  async getResourceUri(): Promise<URI | undefined> {
    const currentResource = await this.commandService.executeCommand<{ uri: URI }>(
      EDITOR_COMMANDS.GET_CURRENT_RESOURCE.id,
    );
    if (currentResource) {
      return currentResource.uri;
    }
    return undefined;
  }

  getWorkspaceRelativePath(uri: URI): string | undefined {
    const workspaceRootUri = this.getWorkspaceRootUri(uri);
    const path = workspaceRootUri && workspaceRootUri.path.relative(uri.path);
    return path && path.toString();
  }
}
