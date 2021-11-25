import { Injectable, Autowired, ConstructorOf } from '@opensumi/di';
import path from 'path';
import { AppConfig } from '@opensumi/ide-core-node/lib/bootstrap/app';
import { Emitter } from '@opensumi/ide-core-common';
import {
  ILogService,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManager,
  BaseLogServiceOptions,
  LoggerManagerInitOptions,
  Archive,
} from '../common/';
import { getLogFolder, cleanOldLogs, cleanAllLogs, cleanExpiredLogs, getLogZipArchiveByFolder } from './utils';
import { LogService, DEFAULT_LOG_FOLDER } from './log.service';

@Injectable()
export class LogServiceManager implements ILogServiceManager {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  protected readonly logLevelChangeEmitter = new Emitter<LogLevel>();
  private globalLogLevel: LogLevel;
  private logMap = new Map<SupportLogNamespace, ILogService>();
  private logRootFolderPath: string;
  private logFolderPath: string;
  private LogServiceClass: ConstructorOf<ILogService>;

  constructor() {
    this.init({
      logDir: this.appConfig.logDir,
      logLevel: this.appConfig.logLevel,
    });
    this.cleanOldLogs();
  }

  private init = (options: LoggerManagerInitOptions) => {
    this.logRootFolderPath = options.logDir || DEFAULT_LOG_FOLDER;
    this.logFolderPath = this._getLogFolder();
    this.globalLogLevel = options.logLevel || LogLevel.Info;
    this.LogServiceClass = this.appConfig.LogServiceClass || LogService;
  }

  getLogger = (namespace: SupportLogNamespace, loggerOptions?: BaseLogServiceOptions): ILogService => {
    if (this.logMap.get(namespace)) {
      const logger: ILogService = this.logMap.get(namespace)!;
      if (loggerOptions) {
        logger.setOptions(loggerOptions);
      }
      return logger;
    }
    const logger = new this.LogServiceClass(
      Object.assign({
        namespace,
        logLevel: this.globalLogLevel,
        logServiceManager: this,
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
    this.logLevelChangeEmitter.fire(level);
  }

  get onDidChangeLogLevel() {
    return this.logLevelChangeEmitter.event;
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
      promiseList.push(logger.flush());
    });
    return getLogZipArchiveByFolder(foldPath, Promise.all(promiseList));
  }

  dispose = () => {
    this.logLevelChangeEmitter.dispose();
    this.logMap.forEach((logger) => {
      logger.dispose();
    });
  }

  /**
   * 日志目录路径为 `${logRootPath}/${folderName}`
   * folderName 为当前当天日期比如: `20190807`
   * @private
   * @memberof LogServiceManager
   */
  private _getLogFolder = (): string => {
    const logRootPath = this.getRootLogFolder();
    if (!logRootPath) {
      throw new Error(`Please do initLogManager first!!!`);
    }

    return getLogFolder(logRootPath);
  }
}
