import { Autowired , INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { CheckpointDiffResult, CheckpointTrackerServiceToken } from '../../common/checkpoint';

import CheckpointTracker from './CheckpointTracker';

/**
 * CheckpointTracker 的可注入服务包装
 *
 * 该服务为 CheckpointTracker 提供依赖注入支持，
 * 使其能够轻松集成到应用程序的依赖注入系统中。
 */
@Injectable()
export class CheckpointTrackerService {
  private trackerMap: Map<string, CheckpointTracker> = new Map();

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  /**
   * 获取或创建特定任务的 CheckpointTracker 实例
   *
   * @param taskId - 被跟踪任务的唯一标识符
   * @param cwd - 跟踪文件的当前工作目录
   * @param globalStoragePath - 存储检查点数据的全局存储路径
   * @returns Promise 解析为 CheckpointTracker 实例，如果检查点被禁用则为 undefined
   */
  public async getOrCreateTracker(
    taskId: string,
    cwd: string,
    globalStoragePath: string,
  ): Promise<CheckpointTracker | undefined> {
    const key = `${taskId}:${cwd}`;

    if (this.trackerMap.has(key)) {
      return this.trackerMap.get(key);
    }

    try {
      const tracker = await CheckpointTracker.create(taskId, cwd, globalStoragePath);

      if (tracker) {
        this.trackerMap.set(key, tracker);
      }

      return tracker;
    } catch (error) {
      this.logger.error('创建 CheckpointTracker 失败:', error);
      throw error;
    }
  }

  /**
   * 为特定任务创建检查点提交
   *
   * @param taskId - 任务的唯一标识符
   * @param cwd - 当前工作目录
   * @param globalStoragePath - 全局存储路径
   * @returns Promise 解析为提交哈希，如果操作失败则为 undefined
   */
  public async createCheckpoint(
    taskId: string,
    cwd: string,
    globalStoragePath: string,
  ): Promise<string | undefined> {
    const tracker = await this.getOrCreateTracker(taskId, cwd, globalStoragePath);

    if (!tracker) {
      return undefined;
    }

    return tracker.commit();
  }

  /**
   * 重置到特定的检查点提交
   *
   * @param taskId - 任务的唯一标识符
   * @param cwd - 当前工作目录
   * @param globalStoragePath - 全局存储路径
   * @param commitHash - 要重置到的检查点提交的哈希
   * @returns Promise 在重置完成时解析
   */
  public async resetToCheckpoint(
    taskId: string,
    cwd: string,
    globalStoragePath: string,
    commitHash: string,
  ): Promise<void> {
    const tracker = await this.getOrCreateTracker(taskId, cwd, globalStoragePath);

    if (!tracker) {
      throw new Error('获取检查点跟踪器失败');
    }

    return tracker.resetHead(commitHash);
  }

  /**
   * 获取两个检查点之间或检查点与工作目录之间的差异
   *
   * @param taskId - 任务的唯一标识符
   * @param cwd - 当前工作目录
   * @param globalStoragePath - 全局存储路径
   * @param lhsHash - 比较源的提交（较旧的提交）
   * @param rhsHash - 比较目标的提交（较新的提交）。如果省略，则与工作目录比较。
   * @returns Promise 解析为文件更改数组
   */
  public async getDiff(
    taskId: string,
    cwd: string,
    globalStoragePath: string,
    lhsHash: string,
    rhsHash?: string,
  ): Promise<CheckpointDiffResult[]> {
    const tracker = await this.getOrCreateTracker(taskId, cwd, globalStoragePath);

    if (!tracker) {
      throw new Error('获取检查点跟踪器失败');
    }

    return tracker.getDiffSet(lhsHash, rhsHash);
  }
}
