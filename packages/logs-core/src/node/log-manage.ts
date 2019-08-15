import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import { toLocalISOString } from '@ali/ide-core-common';
import {
  ILogService,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
} from '../common/';
import { LogService } from './log.service';

export class LogServiceManage implements ILogServiceManage {
  private globalLogLevel: LogLevel = LogLevel.Info;
  private logMap = new Map<SupportLogNamespace, ILogService>();
  private logFolderPath: string;

  constructor() {
    this.logFolderPath = this._getLogFolder();
  }

  getLogger = (namespace: SupportLogNamespace): ILogService => {
    if (this.logMap[namespace]) {
      return this.logMap[namespace];
    }
    const logger = new LogService({
      namespace,
      logLevel: this.globalLogLevel,
      logServiceManage: this,
    });
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
    return this.logFolderPath;
  }

  /**
   * 保留最近5天的日志
   */
  cleanOldLogs = async () => {
    try {
      const logsRoot = path.dirname(this.logFolderPath);
      const currentLog = path.basename(this.logFolderPath);
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
    // TODO from AppConfig
    const logRootPath = path.join(os.homedir(), '.kaitian', 'logs');
    const folderName = toLocalISOString(new Date()).replace(/-/g, '').match(/^\d{8}/)![0];

    return path.join(logRootPath, folderName);
  }
}
