import { Autowired, Injectable } from '@opensumi/di';
import { URI, Uri, AppConfig } from '@opensumi/ide-core-browser';

import { AbstractHttpFileService } from './browser-fs-provider';

const mockFiles = [
  {
    path: 'src/index.js',
    content: 'console.log("hello")',
  },
  {
    path: 'src/app.js',
    content: 'console.log("oho")',
  },
  {
    path: 'README.md',
    content: '# Hello world\ntry edit this file and save',
  },
  {
    path: 'sample.json',
    content: '{"hello": "world"}',
  },
];

const PathSeperator = '/';

export type HttpTreeList = { path: string; content?: string; children: HttpTreeList }[];

// NOTE: 一个内存文件读写的简单实现，集成时可以自行替换
@Injectable()
export class HttpFileService extends AbstractHttpFileService {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  private fileTree: HttpTreeList;

  public fileMap: { [filename: string]: string };

  constructor() {
    super();
  }

  initWorkspace(uri: Uri): { [filename: string]: string } {
    const map = {};
    mockFiles.forEach((item) => {
      map[item.path] = item.content;
    });
    this.fileMap = map;
    this.fileTree = this.pathToTree(this.fileMap);
    return this.fileMap;
  }

  private pathToTree(files: { [filename: string]: string }) {
    // // https://stackoverflow.com/questions/54424774/how-to-convert-an-array-of-paths-into-tree-object
    const result: HttpTreeList = [];
    // helper 的对象
    const accumulator = { __result__: result };
    const filelist = Object.keys(files).map((path) => ({ path, content: files[path] }));
    filelist.forEach((file) => {
      const path = file.path!;
      // 初始的 accumulator 为 level
      path.split(PathSeperator).reduce((acc, cur) => {
        // 每次返回 path 对应的 desc 作为下一个 path 的 parent
        // 不存在 path 对应的 desc 则创建一个新的挂载到 acc 上
        if (!acc[cur]) {
          acc[cur] = { __result__: [] };
          const element = {
            path: cur,
            children: acc[cur].__result__,
          };

          // 说明是文件
          if (path.endsWith(cur)) {
            (element as any).content = file.content;
          }
          acc.__result__.push(element);
        }
        // 返回当前 path 对应的 desc 作为下一次遍历的 parent
        return acc[cur];
      }, accumulator);
    });

    return result;
  }

  async readFile(uri: Uri, encoding?: string): Promise<string> {
    const _uri = new URI(uri);
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(_uri)!.toString();
    return this.fileMap[relativePath];
  }

  async readDir(uri: Uri) {
    const _uri = new URI(uri);
    const treeNode = this.getTargetTreeNode(_uri);
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(_uri)!.toString();
    return (treeNode?.children || []).map((item) => ({
      ...item,
      path: relativePath + PathSeperator + item.path,
    }));
  }

  private getTargetTreeNode(uri: URI) {
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(uri)!.toString();
    if (!relativePath) {
      // 根目录
      return { children: this.fileTree, path: relativePath };
    }
    const paths = relativePath.split(PathSeperator);
    let targetNode: { path: string; content?: string; children: HttpTreeList } | undefined;
    let nodeList = this.fileTree;
    paths.forEach((path) => {
      targetNode = nodeList.find((node) => node.path === path);
      nodeList = targetNode?.children || [];
    });
    return targetNode;
  }

  async updateFile(uri: Uri, content: string, options: { encoding?: string; newUri?: Uri }): Promise<void> {
    const _uri = new URI(uri);
    // TODO: sync update to remote logic
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(_uri)!.toString();
    if (options.newUri) {
      const newRelativePath = URI.file(this.appConfig.workspaceDir).relative(new URI(options.newUri))!.toString();
      this.fileMap[newRelativePath] = content;
      delete this.fileMap[relativePath];
      // TODO: 只更新对应节点，可以有更好的性能
      this.fileTree = this.pathToTree(this.fileMap);
    } else {
      this.fileMap[relativePath] = content;
      const targetNode = this.getTargetTreeNode(_uri);
      if (!targetNode || targetNode.children.length > 0) {
        throw new Error('无法更新目标文件内容：目标未找到或为目录');
      }
      targetNode.content = content;
    }
  }

  async createFile(uri: Uri, content: string, options: { encoding?: string }) {
    const _uri = new URI(uri);
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(_uri)!.toString();
    // TODO: sync create to remote logic
    this.fileMap[relativePath] = content;
    // TODO: 性能优化
    this.fileTree = this.pathToTree(this.fileMap);
  }

  async deleteFile(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean }) {
    const _uri = new URI(uri);
    const relativePath = URI.file(this.appConfig.workspaceDir).relative(_uri)!.toString();
    // TODO: sync delete to remote logic
    delete this.fileMap[relativePath];
    // TODO: 性能优化
    this.fileTree = this.pathToTree(this.fileMap);
  }

  protected getRelativePath(uri: URI) {
    const path = URI.file(this.appConfig.workspaceDir).relative(uri)!.toString();
    return path;
  }
}
