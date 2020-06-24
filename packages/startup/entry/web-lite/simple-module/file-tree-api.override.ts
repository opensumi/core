
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI } from '@ali/ide-file-tree-next/lib/browser/services/file-tree-api.service';
import { ITree } from '@ali/ide-components';
import { FileStat } from '@ali/ide-file-service';
import { Directory } from '@ali/ide-file-tree-next/lib/browser/file-tree-nodes';
import { getRepoFiles } from '../ide-exts/apis';
import { URI } from '@ali/ide-core-common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Path } from '@ali/ide-core-common/lib/path';
import { IMetaService } from './meta-service';

@Injectable()
export class FileTreeApiOverride extends FileTreeAPI {
  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  private rootFolder: string;

  async resolveChildren(tree: ITree, path: string | FileStat, parent?: Directory, compact?: boolean): Promise<{
    children: (File | Directory)[],
    filestat: FileStat;
  }> {
    if (!this.rootFolder) {
      this.rootFolder = new URI(this.workspaceService.workspace!.uri).codeUri.fsPath;
    }
    let relativePath: string;
    if (typeof path === 'string') {
      relativePath = new Path(this.rootFolder).relative(new URI(path).path)!.toString();
    } else {
      relativePath = new Path(this.rootFolder).relative(new URI(path.uri).path)!.toString();
    }
    // FIXME: projectId可以用group/repo吗
    const childNodes = await getRepoFiles(this.metaService.projectId, this.metaService.ref, relativePath);
    // FIXME: syncToRemote不能耦合在fsProvider里，外层无法判断是否需要sync，应该要加一层browser-scm来处理
    const ensureNodes: Promise<FileStat>[] = [];
    for (const node of childNodes) {
      if (node.type === 'tree') {
        ensureNodes.push(this.fileServiceClient.createFolder(URI.file(new Path(this.rootFolder).join(`${node.path}`).toString()).toString()));
      } else {
        ensureNodes.push(this.fileServiceClient.createFile(URI.file(new Path(this.rootFolder).join(`${node.path}`).toString()).toString()));
      }
    }
    try {
      await Promise.all(ensureNodes);
    } catch (err) {
      // logger
    }
    return super.resolveChildren(tree, path, parent, compact);
  }

}
