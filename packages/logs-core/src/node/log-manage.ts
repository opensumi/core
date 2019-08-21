import { Injectable, Autowired } from '@ali/common-di';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as archiver from 'archiver';
import { toLocalISOString } from '@ali/ide-core-common';
import { AppConfig } from '@ali/ide-core-node';
import {
  ILogService,
  LogLevel,
  SupportLogNamespace,
  ILogServiceManage,
  SimpleLogServiceOptions,
  LoggerManageInitOptions,
  Archive,
  DebugLog,
} from '../common/';
import { LogService } from './log.service';

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
    this.logRootFolderPath = options.logDir || path.join(os.homedir(), `.kaitian/logs/`);
    this.logFolderPath = this._getLogFolder();
    this.setGlobalLogLevel(options.logLevel || LogLevel.Info);
  }

  getLogger = (namespace: SupportLogNamespace, loggerOptions?: SimpleLogServiceOptions): ILogService => {
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
    try {
      const logsRoot = this.logRootFolderPath;
      const currentLog = path.basename(this.getLogFolder());
      const children = fs.readdirSync(logsRoot);
      const allSessions = children.filter((name) => /^\d{8}$/.test(name));
      const oldSessions = allSessions.sort().filter((d, i) => d !== currentLog);
      const toDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 4));

      for (const name of toDelete) {
        fs.removeSync(path.join(logsRoot, name));
      }
    } catch (e) {
      debugLog.debug(e);
    }
  }

  cleanAllLogs = async () => {
    try {
      const logsRoot = this.getRootLogFolder();
      const children = fs.readdirSync(logsRoot);

      for (const name of children) {
        if (!/^\d{8}$/.test(name)) {
          return;
        }
        fs.removeSync(path.join(logsRoot, name));
      }
    } catch (e) {
      debugLog.debug(e);
    }
  }

  cleanExpiredLogs = async (day: number) => {
    try {
      const logsRoot = this.logRootFolderPath;
      const children = fs.readdirSync(logsRoot);
      const toDelete = children.filter((name) => {
        return /^\d{8}$/.test(name) && Number(name) < day;
      });
      for (const name of toDelete) {
        fs.removeSync(path.join(logsRoot, name));
      }
    } catch (e) {
      debugLog.debug(e);
    }
  }

  getLogZipArchiveByDay(day: number): Promise<Archive> {
    return this.getLogZipArchiveByFolder(path.join(this.getRootLogFolder(), String(day)));
  }

  async getLogZipArchiveByFolder(foldPath: string): Promise<Archive> {
    const promiseList: any[] = [];
    this.logMap.forEach((logger) => {
      if (logger.spdLogLoggerPromise) {
        promiseList.push(logger.spdLogLoggerPromise);
      }
    });
    await Promise.all(promiseList);
    if (!fs.existsSync(foldPath)) {
      throw new Error(`日志目录不存在 ${foldPath}`);
    }
    const archive = archiver('zip');
    archive.on('error', (err) => {
      throw err;
    });

    archive.on('entry', (entry) => {});

    archive.on('warning', (warning) => {
      debugLog.debug('archive warning', warning);
    });

    archive.on('progress', (progress) => {
      debugLog.debug('archive progress', progress);
    });

    archive.directory(foldPath, 'log');
    archive.finalize();
    return archive;
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
