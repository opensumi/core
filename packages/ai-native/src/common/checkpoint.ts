/**
 * 检查点服务相关的常量和类型定义
 */

/**
 * CheckpointTrackerService 的 Token
 */
export const CheckpointTrackerServiceToken = Symbol('CheckpointTrackerService');

/**
 * 检查点差异结果的接口定义
 */
export interface CheckpointDiffResult {
  /**
   * 文件的相对路径
   */
  relativePath: string;

  /**
   * 文件的绝对路径
   */
  absolutePath: string;

  /**
   * 变更前的内容
   */
  before: string;

  /**
   * 变更后的内容
   */
  after: string;
}
