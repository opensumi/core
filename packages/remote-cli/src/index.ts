/* eslint-disable no-console */
import { statSync, existsSync } from 'fs';
import { join } from 'path';

import { green, red } from 'chalk';
import got from 'got';
import mri, { Options, Argv } from 'mri';

class Factory {
  constructor(private factoryArgv: string[]) {}

  private _argv: Argv | undefined;
  get argv() {
    if (!this._argv) {
      const options = {
        string: this._string,
      } as Options;
      this._argv = mri(this.factoryArgv, options);
    }

    if (this._argv?.help) {
      this.showUsage();
      process.exit(0);
    }
    return this._argv;
  }
  private _usage: string | undefined;
  usage(message: string) {
    this._usage = message;
    return this;
  }
  private showUsage() {
    if (this._usage) {
      console.log(this._usage.trimLeft());
      if (this.afterUsage) {
        console.log('Usage:');
        console.log('    ' + this.afterUsage);
      }
    }
  }
  private _string = [] as string[];
  string(k: string) {
    this._string.push(k);
    return this;
  }
  private afterUsage: string | undefined;
  help() {
    this.afterUsage = '--help Show help';
    return this;
  }
}

const PRODUCTION_NAME = process.env.PRODUCTION_NAME || 'OpenSumi';
const CLIENT_ID = process.env.CLIENT_ID;
const SUMI_SERVER_HOST = process.env.SUMI_SERVER_HOST || 'http://0.0.0.0:8000';
const OPENER_ROUTE = process.env.OPENER_ROUTE || 'open';

enum OpenType {
  url = 'url',
  file = 'file',
}

function openPathOrUrl(pathOrUrl: string): void {
  if (!CLIENT_ID) {
    // eslint-disable-next-line no-console
    console.error(red(`${PRODUCTION_NAME} Client id is undefined!`));
    process.exit(0);
  }

  let type: OpenType = OpenType.file;
  let fullPathOrUrl = pathOrUrl;
  if (isHttpProtocol(pathOrUrl)) {
    type = OpenType.url;
  } else if (isRelativePath(pathOrUrl)) {
    fullPathOrUrl = join(process.cwd(), pathOrUrl);
  }

  if (type === OpenType.file) {
    if (!existsSync(fullPathOrUrl)) {
      // eslint-disable-next-line no-console
      console.error(red(`The file path ${fullPathOrUrl} is not exist!`));
      process.exit(0);
    }

    if (statSync(fullPathOrUrl).isDirectory()) {
      console.error(red('Directory is unsupported'));
      process.exit(0);
    }
  }

  const query = `?type=${type}&${type}=${encodeURIComponent(fullPathOrUrl)}&clientId=${CLIENT_ID}`;
  got(`${SUMI_SERVER_HOST}/${OPENER_ROUTE}${query}`).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(red(`Open ${type} ${fullPathOrUrl} error: \n ${err.message}`));
    process.exit(1);
  });
}

const argv = new Factory(process.argv)
  .usage(
    `
  Help: Open files or website from a shell.
By default, opens each file using the ${PRODUCTION_NAME} for that file.
If the file is in the form of a URL, will be opened the website use internal browser.

Examples:
    1. ${green('open https://www.hostname.com')}  Will open the website use internal browser.
    2. ${green('open ./package.json')} Will open the file use ${PRODUCTION_NAME}.
    3. ${green('open /path/to/file')} Will open the file use ${PRODUCTION_NAME}.
  `,
  )
  .help()
  .string('_').argv;

if (argv._[0] !== undefined) {
  openPathOrUrl(argv._[0].toString());
} else {
  // eslint-disable-next-line no-console
  console.error(red('The path or url is not defined.'));
  process.exit(0);
}

function isRelativePath(path: string): boolean {
  return path.startsWith('./') || !path.startsWith('/');
}

function isHttpProtocol(url: string): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'));
}
