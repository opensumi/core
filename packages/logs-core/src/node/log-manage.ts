import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as rimraf from 'rimraf';
import { toLocalISOString } from '@ali/ide-core-common';
import {
  ILogService,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
  SimpleLogServiceOptions,
  LoggerManageInitOptions,
} from '../common/';
import { LogService } from './log.service';

export class LogServiceManage implements ILogServiceManage {
  private globalLogLevel: LogLevel = LogLevel.Info;
  private logMap = new Map<SupportLogNamespace, ILogService>();
  private logRootFolderPath: string;
  private logFolderPath: string;

  init = (options: LoggerManageInitOptions) => {
    this.logRootFolderPath = options.logDir || path.join(os.homedir(), `.kaitian/logs/`);
    this.logFolderPath = this._getLogFolder();
    this.setGlobalLogLevel(options.logLevel || LogLevel.Info);
  }

  getLogger = (namespace: SupportLogNamespace, loggerOptions?: SimpleLogServiceOptions): ILogService => {
    if (this.logMap[namespace]) {
      const logger: ILogService = this.logMap[namespace];
      if (loggerOptions) {
        logger.setOptions(loggerOptions);
      }
      return logger;
    }
    const logger = new LogService(
      Object.assign({
        namespace,
        logLevel: this.globalLogLevel,
        logServiceManage: this,
      }, loggerOptions));
    this.logMap.set(namespace, logger);
    return logger;
  }

  removeLogger = (namespace: SupportLogNamespace) => {
    this.logMap.delete(namespace);
  }

  getGlobalLogLevel = () => {
    return this.globalLogLevel;
  }

  setGlobalLogLevel = (level: LogLevel) => {
    this.globalLogLevel = level;
  }

  getLogFolder = () => {
    if (!this.logFolderPath) {
      throw new Error(`Please do init first!`);
    }
    return this.logFolderPath;
  }

  /**
   * 保留最近5天的日志
   */
  cleanOldLogs = async () => {
    try {
      const logsRoot = path.dirname(this.getLogFolder());
      const currentLog = path.basename(this.getLogFolder());
      const children = fs.readdirSync(logsRoot);
      const allSessions = children.filter((name) => /^\d{8}$/.test(name));
      const oldSessions = allSessions.sort().filter((d, i) => d !== currentLog);
      const toDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 4));

      for (const name of toDelete) {
        rimraf.sync(path.join(logsRoot, name));
      }
    } catch (e) { }
  }

  dispose = () => {
    this.logMap.forEach((logger) => {
      logger.dispose();
    });
  }

  /**
   * 日志目录路径为 `${logRootPath}/${folderName}`
   * folderName 为当前当天日期比如: `20190807`
   * @private
   * @memberof LogServiceManage
   */
  private _getLogFolder = (): string => {
    const logRootPath = this.logRootFolderPath;
    if (!logRootPath) {
      throw new Error(`Please do initLogManage first!!!`);
    }
    const folderName = toLocalISOString(new Date()).replace(/-/g, '').match(/^\d{8}/)![0];

    return path.join(logRootPath, folderName);
  }
}
