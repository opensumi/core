import { statSync, existsSync } from 'fs';
import { join } from 'path';

import { green, yellow, red } from 'chalk';
import got from 'got';
import { open } from 'temp';
import yargs from 'yargs';

const CLI_NAME = process.env.CLI_NAME || 'sumi';
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
      // eslint-disable-next-line no-console
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

const argv = yargs(process.argv)
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

openPathOrUrl(argv._);

function isRelativePath(path: string): boolean {
  return path.startsWith('./') || !path.startsWith('/');
}

function isHttpProtocol(url: string): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'));
}
