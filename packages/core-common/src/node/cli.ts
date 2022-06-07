import { argv as _argv } from 'yargs';

const argv = _argv as { [x: string]: unknown; _: (string | number)[]; $0: string };

export { argv };
