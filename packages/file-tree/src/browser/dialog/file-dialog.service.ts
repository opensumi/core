import { Injectable, Autowired } from '@ali/common-di';
import {
  URI,
} from '@ali/ide-core-browser';
import { IFileTreeAPI } from '../../common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { LabelService } from '@ali/ide-core-browser/lib/services';

export interface IWorkspaceRoot {
  uri: string;
  isDirectory: boolean;
  lastModification?: number;
}

@Injectable()
export class FileDialogService {

  @Autowired(IFileTreeAPI)
  private fileAPI: IFileTreeAPI;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(LabelService)
  public labelService: LabelService;

  private root: IWorkspaceRoot;

  getFiles = async (uri?: URI) => {
    if (!uri) {
      this.root = (await this.workspaceService.roots)[0];
    } else {
      const stat = await this.fileAPI.getFileStat(uri.toString());
      this.root = stat;
    }
    if (this.root.isDirectory) {
      const files = await this.fileAPI.getFiles(this.root.uri);
      return files[0];
    }
  }

  getDirectoryList = (): string[] => {
    const directorys: string[] = [];
    if (!this.root) {
      return directorys;
    }
    let root = new URI(this.root.uri);
    if (root.path.toString() !== '/') {
      while (root.path.toString() !== '/') {
        directorys.push(root.withoutScheme().toString());
        root = root.parent;
      }
    } else {
      directorys.push(root.withoutScheme().toString());
    }
    return directorys;
  }
}
