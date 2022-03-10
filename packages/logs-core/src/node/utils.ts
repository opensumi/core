import path from 'path';

import archiver from 'archiver';
import * as fs from 'fs-extra';

import { toLocalISOString, getDebugLogger, Archive } from '@opensumi/ide-core-common';

const debugLog = getDebugLogger('LogUtils');

/**
 * @param date 不传则返回当天日志文件夹名
 */
export function getLogFolderName(date?: Date) {
  return toLocalISOString(date || new Date())
    .replace(/-/g, '')
    .match(/^\d{8}/)![0];
}

/**
 * 日志目录路径为 `${logRootPath}/${folderName}`
 * folderName 为当前当天日期比如: `20190807`
 * @param logRootPath
 */
export function getLogFolder(logRootPath: string): string {
  const folderName = getLogFolderName();
  return path.join(logRootPath, folderName);
}

/**
 * 清理日志文件夹，保留最近5天的目录
 */
export async function cleanOldLogs(logsRoot: string) {
  try {
    const currentLog = getLogFolderName();
    const children = fs.readdirSync(logsRoot);
    const allSessions = children.filter((name) => /^\d{8}$/.test(name));
    const oldSessions = allSessions.sort().filter((d, i) => d !== currentLog);
    const toDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 4));

    for (const name of toDelete) {
      fs.removeSync(path.join(logsRoot, name));
    }
  } catch (e) {}
}

/**
 * 清理所有的日志文件夹
 */
export async function cleanAllLogs(logsRoot: string) {
  try {
    const children = fs.readdirSync(logsRoot);
    for (const name of children) {
      if (!/^\d{8}$/.test(name)) {
        return;
      }
      fs.removeSync(path.join(logsRoot, name));
    }
  } catch (e) {}
}

/**
 * 清理操作该日期的日志文件夹
 *
 * 清理 day 之前的日志目录
 * @param day --格式为： 20190807
 */
export function cleanExpiredLogs(day: number, logsRoot: string) {
  try {
    const children = fs.readdirSync(logsRoot);
    const toDelete = children.filter((name) => /^\d{8}$/.test(name) && Number(name) < day);
    for (const name of toDelete) {
      fs.removeSync(path.join(logsRoot, name));
    }
  } catch (e) {}
}

/**
 *
 * 将某个目录打包，提供可写入流的方法 Archive.pipe
 * @param foldPath -- 打包的目录
 * @param waitPromise --打包执行需要完成的Promise 比如 logger.flush 将缓存落盘
 */
export async function getLogZipArchiveByFolder(foldPath: string, waitPromise?: Promise<any>): Promise<Archive> {
  if (waitPromise) {
    await waitPromise;
  }
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
