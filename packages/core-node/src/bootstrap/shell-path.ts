import { isWindows, stripAnsi } from '@ali/ide-core-common';
import { exec } from 'child_process';

// 成功过一次后，取 PATH 的超时时间
const MAX_WAIT_AFTER_SUCCESS = 3 * 1000;

// Shell 执行的最大超时时间
// 即使 getShellPath 已经返回，在这个时间之内执行成功后还是会更新缓存，供下一次调用使用
const SHELL_TIMEOUT = 30 * 1000;

let shellPath = process.env.PATH;
let updating: Promise<void> | undefined;

// 至少成功过一次
let hasSuccess = false;

// 某些用户的配置初始化时间较长，提前开始
updateShellPath();

function parseEnv(env: string) {
  env = env.split('_SHELL_ENV_DELIMITER_')[1];
  const ret: {[key: string]: string} = {};
  const lines = stripAnsi(env).split('\n').filter(Boolean);
  for (const line of lines) {
    const [key, ...values] = line.split('=');
    ret[key] = values.join('=');
  }
  return ret;
}

async function createUpdateShellPathPromise(): Promise<void> {
  try {
    shellPath = await new Promise<string | undefined>((resolve, reject) => {
      try {
        exec(
          `${process.env.SHELL ||
            '/bin/bash'} -ilc 'echo -n "_SHELL_ENV_DELIMITER_"; env; echo -n "_SHELL_ENV_DELIMITER_"; exit'`
        , (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(parseEnv(res.toString()).PATH);
          }
        });
        setTimeout(() => {
          reject('timed out');
        }, SHELL_TIMEOUT);
      } catch (err) {
        reject(err);
      }
    });
    hasSuccess = true;
  } catch (err) {
    // console.error('shell path error:', err);
  }
}

function updateShellPath(): Promise<void> {
  // 确保每次只有一个进程运行
  // macOS 实测多个进程同时运行时，耗时成倍增加 <1s -> 6-10s
  if (!updating) {
    updating = createUpdateShellPathPromise().finally(() => {
      updating = undefined;
    });
  }
  return updating;
}

export async function getShellPath(): Promise<string | undefined> {
  if (isWindows) {
    return;
  }
  // 触发一次更新
  await Promise.race([
    updateShellPath(),
    new Promise<void>((resolve) => {
      // 第一次等待时间长一些，尽量拿到正确的 PATH
      setTimeout(() => {
        resolve(undefined);
      }, hasSuccess ? MAX_WAIT_AFTER_SUCCESS : SHELL_TIMEOUT);
    }),
  ]);
  // 不管有没有更新成功，都返回当前的最新结果
  return shellPath;
}
