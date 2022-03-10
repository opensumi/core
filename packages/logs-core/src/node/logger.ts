/**
 * 提供无依赖的 Logger 供无DI的环境使用
 */

import { IBaseLogService, BaseLogServiceOptions } from '../common';

import { BaseLogService, DEFAULT_LOG_FOLDER } from './log.service';
import { getLogFolder } from './utils';

export * from './utils';

/**
 * @param options.namespace --表示实际落盘的文件名，因为没有Manager控制同名问题，在调用时请保证名字的特殊性避免重名
 * @param options.logDir --存放日志的目录（无需精确到当天日志目录）比如：~/.sumi/logs/
 */
export class SimpleLogService extends BaseLogService implements IBaseLogService {
  constructor(options: BaseLogServiceOptions) {
    options.logDir = getLogFolder(options.logDir || DEFAULT_LOG_FOLDER);
    super(options);
  }
}
