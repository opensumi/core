import { Injectable, Autowired } from '@ali/common-di';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as archiver from 'archiver';
import { AppConfig } from '@ali/ide-core-node';
import {
  ILogService,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
  BaseLogServiceOptions,
  LoggerManageInitOptions,
  Archive,
  DebugLog,
} from '../common/';
import { getLogFolder, cleanOldLogs, cleanAllLogs, cleanExpiredLogs, getLogZipArchiveByFolder } from './utils';
import { LogService, DEFAULT_LOG_FOLDER } from './log.service';

const debugLog = new DebugLog('Log-Manage');

@Injectable()
export class LogServiceManage implements ILogServiceManage {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  private globalLogLevel: LogLevel;
  private logMap = new Map<SupportLogNamespace, ILogService>();
  private logRootFolderPath: string;
  private logFolderPath: string;

  constructor() {
    this.init({
      logDir: this.appConfig.logDir,
      logLevel: this.appConfig.logLevel,
    });
    this.cleanOldLogs();
  }

  private init = (options: LoggerManageInitOptions) => {
    this.logRootFolderPath = options.logDir || DEFAULT_LOG_FOLDER;
    this.logFolderPath = this._getLogFolder();
    this.setGlobalLogLevel(options.logLevel || LogLevel.Info);
  }

  getLogger = (namespace: SupportLogNamespace, loggerOptions?: BaseLogServiceOptions): ILogService => {
    if (this.logMap.get(namespace)) {
      const logger: ILogService = this.logMap.get(namespace)!;
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

  getLogFolder = (): string => {
    if (!this.logFolderPath) {
      throw new Error(`Please do init first!`);
    }
    return this.logFolderPath;
  }

  getRootLogFolder = (): string => {
    return this.logRootFolderPath;
  }

  cleanOldLogs = async () => {
    return cleanOldLogs(this.getRootLogFolder());
  }

  cleanAllLogs = async () => {
    return cleanAllLogs(this.getRootLogFolder());
  }

  cleanExpiredLogs = async (day: number) => {
    return cleanExpiredLogs(day, this.getRootLogFolder());
  }

  getLogZipArchiveByDay(day: number): Promise<Archive> {
    return this.getLogZipArchiveByFolder(path.join(this.getRootLogFolder(), String(day)));
  }

  async getLogZipArchiveByFolder(foldPath: string): Promise<Archive> {
    const promiseList: any[] = [];
    this.logMap.forEach((logger) => {
      promiseList.push(logger.drop());
    });
    return getLogZipArchiveByFolder(foldPath, Promise.all(promiseList));
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
    const logRootPath = this.getRootLogFolder();
    if (!logRootPath) {
      throw new Error(`Please do initLogManage first!!!`);
    }

    return getLogFolder(logRootPath);
  }
}
