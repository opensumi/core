import { isWindows } from '@ali/ide-core-common';
import { exec } from 'child_process';

const ansiRegex = ({onlyFirst = false} = {}) => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

const stripAnsi = (str) => {
  return typeof str === 'string' ? str.replace(ansiRegex(), '') : str;
};

export async function getShellPath(): Promise<string | undefined> {
  if (isWindows) {
    return;
  }
  const parseEnv = (env) => {
    env = env.split('_SHELL_ENV_DELIMITER_')[1];
    const ret: {[key: string]: string} = {};

    for (const line of stripAnsi(env)
      .split('\n')
      .filter((line) => Boolean(line))) {
      const [key, ...values] = line.split('=');
      ret[key] = values.join('=');
    }

    return ret;
  };
  return Promise.race ([
    new Promise<string | undefined>((resolve, reject) => {
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
      } catch (e) {
        reject(e);
      }
    }),
    new Promise<undefined>((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 3000);
    }),
  ]);

}
