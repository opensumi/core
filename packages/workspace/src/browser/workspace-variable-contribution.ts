import { Autowired } from '@ali/common-di';
import { IWorkspaceService } from '../common';
import { VariableContribution, VariableRegistry, Domain, URI } from '@ali/ide-core-browser';

@Domain(VariableContribution)
export class WorkspaceVariableContribution implements VariableContribution {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

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
      resolve: () => {
        const uri = this.getResourceUri();
        return uri && uri.path.toString();
      },
    });
    variables.registerVariable({
      name: 'fileBasename',
      description: 'The basename of the currently opened file',
      resolve: () => {
        const uri = this.getResourceUri();
        return uri && uri.path.base;
      },
    });
    variables.registerVariable({
      name: 'fileBasenameNoExtension',
      description: "The currently opened file's name without extension",
      resolve: () => {
        const uri = this.getResourceUri();
        return uri && uri.path.name;
      },
    });
    variables.registerVariable({
      name: 'fileDirname',
      description: "The name of the currently opened file's directory",
      resolve: () => {
        const uri = this.getResourceUri();
        return uri && uri.path.dir.toString();
      },
    });
    variables.registerVariable({
      name: 'fileExtname',
      description: 'The extension of the currently opened file',
      resolve: () => {
        const uri = this.getResourceUri();
        return uri && uri.path.ext;
      },
    });
    variables.registerVariable({
      name: 'relativeFile',
      description: "The currently opened file's path relative to the workspace root",
      resolve: () => {
        const uri = this.getResourceUri();
        return uri && this.getWorkspaceRelativePath(uri);
      },
    });
  }

  getWorkspaceRootUri(uri: URI | undefined = this.getResourceUri()): URI | undefined {
    return this.workspaceService.getWorkspaceRootUri(uri);
  }

  getResourceUri(): URI | undefined {
    return;
  }

  getWorkspaceRelativePath(uri: URI): string | undefined {
    const workspaceRootUri = this.getWorkspaceRootUri(uri);
    const path = workspaceRootUri && workspaceRootUri.path.relative(uri.path);
    return path && path.toString();
  }
}
