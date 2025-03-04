import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, Throttler, URI } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';

/**
 * 并发限制器
 */
class ConcurrencyLimiter {
  private maxConcurrent: number;
  private currentCount: number;
  private pendingQueue: (() => void)[];
  /**
   * @param {number} maxConcurrent - 最大并发数
   */
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent; // 最大并发数
    this.currentCount = 0; // 当前执行的任务数
    this.pendingQueue = []; // 等待执行的任务队列
  }

  /**
   * 执行异步任务
   * @param {Function} fn - 要执行的异步函数
   * @returns {Promise} 任务执行的结果
   */
  async execute(fn) {
    // 如果当前执行的任务数达到最大并发数，则加入等待队列
    if (this.currentCount >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.pendingQueue.push(resolve));
    }

    this.currentCount++;

    try {
      // 执行任务
      const result = await fn();
      return result;
    } finally {
      this.currentCount--;
      // 如果等待队列中有任务，则允许执行下一个任务
      if (this.pendingQueue.length > 0) {
        const next = this.pendingQueue.shift();
        next?.();
      }
    }
  }
}

@Injectable()
export class ListDirHandler {
  private readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB
  private readonly MAX_INDEXED_FILES = 50;
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IFileServiceClient)
  private readonly fileSystemService: IFileServiceClient;

  getWorkspaceDir(): string {
    return this.appConfig.workspaceDir;
  }

  async handler(args: { relativeWorkspacePath: string }) {
    const { relativeWorkspacePath } = args;
    if (!relativeWorkspacePath) {
      throw new Error('No list dir parameters provided. Need to give at least the path.');
    }

    // 解析相对路径
    const absolutePath = `${this.appConfig.workspaceDir}/${relativeWorkspacePath}`;
    const fileStat = await this.fileSystemService.getFileStat(absolutePath, true);
    // 验证路径有效性
    if (!fileStat || !fileStat.isDirectory) {
      throw new Error(`Could not find file ${relativeWorkspacePath} in the workspace.`);
    }
    // 过滤符合大小限制的文件
    const filesWithinSizeLimit =
      fileStat.children
        ?.filter((file) => !file.isDirectory && file.size !== void 0 && file.size <= this.MAX_FILE_SIZE)
        .slice(0, this.MAX_INDEXED_FILES) || [];

    // 记录需要分析的文件名
    const filesToAnalyze = new Set(filesWithinSizeLimit.map((file) => new URI(file.uri).displayName));

    // 创建并发限制器
    const concurrencyLimiter = new ConcurrencyLimiter(4);
    // 处理所有文件信息
    const fileInfos = await Promise.all(
      fileStat.children
        ?.sort((a, b) => b.lastModification - a.lastModification)
        .map(async (file) => {
          const uri = new URI(file.uri);
          const filePath = `${absolutePath}/${uri.displayName}`;
          let lineCount: number | undefined;

          // 如果文件需要分析，则计算行数
          if (filesToAnalyze.has(uri.displayName)) {
            lineCount = await concurrencyLimiter.execute(async () => this.countFileLines(filePath));
          }
          return {
            name: uri.displayName,
            isDirectory: file.isDirectory,
            size: file.size,
            lastModified: file.lastModification,
            numChildren: file.children?.length,
            numLines: lineCount,
          };
        }) || [],
    );
    // TODO: 过滤忽略文件
    return {
      files: fileInfos,
      directoryRelativeWorkspacePath: relativeWorkspacePath,
    };
  }

  async countFileLines(filePath: string) {
    const file = await this.fileSystemService.readFile(URI.file(filePath).toString());
    return file.toString().split('\n').length;
  }
}
